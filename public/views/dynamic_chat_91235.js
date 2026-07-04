(async function () {
  let socket;
  const chunkSize = 512 * 1024;
  let _uploadProgressEl = null;
  window._uploadAborted = false;
  const listHeader = document.getElementById("list-header");
  const active = document.getElementById("active");
  const sendButton = document.getElementById("send-button");
  const messagesDiv = document.getElementById("chat-content");
  // Typing storage
  let typingTimer;
  let isTyping = false;
  const typingUsers = new Set();
  let cachedChats = [];
  let oldestTimestamp = null;
  let hasMoreHistory = true;
  let isLoadingHistory = false;

  // Typing Indicator — must be created before any socket events fire
  const chatContainer = document.getElementById("chat-container");
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "typing-indicator-box";
  typingIndicator.innerHTML =
    '<span id="typing-text"></span><div class="typing-dots"><span></span><span></span><span></span></div>';
  typingIndicator.style.display = "none";
  if (chatContainer) {
    chatContainer.insertBefore(
      typingIndicator,
      document.querySelector(".chat-footer"),
    );
  }

  /**
   * Fetches chat history with cursor-based pagination.
   */
  async function loadChatHistory(prepend = false) {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
    console.log("[Chat] loading more history");
    try {
      const reqData = { limit: 30 };
      if (prepend && oldestTimestamp) reqData.before = oldestTimestamp;

      const data = await window.fetchData("/api/getchats", reqData);
      if (data && data.chats && data.chats.length > 0) {
        oldestTimestamp = data.chats[0].timestamp;
        hasMoreHistory = !!data.hasMore;

        if (prepend) {
          const dedupedIds = new Set(cachedChats.map((c) => c.id));
          const newChats = data.chats.filter((c) => !dedupedIds.has(c.id));
          cachedChats = [...newChats, ...cachedChats];
          prependConversationPage(data.chats);
        } else {
          cachedChats = data.chats;
          renderConversation("public");
        }
      } else if (data) {
        hasMoreHistory = false;
      }
    } catch (err) {
      console.error("[Chat] Failed to load chat history:", err);
      addError("Failed to load chat history.");
    } finally {
      isLoadingHistory = false;
    }
  }

  function renderConversation(recipientName) {
    if (messagesDiv) {
      messagesDiv.innerHTML = "";
    }

    cachedChats.forEach((chat) => {
      const isSelf = chat.sender === window.userInfo.username;
      const timeStr = new Date(chat.timestamp).toLocaleString();

      const isPublicChat =
        recipientName === "public" && chat.receiver === "public";
      const isPrivateChat =
        recipientName !== "public" &&
        chat.receiver !== "public" &&
        ((chat.sender === window.userInfo.username &&
          chat.receiver === recipientName) ||
          (chat.sender === recipientName &&
            chat.receiver === window.userInfo.username));

      if (isPublicChat || isPrivateChat) {
        if (isSelf) {
          if (chat.type !== "text")
            embedDriveFilesTo(timeStr, chat.content, chat.type);
          else addMessageTo(chat.content, timeStr);
        } else {
          if (chat.type !== "text")
            embedDriveFiles(
              timeStr,
              chat.sender,
              chat.content,
              chat.imageUrl,
              chat.type,
            );
          else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl);
        }
      }
    });
  }

  function prependConversationPage(chats) {
    if (!messagesDiv) return;
    const prevHeight = messagesDiv.scrollHeight;
    const recipientName = document.getElementById("recipientInput").value;
    chats.forEach((chat) => {
      const isSelf = chat.sender === window.userInfo.username;
      const timeStr = new Date(chat.timestamp).toLocaleString();
      const type = chat.type;
      const isPublicChat =
        recipientName === "public" && chat.receiver === "public";
      const isPrivateChat =
        recipientName !== "public" &&
        chat.receiver !== "public" &&
        ((chat.sender === window.userInfo.username &&
          chat.receiver === recipientName) ||
          (chat.sender === recipientName &&
            chat.receiver === window.userInfo.username));
      if (!isPublicChat && !isPrivateChat) return;
      if (type === "text") {
        if (isSelf) addMessageTo(chat.content, timeStr, true);
        else
          addMessage(chat.sender, chat.content, timeStr, chat.imageUrl, true);
      } else {
        if (isSelf) embedDriveFilesTo(timeStr, chat.content, type, true);
        else
          embedDriveFiles(
            timeStr,
            chat.sender,
            chat.content,
            chat.imageUrl,
            type,
            true,
          );
      }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight - prevHeight;
  }

  /**
   * Initializes Socket.IO connection and sets up identity registration.
   */
  async function connectWebSocket() {
    socket = io(); // Assign to outer scope 'socket' variable
    window.socket = socket;

    async function flushPendingQueue() {
      if (
        !window.getPending ||
        !socket ||
        !socket.connected ||
        !navigator.onLine
      ) {
        console.log("[Chat] Socket not connected or offline");
        return;
      }
      try {
        const queue = await window.getPending("chat");
        for (const item of queue) {
          if (window.deletePending) await window.deletePending(item.id);
          if (item.offset >= 0) {
            sendChunks(item.recipient, item.content, item.offset);
          } else {
            sendMessage(item.recipient, item.content);
          }
        }
      } catch (err) {
        console.error("[Chat] Failed to process pending queue:", err);
      }
    }

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      socket.emit("insert name", { jwtoken: Cookies.get("token") });
      addError("Connected");
      setTimeout(flushPendingQueue, 2000);
    });

    const onChatOnline = () => {
      console.log("[Chat] Network restored — flushing pending queue");
      setTimeout(flushPendingQueue, 1500);
    };
    window.addEventListener("online", onChatOnline);
    window.eventListeners.push({
      element: window,
      event: "online",
      handler: onChatOnline,
    });

    // Initialize listeners once socket is connected
    setupSocketListeners();
  }

  function addPicture(picture) {
    const profileDivs = document.querySelectorAll(".circle.responsive-img");
    if (picture) {
      profileDivs.forEach((img) => {
        img.src = picture;
      });
    }
  }

  async function getUserInfo() {
    try {
      const reqData = { token: Cookies.get("token") };
      const data = await window.fetchData("/api/userData", reqData);
      if (data && data.userinfo) {
        // setUserInfo is globally available from userInfo.obf.js (which we unobfuscated)
        window.setUserInfo(data.userinfo.username, data.userinfo.imageurl);
        addPicture(data.userinfo.imageurl);
      }
    } catch (err) {
      console.error("[Chat] Failed to fetch user info:", err);
    }
  }

  // Startup Logic
  if (Cookies.get("token")) {
    const recipientInput = document.getElementById("recipientInput");
    if (recipientInput) recipientInput.value = "public"; // Default to public

    await getUserInfo();
    await connectWebSocket();
    oldestTimestamp = null;
    hasMoreHistory = true;
    isLoadingHistory = false;
    await loadChatHistory();
    socket.emit("show active-users");
  }

  function addUploadProgress(fileName) {
    removeUploadProgress();
    const container = document.createElement("div");
    container.className = "send-final-container";
    const timeLabel = document.createElement("div");
    timeLabel.textContent = new Date().toLocaleString();
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#777";
    timeLabel.style.marginBottom = "2px";
    const body = document.createElement("div");
    body.className = "message-send-container";
    const msgBox = document.createElement("div");
    msgBox.className = "message-send upload-progress-msg";
    msgBox.innerHTML = `
            <div style="font-weight:600;margin-bottom:6px;">Uploading <span class="up-fname"></span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%"></div></div>
            <div style="margin-top:4px;font-size:11px;text-align:right;"><span class="up-pct">0</span>%</div>
        `;
    body.appendChild(msgBox);
    container.append(timeLabel, body);
    const chatContent = document.getElementById("chat-content");
    if (chatContent) {
      chatContent.appendChild(container);
      chatContent.scrollTop = chatContent.scrollHeight;
    }
    _uploadProgressEl = container;
  }

  function updateChatProgress(percent, fileName) {
    if (!_uploadProgressEl || !_uploadProgressEl.parentNode) return false;
    const pct = _uploadProgressEl.querySelector(".up-pct");
    const fill = _uploadProgressEl.querySelector(".progress-bar-fill");
    const nameEl = _uploadProgressEl.querySelector(".up-fname");
    if (pct) pct.textContent = Math.round(percent);
    if (fill) fill.style.width = percent + "%";
    if (nameEl && fileName) nameEl.textContent = fileName;
    if (percent >= 100) {
      const box = _uploadProgressEl.querySelector(".message-send");
      if (box)
        box.innerHTML =
          '<div style="font-weight:600;color:var(--accent);">Upload complete, waiting for server...</div>';
    }
    return true;
  }

  function removeUploadProgress() {
    if (_uploadProgressEl && _uploadProgressEl.parentNode) {
      _uploadProgressEl.remove();
    }
    _uploadProgressEl = null;
  }

  function addOfflineTextPreview(message) {
    if (!messagesDiv) return;
    const finalContainer = document.createElement("div");
    finalContainer.className = "send-final-container";

    const timeLabel = document.createElement("div");
    timeLabel.textContent = new Date().toLocaleString() + " • Offline Queue";
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#e67e22";
    timeLabel.style.marginBottom = "2px";

    const body = document.createElement("div");
    body.className = "message-send-container";

    const msgBox = document.createElement("div");
    msgBox.className = "message-send";
    msgBox.style.border = "1px dashed #e67e22";
    msgBox.style.opacity = "0.75";
    msgBox.textContent = message;

    const badge = document.createElement("div");
    badge.textContent = "⏳ Sending when online...";
    badge.style.fontSize = "10px";
    badge.style.color = "#e67e22";
    badge.style.marginTop = "4px";

    msgBox.appendChild(badge);
    body.appendChild(msgBox);
    finalContainer.append(timeLabel, body);
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addOfflineFilePreview(file) {
    if (!messagesDiv) return;
    const finalContainer = document.createElement("div");
    finalContainer.className = "send-final-container";

    const timeLabel = document.createElement("div");
    timeLabel.textContent = new Date().toLocaleString() + " • Offline Queue";
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#e67e22";
    timeLabel.style.marginBottom = "2px";

    const body = document.createElement("div");
    body.className = "message-send-container";

    const msgBox = document.createElement("div");
    msgBox.className = "message-send";
    msgBox.style.border = "1px dashed #e67e22";

    if (file.type && file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.className = "chat-media-preview";
      img.style.maxHeight = "150px";
      img.style.borderRadius = "8px";
      img.style.opacity = "0.7";

      const badge = document.createElement("div");
      badge.textContent = `Pending: ${file.name}`;
      badge.style.fontSize = "11px";
      badge.style.marginTop = "4px";
      badge.style.color = "#e67e22";

      msgBox.append(img, badge);
    } else {
      msgBox.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;color:#e67e22;">
                    <span>📄</span>
                    <div style="text-align:left;">
                        <div style="font-weight:600;font-size:12px;">${file.name}</div>
                        <small>Waiting for internet...</small>
                    </div>
                </div>
            `;
    }

    body.appendChild(msgBox);
    finalContainer.append(timeLabel, body);
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  /**
   * Handles segmented file uploads for large images/videos.
   */
  function sendChunks(recipient, file, offset) {
    if (window._uploadAborted) return;

    if (!socket || !socket.connected || !navigator.onLine) {
      if (window.Pending) window.Pending(recipient, file, offset);
      if (offset === 0) {
        addOfflineFilePreview(file);
      }
      return;
    }

    if (offset === 0) addUploadProgress(file.name);

    if (offset >= file.size) {
      updateChatProgress(100, file.name);
      socket.emit("complete", {
        to: recipient,
        fileType: file.type,
        fileName: file.name,
      });
      if (window.clearPending) window.clearPending();
      return;
    }

    const percent = (offset / file.size) * 100;
    const cont = updateChatProgress(percent, file.name);
    if (!cont) {
      window._uploadAborted = true;
      return;
    }

    const fileSlice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();

    reader.onload = () => {
      if (window._uploadAborted) return;

      const payload = {
        fileData: reader.result,
        fileType: file.type,
        fileName: file.name,
      };
      if (recipient !== "public") payload.to = recipient;

      let eventName;
      if (file.type.startsWith("image/"))
        eventName = recipient === "public" ? "public image" : "private image";
      else if (file.type.startsWith("video/"))
        eventName = recipient === "public" ? "public video" : "private video";
      else eventName = recipient === "public" ? "public file" : "private file";

      socket.emit(eventName, payload);
      sendChunks(recipient, file, offset + chunkSize);
    };

    reader.readAsArrayBuffer(fileSlice);
    document.getElementById("file-input").value = "";
  }

  async function _handleKeyPress(e) {
    if (e.key === "Enter") sendMessage();
  }

  async function sendMessage(rec = null, msg = null) {
    const recipientInput = document.getElementById("recipientInput");
    const messageInput = document.getElementById("message-input");
    const fileInput = document.getElementById("file-input");

    let recipient = recipientInput.value.trim();
    let message = messageInput.value.trim();

    if (rec && msg) {
      recipient = rec;
      message = msg;
    }
    if (recipient && message) {
      const date = new Date().toLocaleString();
      console.log(!socket, !socket.connected, !navigator.onLine);
      if (!socket || !socket.connected || !navigator.onLine) {
        if (window.Pending) window.Pending(recipient, message, -1);
        addOfflineTextPreview(message);
        messageInput.value = "";
        return;
      }

      addMessageTo(message, date);

      const event =
        recipient === "public" ? "public message" : "private message";
      const payload =
        recipient === "public"
          ? [{ message, date }]
          : [{ to: recipient, message, date }];
      socket.emit(event, ...payload);
      messageInput.value = "";
    }

    const file = fileInput.files[0];
    if (file && recipient) {
      document.getElementById("custom-file-upload").style.backgroundColor =
        "#007bff";
      sendChunks(recipient, file, 0); // Reset offset to 0
    }
  }

  function setupSocketListeners() {
    socket.on("disconnect", () => {
      addError("Connection lost. Reconnecting...");
    });

    socket.on("private message", ({ from, time, message, profile }) => {
      addMessage(from, message, new Date(time).toLocaleString(), profile);
    });

    socket.on("public message", ({ from, time, message, profile }) => {
      addMessage(from, message, new Date(time).toLocaleString(), profile);
    });

    // Image/Video/File Handlers
    const mediaEvents = [
      "private image",
      "private video",
      "private file",
      "public image",
      "public video",
      "public file",
    ];
    mediaEvents.forEach((event) => {
      socket.on(event, ({ from, time, fileData, profile, state }) => {
        if (!state) return;
        removeUploadProgress();
        const date = new Date(time).toLocaleString();
        const type = event.includes("image")
          ? "image"
          : event.includes("video")
            ? "video"
            : "document";
        if (from === window.userInfo.username)
          embedDriveFilesTo(date, fileData, type);
        else embedDriveFiles(date, from, fileData, profile, type);
      });
    });

    socket.on("init activeUsers", ({ activeUsers, profile, moods }) => {
      const publicUrl =
        "https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg";
      active.innerHTML = "";
      BuildActiveDiv(active, "public", publicUrl); // Public room always first

      activeUsers.forEach((name, index) => {
        if (name !== "public" && name !== window.userInfo.username) {
          const mood = moods ? moods[index] : "";
          BuildActiveDiv(active, name, profile[index], mood);
        }
      });
      updateStyles();
    });

    socket.on("activeUsers", ({ operation, name, photo, mood }) => {
      if (operation === "add" || operation === "update") {
        BuildActiveDiv(active, name, photo, mood);
      } else if (operation === "remove") {
        RemoveActiveDiv(active, name);
      }
      updateStyles();
    });

    socket.on("user-typing", ({ from, to }) => {
      const currentRecipient = document.getElementById("recipientInput").value;
      if (to === "public" && currentRecipient === "public") {
        typingUsers.add(from);
        updateTypingUI();
      } else if (to === "private" && currentRecipient === from) {
        typingUsers.add(from);
        updateTypingUI();
      }
    });

    socket.on("user-stop-typing", ({ from }) => {
      typingUsers.delete(from);
      updateTypingUI();
    });

    socket.on("error", ({ error }) => {
      if (error === "999") window.loadPage("login.html", "login");
      else addError(error);
    });
  }

  // UI Helpers
  sendButton.addEventListener("click", sendMessage);
  const messageInput = document.getElementById("message-input");
  messageInput.addEventListener("keypress", _handleKeyPress);
  messageInput.addEventListener("input", () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing", {
        to: document.getElementById("recipientInput").value,
      });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      socket.emit("stop-typing", {
        to: document.getElementById("recipientInput").value,
      });
    }, 3000);
  });

  window.addEventListener("resize", updateStyles);

  // Mobile "..." actions toggle
  const moreBtn = document.getElementById("chat-more-button");
  const chatFooter = document.querySelector(".chat-footer");
  if (moreBtn && chatFooter) {
    moreBtn.addEventListener("click", () => {
      chatFooter.classList.toggle("actions-open");
    });
    document.addEventListener("click", (e) => {
      if (!chatFooter.contains(e.target)) {
        chatFooter.classList.remove("actions-open");
      }
    });
  }

  // Mood Picker Logic
  const moodModal = document.getElementById("mood-modal");
  if (moodModal) {
    M.Modal.init(moodModal);
    const moodBtn = document.getElementById("mood-btn");
    if (moodBtn) {
      moodBtn.addEventListener("click", () => {
        M.Modal.getInstance(moodModal).open();
      });
    }

    document.querySelectorAll(".mood-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const mood = opt.getAttribute("data-mood");
        socket.emit("update-mood", { mood });
        M.Modal.getInstance(moodModal).close();
        M.toast({ html: `Vibe set to ${mood}!`, classes: "rounded" });
      });
    });
  }

  function updateTypingUI() {
    const textEl = document.getElementById("typing-text");
    if (typingUsers.size > 0) {
      const names = Array.from(typingUsers);
      textEl.textContent =
        names.length > 1
          ? `${names[0]} and others are typing`
          : `${names[0]} is typing`;
      typingIndicator.style.display = "flex";
    } else {
      typingIndicator.style.display = "none";
    }
  }

  function updateStyles() {
    const isMobile = window.innerWidth < 1000;
    const listHeader = document.getElementById("list-header");
    if (listHeader) listHeader.textContent = isMobile ? "" : "Active Homies";
    const userDivs = active.children;
    for (let i = 0; i < userDivs.length; i++) {
      const div = userDivs[i];
      const h5 = div.querySelector("h5");
      const img = div.querySelector("img");
      const wrapper = div.querySelector("div");
      if (!h5) continue;
      if (isMobile) {
        div.style.width = "60px";
        div.style.height = "60px";
        div.style.margin = "0";
        div.style.justifyContent = "center";
        div.style.paddingLeft = "0";
        div.style.gap = "0";
        h5.style.display = "none";
        if (img) {
          img.style.width = "44px";
          img.style.height = "44px";
        }
        if (wrapper) {
          wrapper.style.width = "44px";
          wrapper.style.height = "44px";
        }
      } else {
        div.style.width = "85%";
        div.style.height = "70px";
        div.style.margin = "5px auto";
        div.style.justifyContent = "flex-start";
        div.style.paddingLeft = "6px";
        div.style.gap = "6px";
        h5.style.display = "";
        if (img) {
          img.style.width = "55px";
          img.style.height = "55px";
        }
        if (wrapper) {
          wrapper.style.width = "55px";
          wrapper.style.height = "55px";
        }
      }
    }
  }

  function BuildActiveDiv(activeBar, name, profile_src, mood = "") {
    if (window.userInfo.username === name) return;

    // Prevent duplicates
    RemoveActiveDiv(activeBar, name);

    const userDiv = document.createElement("div");
    userDiv.className = "active-pulse"; // Gen Z Glow
    const userNameDiv = document.createElement("h5");
    const profileImg = document.createElement("img");

    Object.assign(userDiv.style, {
      height: "70px",
      color: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "6px",
      paddingLeft: "6px",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      cursor: "pointer",
      backgroundColor: name === "public" ? "var(--accent)" : "var(--bg-item)",
      transition: "transform 0.2s ease",
      position: "relative",
    });

    if (name === "public") {
      userDiv.style.border = "1px solid var(--accent)";
      userDiv.style.opacity = "0.9";
    }

    profileImg.src = profile_src || "https://via.placeholder.com/60";
    Object.assign(profileImg.style, {
      width: "55px",
      height: "55px",
      borderRadius: "50%",
      border: "2px solid #555",
      objectFit: "cover",
    });

    // Wrap image and badge in a relative container to prevent stretching
    const imgWrapper = document.createElement("div");
    imgWrapper.style.position = "relative";
    imgWrapper.style.width = "55px";
    imgWrapper.style.height = "55px";
    imgWrapper.style.display = "flex";
    imgWrapper.style.alignItems = "center";
    imgWrapper.style.justifyContent = "center";
    imgWrapper.appendChild(profileImg);

    if (mood) {
      const moodBadge = document.createElement("div");
      moodBadge.className = "mood-badge";
      moodBadge.textContent = mood;
      imgWrapper.appendChild(moodBadge);
    }

    userDiv.addEventListener("mouseover", () => {
      userDiv.style.transform = "scale(0.95)";
    });
    userDiv.addEventListener("mouseout", () => {
      userDiv.style.transform = "scale(1)";
    });

    
    userDiv.addEventListener("click", () => {
      document.getElementById("recipientInput").value = name;
      typingUsers.clear(); // Clear typing on switch
      updateTypingUI();
      active.querySelectorAll("div").forEach((d) => {
        const head = d.querySelector("h5");
        if (head) {
          d.style.backgroundColor = "var(--bg-item)";
        }
      });
      userDiv.style.backgroundColor = "var(--accent)";
      userDiv.style.color = "#000"; // Contrast for active
      renderConversation(name);
    });

    userNameDiv.textContent = name;
    userNameDiv.style.margin = "0";
    userNameDiv.style.padding = "0";
    userNameDiv.style.fontSize = "14px";
    userNameDiv.style.fontWeight = "600";
    userNameDiv.style.overflow = "hidden";
    userNameDiv.style.textOverflow = "ellipsis";
    userNameDiv.style.whiteSpace = "nowrap";

    userDiv.appendChild(imgWrapper);
    userDiv.appendChild(userNameDiv);
    activeBar.appendChild(userDiv);
    return userDiv;
  }

  function RemoveActiveDiv(activeBar, name) {
    const divs = activeBar.querySelectorAll("div");
    for (const div of divs) {
      const h5 = div.querySelector("h5");
      if (h5 && h5.textContent === name) {
        div.remove();
        break;
      }
    }
  }

  function addMessage(from, message, time, profile, prepend = false) {
    const finalContainer = document.createElement("div");
    finalContainer.className = "final-container";

    const head = document.createElement("div");
    head.className = "time-name-container";
    head.style.marginBottom = "2px";

    const nameLabel = document.createElement("span");
    nameLabel.textContent = from;
    nameLabel.style.fontWeight = "bold";
    nameLabel.style.color = "#3498db";

    const timeLabel = document.createElement("span");
    timeLabel.textContent = ` • ${time}`;
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#777";

    head.append(nameLabel, timeLabel);

    const body = document.createElement("div");
    body.className = "message-receive-container";

    const img = document.createElement("img");
    img.src = profile;
    img.className = "receiver-profile-container";

    const msgBox = document.createElement("div");
    msgBox.className = "message-receive";
    msgBox.textContent = message;

    body.append(img, msgBox);
    finalContainer.append(head, body);
    if (prepend) {
      messagesDiv.insertBefore(finalContainer, messagesDiv.firstChild);
    } else {
      messagesDiv.appendChild(finalContainer);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function addMessageTo(message, time, prepend = false) {
    const finalContainer = document.createElement("div");
    finalContainer.className = "send-final-container";

    const timeLabel = document.createElement("div");
    timeLabel.textContent = time;
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#777";
    timeLabel.style.marginBottom = "2px";

    const body = document.createElement("div");
    body.className = "message-send-container";

    const msgBox = document.createElement("div");
    msgBox.className = "message-send";
    msgBox.textContent = message;

    body.appendChild(msgBox);
    finalContainer.append(timeLabel, body);
    if (prepend) {
      messagesDiv.insertBefore(finalContainer, messagesDiv.firstChild);
    } else {
      messagesDiv.appendChild(finalContainer);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function addError(message) {
    const err = document.createElement("div");
    err.textContent = message;
    Object.assign(err.style, {
      color: message === "Connected" ? "#2ecc71" : "#e74c3c",
      backgroundColor: "#222",
      borderRadius: "5px",
      padding: "8px",
      margin: "10px auto",
      width: "fit-content",
      textAlign: "center",
      fontSize: "13px",
    });
    messagesDiv.appendChild(err);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    setTimeout(() => {
      err.style.opacity = "0";
      err.style.transition = "opacity 1s";
      setTimeout(() => err.remove(), 1000);
    }, 3000);
  }

  function buildDrivePreview(fileId, type) {
    return window.ChatMediaPreview.buildDrivePreview(fileId, type);
  }

  function embedDriveFiles(
    time,
    from,
    file_id,
    profile,
    type = "document",
    prepend = false,
  ) {
    const container = document.createElement("div");
    container.className = "message-receive-container";
    container.style.flexDirection = "column";
    container.style.alignItems = "flex-start";
    container.style.padding = "10px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";

    const img = document.createElement("img");
    img.src = profile;
    img.style.width = "40px";
    img.style.height = "40px";
    img.style.borderRadius = "50%";

    const info = document.createElement("div");
    const nameSpan = document.createElement("b");
    nameSpan.textContent = from;
    const timeSpan = document.createElement("small");
    timeSpan.textContent = ` ${time}`;
    timeSpan.style.color = "#777";
    info.append(nameSpan, timeSpan);

    header.append(img, info);
    container.append(header, buildDrivePreview(file_id, type));
    if (prepend) {
      messagesDiv.insertBefore(container, messagesDiv.firstChild);
    } else {
      messagesDiv.appendChild(container);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function embedDriveFilesTo(
    time,
    file_id,
    type = "document",
    prepend = false,
  ) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "flex-end";
    container.style.padding = "10px";

    const timeLabel = document.createElement("small");
    timeLabel.textContent = time;
    timeLabel.style.color = "#777";
    container.append(timeLabel, buildDrivePreview(file_id, type));
    if (prepend) {
      messagesDiv.insertBefore(container, messagesDiv.firstChild);
    } else {
      messagesDiv.appendChild(container);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  // Scroll-to-top → load older chat messages
  if (messagesDiv) {
    messagesDiv.addEventListener("scroll", () => {
      if (messagesDiv.scrollTop < 10 && hasMoreHistory && !isLoadingHistory) {
        loadChatHistory(true);
      }
    });
  }

  const fileInputEl = document.getElementById("file-input");
  if (fileInputEl) {
    fileInputEl.addEventListener("change", () => {
      const uploadBtn = document.getElementById("custom-file-upload");
      if (uploadBtn) uploadBtn.style.backgroundColor = "#e67e22";
    });
  }
})();
