(async function () {
  const [
    { addMessage, addMessageTo, embedDriveFiles, embedDriveFilesTo, addOfflineTextPreview, addOfflineFilePreview, addError },
    { createUploadProgress },
    { createTypingIndicator },
    { createNotificationDrawer },
    { default: WebRTCManager },
  ] = await Promise.all([
    import("../components/chatMessage.js"),
    import("../components/uploadProgress.js"),
    import("../components/typingIndicator.js"),
    import("../components/notificationDrawer.js"),
    import("../components/webRTC.js"),
  ]);

  const chunkSize = 512 * 1024;
  const items = document.getElementById("item-list");
  const activeRoom = document.getElementById("room-list");
  const roomNameInput = document.getElementById("room-name");
  const CurrentroomLabel = document.getElementById("current-room");
  const messagesDiv = document.getElementById("chat-content");
  const videoModal = document.getElementById("video-modal");
  const container = document.getElementById("video-modal-content");

  const { addUploadProgress, updateChatProgress, removeUploadProgress } = createUploadProgress(messagesDiv);
  const { typingUsers, updateTypingUI } = createTypingIndicator(document.getElementById("room-chat-wrapper"));
  const showNotification = createNotificationDrawer();

  let typingTimer;
  let isTyping = false;
  let cachedChats = [];
  let oldestTimestamp = null;
  let hasMoreHistory = true;
  let isLoadingHistory = false;
  let invitedUsers = [];
  let debounceTimer;
  let currentRoom;
  let roomMembers = new Map();
  let liveMembers = new Map();

  let _lastPing = 0;
  async function isOnline() {
    const now = Date.now();
    if (now - _lastPing < 2000) return true;
    try {
      await fetch("/ping", { method: "HEAD", cache: "no-store" });
      _lastPing = now;
      return true;
    } catch {
      return false;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  async function init() {
    M.Modal.init(document.querySelectorAll(".modal"));

    let socket = window.socket;
    try {
      if (!socket || !socket.connected) {
        socket = io();
        window.socket = socket;
      }

      socket.on("connect", async () => {
        try {
          socket.emit("insert name", { jwtoken: Cookies.get("token") });
          addError("Connected", messagesDiv);
          const data = await window.fetchData("/api/user-rooms");
          activeRoom.innerHTML = "";
          if (data && data.rooms) {
            window.rooms = data.rooms;
            window.rooms.forEach((room) => addRoomToList(room.name));
            socket.emit("join-rooms", { rooms: data.rooms.map((r) => r.name) });
          }
          setTimeout(flushPendingQueue, 2000);
        } catch (err) {
          console.error("[Room] Failed to load rooms after connect:", err);
        }
      });

      registerSocketEvents(socket);
    } catch (err) {
      console.error("[Room] Failed to load rooms from server:", err);
      if (window.rooms) window.rooms.forEach((room) => addRoomToList(room.name));
    }

    async function flushPendingQueue() {
      if (!window.getPending || !socket || !socket.connected || !(await isOnline())) return;
      try {
        const queue = await window.getPending("room");
        for (const item of queue) {
          if (window.deletePending) await window.deletePending(item.id);
          if (item.offset >= 0) sendChunks(item.recipient, item.content, item.offset, socket);
          else sendMessage(item.recipient, item.content, true, socket);
        }
      } catch (err) {
        console.error("[Room] Failed to process pending queue:", err);
      }
    }

    const onRoomOnline = () => {
      setTimeout(flushPendingQueue, 1500);
    };
    window.addEventListener("online", onRoomOnline);
    window.eventListeners.push({ element: window, event: "online", handler: onRoomOnline });

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.eventListeners.push({ element: window, event: "resize", handler: updateLayout });
  }

  function updateLayout() {
    const isMobile = window.innerWidth < 1000;
    const listHeader = document.getElementById("list-header");
    if (listHeader) listHeader.textContent = isMobile ? "" : "Rooms";
  }

  init();

  async function handleSearch() {
    items.innerHTML = "";
    const query = document.getElementById("search").value.trim();
    if (query.length < 2) return;
    try {
      const data = await window.fetchData("/api/search", { query });
      if (data && data.querynames) {
        data.querynames.forEach((user) => {
          const list = document.createElement("div");
          list.textContent = user.name;
          list.className = "list-box";
          if (invitedUsers.includes(user.name)) list.style.backgroundColor = "#2980b9";
          list.addEventListener("click", () => {
            const idx = invitedUsers.indexOf(user.name);
            if (idx > -1) {
              invitedUsers.splice(idx, 1);
              list.style.backgroundColor = "#333";
            } else {
              invitedUsers.push(user.name);
              list.style.backgroundColor = "#2980b9";
            }
          });
          items.appendChild(list);
        });
      }
    } catch (err) {
      console.error("[RoomSearch] Error:", err);
    }
  }

  function debounce(func, delay) {
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func(...args), delay);
    };
  }

  async function handleRoomCreate() {
    const name = roomNameInput.value.trim();
    if (!name) return M.toast({ html: "Room name is required!", classes: "rounded red" });
    if (window.rooms.some((r) => r.name === name)) return M.toast({ html: "Room already exists!", classes: "rounded red" });
    window.rooms.push({ name });
    M.Modal.getInstance(document.getElementById("room-creation-modal")).close();
    window.socket.emit("create-room", { room: { name, admin: window.userInfo.username } });
    addRoomToList(name);
  }

  async function sendChunks(room, file, offset, socket) {
    if (offset === 0) window._uploadAborted = false;
    if (window._uploadAborted) return;
    if (!socket || !socket.connected || !(await isOnline())) {
      if (window.Pending) window.Pending(room, file, offset);
      if (offset === 0) addOfflineFilePreview(file, messagesDiv);
      return;
    }
    if (offset === 0) addUploadProgress(file.name);
    if (offset >= file.size) {
      updateChatProgress(100, file.name);
      socket.emit("room file complete", {
        room: { name: room, admin: window.userInfo.username },
        fileType: file.type,
        fileName: file.name,
      });
      return;
    }
    const percent = (offset / file.size) * 100;
    if (!updateChatProgress(percent, file.name)) { window._uploadAborted = true; return; }
    const slice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    reader.onload = () => {
      if (window._uploadAborted) return;
      socket.emit("room file", { fileData: reader.result });
      sendChunks(room, file, offset + chunkSize, socket);
    };
    reader.readAsArrayBuffer(slice);
  }

  async function sendMessage(rec = null, msg = null, flush = false, socket) {
    if (!socket) socket = window.socket;
    const messageInput = document.getElementById("message-input");
    const fileInputEl = document.getElementById("file-input");
    let message = messageInput.value.trim();
    let targetRoom = currentRoom;
    if (rec && msg) { targetRoom = rec; message = msg; }
    if (!targetRoom) return M.toast({ html: "Select a room first!", classes: "rounded red" });
    if (message && targetRoom) {
      const date = new Date().toLocaleString();
      if (!socket || !socket.connected || !(await isOnline())) {
        if (window.Pending) window.Pending(targetRoom, message, -1);
        addOfflineTextPreview(message, messagesDiv);
        messageInput.value = "";
      } else {
        addMessageTo(message, date, messagesDiv);
        socket.emit("room message", {
          room: { name: targetRoom, admin: window.userInfo.username },
          message,
          date,
        });
        messageInput.value = "";
      }
    }
    if (flush) return;
    const file = fileInputEl.files[0];
    if (file && targetRoom) {
      sendChunks(targetRoom, file, 0, socket);
      fileInputEl.value = "";
    }
  }

  function selectRoom(div, name) {
    activeRoom.querySelectorAll(".room-item").forEach((d) => d.classList.remove("active-room-card"));
    div.classList.add("active-room-card");
    currentRoom = name;
    CurrentroomLabel.textContent = name;
    typingUsers.clear();
    updateTypingUI();
    if (messagesDiv) messagesDiv.innerHTML = "";
    cachedChats = [];
    oldestTimestamp = null;
    hasMoreHistory = true;
    isLoadingHistory = false;
    loadRoomHistory(name);
  }

  function renderConversation() {
    if (!messagesDiv) return;
    messagesDiv.innerHTML = "";
    cachedChats.forEach((chat) => {
      const isSelf = chat.sender === window.userInfo.username;
      const timeStr = new Date(chat.timestamp).toLocaleString();
      const type = chat.type;
      if (type === "text") {
        if (isSelf) addMessageTo(chat.content, timeStr, messagesDiv);
        else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl, messagesDiv);
      } else {
        if (isSelf) embedDriveFilesTo(timeStr, chat.content, type, messagesDiv);
        else embedDriveFiles(timeStr, chat.sender, chat.content, chat.imageUrl, type, messagesDiv);
      }
    });
  }

  async function loadRoomHistory(roomName, prepend = false) {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
    try {
      const reqData = { roomName, limit: 30 };
      if (prepend && oldestTimestamp) reqData.before = oldestTimestamp;
      const data = await window.fetchData("/api/room-chats", reqData);
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
          renderConversation();
        }
      } else if (data) {
        hasMoreHistory = false;
      }
    } catch (err) {
      console.error("[Room] Failed to load room history:", err);
    } finally {
      isLoadingHistory = false;
    }
  }

  function prependConversationPage(chats) {
    if (!messagesDiv) return;
    const prevHeight = messagesDiv.scrollHeight;
    chats.forEach((chat) => {
      const isSelf = chat.sender === window.userInfo.username;
      const timeStr = new Date(chat.timestamp).toLocaleString();
      const type = chat.type;
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

  function addRoomToList(name) {
    const div = document.createElement("div");
    div.className = "room-item";
    div.textContent = name;
    div.addEventListener("mouseover", () => (div.style.transform = "scale(0.95)"));
    div.addEventListener("mouseout", () => (div.style.transform = "scale(1)"));
    div.addEventListener("click", () => selectRoom(div, name));
    activeRoom.appendChild(div);
  }

  const webrtc = new WebRTCManager(window.socket, { container, videoModal });

  async function callingModal(room, callerId, callerName) {
    if (videoModal.style.display === "flex") {
      await notificationSlider(room.name, false);
      return;
    }
    const decision = await window.incomingCall({
      callerName: callerName || callerId,
      roomName: room.name,
      timeout: 30000,
    });
    if (!decision.accepted) {
      window.socket.emit("reject-call", { to: callerId, room: room.name });
      return;
    }
    const div = getDivByTextContent(room.name);
    selectRoom(div, room.name);
    await webrtc.startVideoCall(currentRoom, liveMembers.get(currentRoom));
  }

  async function notificationSlider(name, skipBusyCheck) {
    if (!skipBusyCheck && videoModal.style.display === "flex") {
      if (name !== currentRoom) {
        const div = getDivByTextContent(name);
        if (!div) return;
        showNotification(
          `🔥 Room "<strong>${escapeHtml(name)}</strong>" is live! Wanna join?`,
          () => {
            webrtc.cleanupVideoCall();
            videoModal.style.display = "none";
            window.socket.emit("exit-video", { room: { name: currentRoom } });
            selectRoom(div, name);
            webrtc.startVideoCall(currentRoom, liveMembers.get(currentRoom));
          },
        );
      }
    }
  }

  function getDivByTextContent(text) {
    return Array.from(activeRoom.children).find((div) => div.textContent === text);
  }

  function registerSocketEvents(socket) {
    socket.on("error", ({ error }) => {
      if (error === "999") window.loadPage("login.html", "login");
      else addError(error, messagesDiv);
    });
    socket.on("disconnect", () => addError("Connection lost. Reconnecting...", messagesDiv));
    socket.on("room-created", ({ notify }) => addError(notify, messagesDiv, "green"));
    socket.on("invited", ({ notify }) => addError(notify, messagesDiv, "blue"));
    socket.on("room-info", ({ name, memberIds, onCallIds }) => {
      roomMembers.set(name, memberIds);
      liveMembers.set(name, onCallIds.filter((m) => m !== socket.id));
    });
    socket.on("update-room-info", ({ name, signal, memberIds, onCallIds }) => {
      roomMembers.set(name, memberIds);
      liveMembers.set(name, onCallIds.filter((m) => m !== socket.id));
      if (signal?.type === "init-call" && signal?.callerId !== socket.id) {
        callingModal(signal.room, signal.callerId, signal.callerName);
      } else if (signal?.type !== "init-call") {
        socket.emit("ack", { roomName: name });
      }
    });
    socket.on("room message", ({ roomName, from, time, message, profile }) => {
      if (roomName === currentRoom) {
        addMessage(from, message, new Date(time).toLocaleString(), profile, messagesDiv);
      }
    });
    socket.on("invitation", ({ name, notify }) => {
      addError(notify, messagesDiv, "orange");
      if (!window.rooms.some((r) => r.name === name)) {
        window.rooms.push({ name });
        addRoomToList(name);
      }
    });
    socket.on("handshake", async ({ id, room, signal }) => {
      if (room.name !== currentRoom) notificationSlider(room.name, false);
      await webrtc.handleHandshake(id, room, signal, currentRoom, liveMembers.get(currentRoom));
    });
    socket.on("user-typing", ({ from, to }) => {
      if (to === currentRoom) { typingUsers.add(from); updateTypingUI(); }
    });
    socket.on("user-stop-typing", ({ from }) => { typingUsers.delete(from); updateTypingUI(); });
    socket.on("room file", ({ roomName, from, time, fileData, fileType, profile }) => {
      if (roomName === currentRoom) {
        removeUploadProgress();
        const date = new Date(time).toLocaleString();
        const type = fileType?.startsWith("image/") ? "image" : fileType?.startsWith("video/") ? "video" : "document";
        if (from === window.userInfo.username) embedDriveFilesTo(date, fileData, type, messagesDiv);
        else embedDriveFiles(date, from, fileData, profile, type, messagesDiv);
      }
    });
    socket.on("exit-video", ({ id }) => webrtc.closePeerConnection(id));
    socket.on("exit-room", ({ id }) => {
      if (roomMembers.has(currentRoom)) {
        roomMembers.set(currentRoom, roomMembers.get(currentRoom).filter((m) => m !== id));
      }
      if (liveMembers.has(currentRoom)) {
        liveMembers.set(currentRoom, liveMembers.get(currentRoom).filter((m) => m !== id));
      }
      webrtc.closePeerConnection(id);
    });
    socket.on("reject-call", ({ username, id }) => {
      webrtc.closePeerConnection(id);
      M.toast({ html: "Call was declined by " + username, classes: "rounded red" });
    });
  }

  const searchInput = document.getElementById("search");
  if (searchInput) searchInput.addEventListener("input", debounce(handleSearch, 400));

  document.getElementById("create-room")?.addEventListener("click", handleRoomCreate);

  document.getElementById("invite-user")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentRoom) return M.toast({ html: "Select a room!", classes: "rounded" });
    if (invitedUsers.length === 0) return M.toast({ html: "Select users to invite!", classes: "rounded" });
    window.socket.emit("invite", {
      room: { name: currentRoom, admin: window.userInfo.username },
      usernames: invitedUsers,
    });
    M.Modal.getInstance(document.getElementById("search-modal")).close();
  });

  document.getElementById("send-button")?.addEventListener("click", () => sendMessage());
  document.getElementById("message-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("message-input")?.addEventListener("input", () => {
    if (!isTyping && currentRoom) { isTyping = true; window.socket.emit("typing", { to: currentRoom }); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      if (currentRoom) window.socket.emit("stop-typing", { to: currentRoom });
    }, 3000);
  });

  if (messagesDiv) {
    messagesDiv.addEventListener("scroll", () => {
      if (messagesDiv.scrollTop < 10 && hasMoreHistory && !isLoadingHistory && currentRoom) {
        loadRoomHistory(currentRoom, true);
      }
    });
  }

  const moreBtn = document.getElementById("chat-more-button");
  const chatFooter = document.querySelector(".chat-footer");
  if (moreBtn && chatFooter) {
    moreBtn.addEventListener("click", () => chatFooter.classList.toggle("actions-open"));
    document.addEventListener("click", (e) => {
      if (!chatFooter.contains(e.target)) chatFooter.classList.remove("actions-open");
    });
  }

  document.getElementById("mood-btn")?.addEventListener("click", () => {
    M.toast({ html: "Vibe features are available on the Chat page!", classes: "rounded orange" });
  });

  document.getElementById("video-call-btn")?.addEventListener("click", () => {
    webrtc.startVideoCall(currentRoom, liveMembers.get(currentRoom));
  });

  document.getElementById("exit-video")?.addEventListener("click", () => {
    webrtc.cleanupVideoCall();
    videoModal.style.display = "none";
    window.socket.emit("exit-video", { room: { name: currentRoom } });
  });

  const fileInput = document.getElementById("file-input");
  function onFileChange() {
    const uploadBtn = document.getElementById("custom-file-upload");
    if (uploadBtn) uploadBtn.style.backgroundColor = "#e67e22";
  }
  if (fileInput) {
    fileInput.addEventListener("change", onFileChange);
    window.eventListeners.push({ element: fileInput, event: "change", handler: onFileChange });
  }

  window.eventListeners.push({ element: window, event: "resize", handler: () => webrtc.updateStyles() });
})();
