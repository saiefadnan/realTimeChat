(async function () {
  const [
    { addMessage, addMessageTo, embedDriveFiles, embedDriveFilesTo, addOfflineTextPreview, addOfflineFilePreview, addError },
    { createUploadProgress },
    { createTypingIndicator },
  ] = await Promise.all([
    import("../components/chatMessage.js"),
    import("../components/uploadProgress.js"),
    import("../components/typingIndicator.js"),
  ]);

  const chunkSize = 512 * 1024;
  let _uploadProgressEl = null;
  window._uploadAborted = false;
  const active = document.getElementById("active");
  const sendButton = document.getElementById("send-button");
  const messagesDiv = document.getElementById("chat-content");
  const chatContainer = document.getElementById("chat-container");

  const { addUploadProgress, updateChatProgress, removeUploadProgress } = createUploadProgress(messagesDiv);
  const { typingUsers, updateTypingUI } = createTypingIndicator(chatContainer);

  let typingTimer;
  let isTyping = false;
  let cachedChats = [];
  let oldestTimestamp = null;
  let hasMoreHistory = true;
  let isLoadingHistory = false;

  let _lastPing = 0;
  async function isOnline() {
    const now = Date.now();
    if (now - _lastPing < 2000) return true;
    try {
      await fetch("/ping", { method: "HEAD", cache: "no-store" });
      _lastPing = now;
      return true;
    } catch { return false; }
  }

  async function loadChatHistory(prepend = false) {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
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
      } else if (data) hasMoreHistory = false;
    } catch (err) {
      console.error("[Chat] Failed to load chat history:", err);
      addError("Failed to load chat history.", messagesDiv);
    } finally { isLoadingHistory = false; }
  }

  function renderConversation(recipientName) {
    if (messagesDiv) messagesDiv.innerHTML = "";
    cachedChats.forEach((chat) => {
      const isSelf = chat.sender === window.userInfo.username;
      const timeStr = new Date(chat.timestamp).toLocaleString();
      const isPublic = recipientName === "public" && chat.receiver === "public";
      const isPrivate = recipientName !== "public" && chat.receiver !== "public" &&
        ((chat.sender === window.userInfo.username && chat.receiver === recipientName) ||
         (chat.sender === recipientName && chat.receiver === window.userInfo.username));
      if (!isPublic && !isPrivate) return;
      if (isSelf) {
        if (chat.type !== "text") embedDriveFilesTo(timeStr, chat.content, chat.type, messagesDiv);
        else addMessageTo(chat.content, timeStr, messagesDiv);
      } else {
        if (chat.type !== "text") embedDriveFiles(timeStr, chat.sender, chat.content, chat.imageUrl, chat.type, messagesDiv);
        else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl, messagesDiv);
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
      const isPublic = recipientName === "public" && chat.receiver === "public";
      const isPrivate = recipientName !== "public" && chat.receiver !== "public" &&
        ((chat.sender === window.userInfo.username && chat.receiver === recipientName) ||
         (chat.sender === recipientName && chat.receiver === window.userInfo.username));
      if (!isPublic && !isPrivate) return;
      if (type === "text") {
        if (isSelf) addMessageTo(chat.content, timeStr, messagesDiv, true);
        else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl, messagesDiv, true);
      } else {
        if (isSelf) embedDriveFilesTo(timeStr, chat.content, type, messagesDiv, true);
        else embedDriveFiles(timeStr, chat.sender, chat.content, chat.imageUrl, type, messagesDiv, true);
      }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight - prevHeight;
  }

  let socket;
  async function connectWebSocket() {
    socket = io();
    window.socket = socket;

    async function flushPendingQueue() {
      if (!window.getPending || !socket || !socket.connected || !(await isOnline())) return;
      try {
        const queue = await window.getPending("chat");
        for (const item of queue) {
          if (window.deletePending) await window.deletePending(item.id);
          if (item.offset >= 0) sendChunks(item.recipient, item.content, item.offset);
          else sendMessage(item.recipient, item.content, true);
        }
      } catch (err) { console.error("[Chat] Failed to process pending queue:", err); }
    }

    socket.on("connect", () => {
      socket.emit("insert name", { jwtoken: Cookies.get("token") });
      addError("Connected", messagesDiv);
      setTimeout(flushPendingQueue, 2000);
    });

    const onChatOnline = () => setTimeout(flushPendingQueue, 1500);
    window.addEventListener("online", onChatOnline);
    window.eventListeners.push({ element: window, event: "online", handler: onChatOnline });

    setupSocketListeners();
  }

  function addPicture(picture) {
    if (!picture) return;
    document.querySelectorAll(".circle.responsive-img").forEach((img) => { img.src = picture; });
  }

  async function getUserInfo() {
    try {
      const data = await window.fetchData("/api/userData", { token: Cookies.get("token") });
      if (data?.userinfo) {
        window.setUserInfo(data.userinfo.username, data.userinfo.imageurl);
        addPicture(data.userinfo.imageurl);
      }
    } catch (err) { console.error("[Chat] Failed to fetch user info:", err); }
  }

  if (Cookies.get("token")) {
    const recipientInput = document.getElementById("recipientInput");
    if (recipientInput) recipientInput.value = "public";
    await getUserInfo();
    await connectWebSocket();
    oldestTimestamp = null;
    hasMoreHistory = true;
    isLoadingHistory = false;
    await loadChatHistory();
    socket.emit("show active-users");
  }

  async function sendChunks(recipient, file, offset) {
    if (window._uploadAborted) return;
    if (!socket || !socket.connected || !(await isOnline())) {
      if (window.Pending) window.Pending(recipient, file, offset);
      if (offset === 0) addOfflineFilePreview(file, messagesDiv);
      return;
    }
    if (offset === 0) addUploadProgress(file.name);
    if (offset >= file.size) {
      updateChatProgress(100, file.name);
      socket.emit("complete", { to: recipient, fileType: file.type, fileName: file.name });
      if (window.clearPending) window.clearPending();
      return;
    }
    const percent = (offset / file.size) * 100;
    if (!updateChatProgress(percent, file.name)) { window._uploadAborted = true; return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (window._uploadAborted) return;
      const payload = { fileData: reader.result, fileType: file.type, fileName: file.name };
      if (recipient !== "public") payload.to = recipient;
      let eventName;
      if (file.type.startsWith("image/")) eventName = recipient === "public" ? "public image" : "private image";
      else if (file.type.startsWith("video/")) eventName = recipient === "public" ? "public video" : "private video";
      else eventName = recipient === "public" ? "public file" : "private file";
      socket.emit(eventName, payload);
      sendChunks(recipient, file, offset + chunkSize);
    };
    reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
  }

  async function sendMessage(rec = null, msg = null, flush = false) {
    const recipientInput = document.getElementById("recipientInput");
    const messageInput = document.getElementById("message-input");
    const fileInput = document.getElementById("file-input");
    let recipient = recipientInput.value.trim();
    let message = messageInput.value.trim();
    if (rec && msg) { recipient = rec; message = msg; }
    if (recipient && message) {
      const date = new Date().toLocaleString();
      if (!socket || !socket.connected || !(await isOnline())) {
        if (window.Pending) window.Pending(recipient, message, -1);
        addOfflineTextPreview(message, messagesDiv);
        messageInput.value = "";
      } else {
        addMessageTo(message, date, messagesDiv);
        const event = recipient === "public" ? "public message" : "private message";
        const payload = recipient === "public" ? [{ message, date }] : [{ to: recipient, message, date }];
        socket.emit(event, ...payload);
        messageInput.value = "";
      }
    }
    if (flush) return;
    const file = fileInput.files[0];
    if (file && recipient) {
      sendChunks(recipient, file, 0);
      fileInput.value = "";
    }
  }

  function setupSocketListeners() {
    socket.on("disconnect", () => addError("Connection lost. Reconnecting...", messagesDiv));
    socket.on("private message", ({ from, time, message, profile }) => {
      addMessage(from, message, new Date(time).toLocaleString(), profile, messagesDiv);
    });
    socket.on("public message", ({ from, time, message, profile }) => {
      addMessage(from, message, new Date(time).toLocaleString(), profile, messagesDiv);
    });

    ["private image","private video","private file","public image","public video","public file"].forEach((event) => {
      socket.on(event, ({ from, time, fileData, profile, state }) => {
        if (!state) return;
        removeUploadProgress();
        const date = new Date(time).toLocaleString();
        const type = event.includes("image") ? "image" : event.includes("video") ? "video" : "document";
        if (from === window.userInfo.username) embedDriveFilesTo(date, fileData, type, messagesDiv);
        else embedDriveFiles(date, from, fileData, profile, type, messagesDiv);
      });
    });

    socket.on("init activeUsers", ({ activeUsers, profile, moods }) => {
      const publicUrl = "https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg";
      active.innerHTML = "";
      BuildActiveDiv(active, "public", publicUrl);
      activeUsers.forEach((name, index) => {
        if (name !== "public" && name !== window.userInfo.username) {
          BuildActiveDiv(active, name, profile[index], moods ? moods[index] : "");
        }
      });
      updateStyles();
    });

    socket.on("activeUsers", ({ operation, name, photo, mood }) => {
      if (operation === "add" || operation === "update") BuildActiveDiv(active, name, photo, mood);
      else if (operation === "remove") RemoveActiveDiv(active, name);
      updateStyles();
    });

    socket.on("user-typing", ({ from, to }) => {
      const currentRecipient = document.getElementById("recipientInput").value;
      if ((to === "public" && currentRecipient === "public") || (to === "private" && currentRecipient === from)) {
        typingUsers.add(from);
        updateTypingUI();
      }
    });
    socket.on("user-stop-typing", ({ from }) => { typingUsers.delete(from); updateTypingUI(); });
    socket.on("error", ({ error }) => {
      if (error === "999") window.loadPage("login.html", "login");
      else addError(error, messagesDiv);
    });
  }

  sendButton.addEventListener("click", sendMessage);
  const messageInput = document.getElementById("message-input");
  messageInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
  messageInput.addEventListener("input", () => {
    if (!isTyping) { isTyping = true; socket.emit("typing", { to: document.getElementById("recipientInput").value }); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      socket.emit("stop-typing", { to: document.getElementById("recipientInput").value });
    }, 3000);
  });

  window.addEventListener("resize", updateStyles);

  const moreBtn = document.getElementById("chat-more-button");
  const chatFooter = document.querySelector(".chat-footer");
  if (moreBtn && chatFooter) {
    moreBtn.addEventListener("click", () => chatFooter.classList.toggle("actions-open"));
    document.addEventListener("click", (e) => {
      if (!chatFooter.contains(e.target)) chatFooter.classList.remove("actions-open");
    });
  }

  const moodModal = document.getElementById("mood-modal");
  if (moodModal) {
    M.Modal.init(moodModal);
    document.getElementById("mood-btn")?.addEventListener("click", () => M.Modal.getInstance(moodModal).open());
    document.querySelectorAll(".mood-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        socket.emit("update-mood", { mood: opt.getAttribute("data-mood") });
        M.Modal.getInstance(moodModal).close();
        M.toast({ html: "Vibe set!", classes: "rounded" });
      });
    });
  }

  function updateStyles() {
    const isMobile = window.innerWidth < 1000;
    const listHeader = document.getElementById("list-header");
    if (listHeader) listHeader.textContent = isMobile ? "" : "Active Homies";
    for (const div of active.children) {
      const h5 = div.querySelector("h5");
      const img = div.querySelector("img");
      const wrapper = div.querySelector("div");
      if (!h5) continue;
      if (isMobile) {
        Object.assign(div.style, { width: "60px", height: "60px", margin: "0", justifyContent: "center", paddingLeft: "0", gap: "0" });
        h5.style.display = "none";
        if (img) { img.style.width = "44px"; img.style.height = "44px"; }
        if (wrapper) { wrapper.style.width = "44px"; wrapper.style.height = "44px"; }
      } else {
        Object.assign(div.style, { width: "85%", height: "70px", margin: "5px auto", justifyContent: "flex-start", paddingLeft: "6px", gap: "6px" });
        h5.style.display = "";
        if (img) { img.style.width = "55px"; img.style.height = "55px"; }
        if (wrapper) { wrapper.style.width = "55px"; wrapper.style.height = "55px"; }
      }
    }
  }

  function BuildActiveDiv(activeBar, name, profileSrc, mood = "") {
    if (window.userInfo.username === name) return;
    RemoveActiveDiv(activeBar, name);
    const userDiv = document.createElement("div");
    userDiv.className = "active-pulse";
    const userNameDiv = document.createElement("h5");
    const profileImg = document.createElement("img");
    Object.assign(userDiv.style, {
      height: "70px", color: "#000", display: "flex", alignItems: "center",
      justifyContent: "flex-start", gap: "6px", paddingLeft: "6px",
      border: "1px solid var(--border)", borderRadius: "16px", cursor: "pointer",
      backgroundColor: name === "public" ? "var(--accent)" : "var(--bg-item)",
      transition: "transform 0.2s ease", position: "relative",
    });
    if (name === "public") { userDiv.style.border = "1px solid var(--accent)"; userDiv.style.opacity = "0.9"; }
    profileImg.src = profileSrc || "https://via.placeholder.com/60";
    Object.assign(profileImg.style, {
      width: "55px", height: "55px", borderRadius: "50%", border: "2px solid #555", objectFit: "cover",
    });
    const imgWrapper = document.createElement("div");
    Object.assign(imgWrapper.style, { position: "relative", width: "55px", height: "55px", display: "flex", alignItems: "center", justifyContent: "center" });
    imgWrapper.appendChild(profileImg);
    if (mood) {
      const moodBadge = document.createElement("div");
      moodBadge.className = "mood-badge";
      moodBadge.textContent = mood;
      imgWrapper.appendChild(moodBadge);
    }
    userDiv.addEventListener("mouseover", () => { userDiv.style.transform = "scale(0.95)"; });
    userDiv.addEventListener("mouseout", () => { userDiv.style.transform = "scale(1)"; });
    userDiv.addEventListener("click", () => {
      document.getElementById("recipientInput").value = name;
      typingUsers.clear();
      updateTypingUI();
      active.querySelectorAll("div").forEach((d) => {
        const head = d.querySelector("h5");
        if (head) d.style.backgroundColor = "var(--bg-item)";
      });
      userDiv.style.backgroundColor = "var(--accent)";
      userDiv.style.color = "#000";
      renderConversation(name);
    });
    userNameDiv.textContent = name;
    Object.assign(userNameDiv.style, { margin: "0", padding: "0", fontSize: "14px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
    userDiv.appendChild(imgWrapper);
    userDiv.appendChild(userNameDiv);
    activeBar.appendChild(userDiv);
  }

  function RemoveActiveDiv(activeBar, name) {
    for (const div of activeBar.querySelectorAll("div")) {
      const h5 = div.querySelector("h5");
      if (h5 && h5.textContent === name) { div.remove(); break; }
    }
  }

  if (messagesDiv) {
    messagesDiv.addEventListener("scroll", () => {
      if (messagesDiv.scrollTop < 10 && hasMoreHistory && !isLoadingHistory) loadChatHistory(true);
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
