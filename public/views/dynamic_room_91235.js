(async function () {
  let socket = window.socket;
  const chunkSize = 512 * 1024;
  let _uploadProgressEl = null;
  const items = document.getElementById("item-list");
  const activeRoom = document.getElementById("room-list");
  const roomNameInput = document.getElementById("room-name");
  const CurrentroomLabel = document.getElementById("current-room");
  const messagesDiv = document.getElementById("chat-content");
  const videoModal = document.getElementById("video-modal");
  const container = document.getElementById("video-modal-content");
  // Typing storage
  let typingTimer;
  let isTyping = false;
  const typingUsers = new Set();
  let typingIndicator;
  const peerConnections = new Map();
  let joinedIds = [];

  window.addEventListener("resize", updateStyles);
  function addVideo(id) {
    if (document.getElementById(`remoteVideo${id}`)) return null;
    const videoId = `remoteVideo${id}`;
    joinedIds.push(id);
    if (!container) return null;
    container.insertAdjacentHTML(
      "beforeend",
      `<video id="${videoId}" class="video-modal-child" autoplay playsinline></video>`,
    );
    const video = document.getElementById(videoId);
    console.log("[WebRTC] addVideo created:", videoId);
    updateStyles();
    return video;
  }

  function removeVideo(id) {
    const videoId = `remoteVideo${id}`;
    const indx = joinedIds.indexOf(id);
    if (indx !== -1) {
      joinedIds.splice(indx, 1);
    }
    const video = document.getElementById(videoId);
    if (video) {
      video.remove();
      console.log("[WebRTC] removeVideo called:", videoId);
      updateStyles();
    }
  }

  function getDivByTextContent(text) {
    return Array.from(activeRoom.children).find(
      (div) => div.textContent === text,
    );
  }

  function updateStyles() {
    const count = document.querySelectorAll(".video-modal-child").length;
    const isTablet = window.innerWidth < 1000;
    const isMobile = window.innerWidth < 700;
    if (isMobile) {
      container.style.gridTemplateColumns = "1fr";
      return;
    }
    if (isTablet) {
      container.style.gridTemplateColumns = "1fr 1fr";
      return;
    }
    if (count === 1) {
      container.style.gridTemplateColumns = "1fr";
    } else if (count === 2) {
      container.style.gridTemplateColumns = "1fr 1fr";
    } else if (count <= 4) {
      container.style.gridTemplateColumns = "1fr 1fr";
    } else if (count <= 9) {
      container.style.gridTemplateColumns = "1fr 1fr 1fr";
    } else {
      container.style.gridTemplateColumns = "repeat(4, 1fr)";
    }
  }

  // Only two STUN servers — avoids browser warning and broken TURN
  const iceConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  const peerConfig = { ...iceConfiguration, offerExtmapAllowMixed: true };

  let localStream = null;
  let roomMembers = [];
  const pendingCandidates = new Map(); // id -> Array of candidates
  let currentRoom;
  let cachedChats = [];
  let oldestTimestamp = null;
  let hasMoreHistory = true;
  let isLoadingHistory = false;
  let invitedUsers = [];
  let debounceTimer;

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

  async function init() {
    const modalElems = document.querySelectorAll(".modal");
    M.Modal.init(modalElems);

    // UI Setup: Typing Indicator Box
    const chatWrapper = document.getElementById("room-chat-wrapper");
    typingIndicator = document.createElement("div");
    typingIndicator.className = "typing-indicator-box";
    typingIndicator.style.display = "none";
    typingIndicator.innerHTML =
      '<span id="typing-text"></span><div class="typing-dots"><span></span><span></span><span></span></div>';
    if (chatWrapper) {
      chatWrapper.insertBefore(
        typingIndicator,
        document.querySelector(".chat-footer"),
      );
    }

    try {
      // Initialize socket connection if missing
      if (!socket || !socket.connected) {
        socket = io();
        window.socket = socket;

        socket.on("connect", async () => {
          try {
            console.log("[Room Socket] Connected");
            socket.emit("insert name", { jwtoken: Cookies.get("token") });
            addError("Connected");
            setTimeout(flushPendingQueue, 2000);
          } catch (err) {
            console.error("[Room] Failed to load rooms after connect:", err);
          }
        });

        const data = await window.fetchData("/api/user-rooms");
        activeRoom.innerHTML = "";
        if (data && data.rooms) {
          window.rooms = data.rooms;
          window.rooms.forEach((room) => addRoomToList(room.name));
          socket.emit("join-rooms", {
            rooms: data.rooms.map((r) => r.name),
          });
        }
      } else {
        socket.on("connect", async () => {
          console.log("[Room Socket] Connected");
          socket.emit("insert name", { jwtoken: Cookies.get("token") });
          addError("Connected");
          setTimeout(flushPendingQueue, 2000);
        });
      }

      registerSocketEvents();
    } catch (err) {
      console.error("[Room] Failed to load rooms from server:", err);
      if (window.rooms) {
        window.rooms.forEach((room) => addRoomToList(room.name));
      }
    }

    async function flushPendingQueue() {
      if (
        !window.getPending ||
        !socket ||
        !socket.connected ||
        !(await isOnline())
      )
        return;
      try {
        const queue = await window.getPending("room");
        for (const item of queue) {
          if (window.deletePending) await window.deletePending(item.id);
          if (item.offset >= 0) {
            sendChunks(item.recipient, item.content, item.offset);
          } else {
            sendMessage(item.recipient, item.content, true);
          }
        }
      } catch (err) {
        console.error("[Room] Failed to process pending queue:", err);
      }
    }

    const onRoomOnline = () => {
      console.log("[Room] Network restored — flushing pending queue");
      setTimeout(flushPendingQueue, 1500);
    };
    window.addEventListener("online", onRoomOnline);
    window.eventListeners.push({
      element: window,
      event: "online",
      handler: onRoomOnline,
    });
    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.eventListeners.push({
      element: window,
      event: "resize",
      handler: updateLayout,
    });
  }

  init();

  function updateLayout() {
    const isMobile = window.innerWidth < 1000;
    const listHeader = document.getElementById("list-header");
    if (listHeader) listHeader.textContent = isMobile ? "" : "Rooms";
  }

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
          if (invitedUsers.includes(user.name)) {
            list.style.backgroundColor = "#2980b9";
          }
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

  function addError(message, color) {
    const err = document.createElement("div");
    err.textContent = message;
    Object.assign(err.style, {
      color:
        color === "green"
          ? "#2ecc71"
          : color === "blue"
            ? "#3498db"
            : message === "Connected"
              ? "#2ecc71"
              : "#e74c3c",
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

  function debounce(func, delay) {
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func(...args), delay);
    };
  }

  async function handleRoomCreate() {
    const name = roomNameInput.value.trim();
    if (!name)
      return M.toast({
        html: "Room name is required!",
        classes: "rounded red",
      });

    if (window.rooms.some((r) => r.name === name)) {
      return M.toast({ html: "Room already exists!", classes: "rounded red" });
    }

    window.rooms.push({ name });
    const inst = M.Modal.getInstance(
      document.getElementById("room-creation-modal"),
    );
    inst.close();

    socket.emit("create-room", {
      room: { name, admin: window.userInfo.username },
    });
    addRoomToList(name);
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
    const chatContent = document.getElementById("chat-content");
    if (!chatContent) return;

    const finalContainer = document.createElement("div");
    finalContainer.style.display = "flex";
    finalContainer.style.flexDirection = "column";
    finalContainer.style.alignItems = "flex-end";
    finalContainer.style.padding = "10px";

    const timeLabel = document.createElement("small");
    timeLabel.textContent = new Date().toLocaleString() + " • Offline Queue";
    timeLabel.style.color = "#e67e22";

    const msgBox = document.createElement("div");
    msgBox.className = "message-send";
    msgBox.style.border = "1px dashed #e67e22";

    if (file.type && file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
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

    finalContainer.append(timeLabel, msgBox);
    chatContent.appendChild(finalContainer);
    chatContent.scrollTop = chatContent.scrollHeight;
  }

  async function sendChunks(room, file, offset) {
    if (offset === 0) {
      window._uploadAborted = false;
    }

    if (window._uploadAborted) return;

    if (!socket || !socket.connected || !(await isOnline())) {
      if (window.Pending) window.Pending(room, file, offset);
      if (offset === 0) addOfflineFilePreview(file);
      return;
    }

    if (offset === 0) {
      addUploadProgress(file.name);
    }

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
    const cont = updateChatProgress(percent, file.name);
    if (!cont) {
      window._uploadAborted = true;
      return;
    }

    const slice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    reader.onload = () => {
      if (window._uploadAborted) return;
      socket.emit("room file", { fileData: reader.result });
      sendChunks(room, file, offset + chunkSize);
    };
    reader.readAsArrayBuffer(slice);
  }

  async function sendMessage(rec = null, msg = null, flush = false) {
    const messageInput = document.getElementById("message-input");
    const fileInputEl = document.getElementById("file-input");
    let message = messageInput.value.trim();
    let targetRoom = currentRoom;

    if (rec && msg) {
      targetRoom = rec;
      message = msg;
    }
    if (!targetRoom) {
      return M.toast({
        html: "Select a room first!",
        classes: "rounded red",
      });
    }
    if (message && targetRoom) {
      const date = new Date().toLocaleString();

      if (!socket || !socket.connected || !(await isOnline())) {
        if (window.Pending) window.Pending(targetRoom, message, -1);
        addOfflineTextPreview(message);
        messageInput.value = "";
      } else {
        addMessageTo(message, date);
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
      document.getElementById("custom-file-upload").style.backgroundColor =
        "#2ecc71";
      sendChunks(targetRoom, file, 0);
      fileInputEl.value = "";
      document.getElementById("custom-file-upload").style.backgroundColor = "";
    }
  }

  function selectRoom(div, name) {
    activeRoom.querySelectorAll(".room-item").forEach((d) => {
      d.classList.remove("active-room-card");
    });
    div.classList.add("active-room-card");
    currentRoom = name;
    CurrentroomLabel.textContent = `Room: ${name}`;

    // Clear typing indicator and old messages on room switch
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
        if (isSelf) addMessageTo(chat.content, timeStr);
        else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl);
      } else {
        if (isSelf) embedDriveFilesTo(timeStr, chat.content, type);
        else
          embedDriveFiles(
            timeStr,
            chat.sender,
            chat.content,
            chat.imageUrl,
            type,
          );
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

  function addRoomToList(name) {
    const div = document.createElement("div");
    div.className = "room-item";
    div.textContent = name;

    div.addEventListener(
      "mouseover",
      () => (div.style.transform = "scale(0.95)"),
    );
    div.addEventListener("mouseout", () => (div.style.transform = "scale(1)"));
    div.addEventListener("click", () => selectRoom(div, name));

    activeRoom.appendChild(div);
  }

  // Shared robust ontrack — handles both e.streams[0] and bare track fallback
  function setupOnTrack(peerConnection, remoteVideo) {
    peerConnection.ontrack = (e) => {
      console.log(
        "[WebRTC] ontrack fired:",
        e.track.kind,
        "streams:",
        e.streams.length,
        "target:",
        remoteVideo.id,
      );

      const incomingStream = e.streams && e.streams[0];

      if (incomingStream) {
        console.log(
          "[WebRTC] incoming stream tracks:",
          incomingStream.getTracks().map((t) => t.kind),
        );
        if (remoteVideo.srcObject !== incomingStream) {
          remoteVideo.srcObject = incomingStream;
          console.log("[WebRTC] srcObject set on", remoteVideo.id);
        }
      } else {
        let inbound = remoteVideo.srcObject;
        if (!(inbound instanceof MediaStream)) {
          inbound = new MediaStream();
          remoteVideo.srcObject = inbound;
        }
        if (!inbound.getTracks().includes(e.track)) {
          inbound.addTrack(e.track);
        }
        console.log("[WebRTC] bare track added to", remoteVideo.id);
      }

      clearTimeout(remoteVideo._playDebounce);
      remoteVideo._playDebounce = setTimeout(() => {
        console.log(
          "[WebRTC] calling play() on",
          remoteVideo.id,
          "muted:",
          remoteVideo.muted,
          "srcObject:",
          !!remoteVideo.srcObject,
        );
        remoteVideo.play().catch((err) => {
          if (err.name === "AbortError") return;
          console.warn("[WebRTC] autoplay blocked, retrying muted:", err);
          remoteVideo.muted = true;
          remoteVideo
            .play()
            .catch((e2) =>
              console.error("[WebRTC] play() failed even muted:", e2),
            );
        });
      }, 50);
    };
  }

  function setupICELogging(pc) {
    pc.oniceconnectionstatechange = () => {
      console.log("[ICE state]", pc.iceConnectionState);
    };
  }

  function closePeerConnection(id) {
    const pc = peerConnections.get(id);
    if (pc) {
      try {
        pc.close();
      } catch (e) {
        console.warn("[WebRTC] close peer pc error:", e);
      }
      peerConnections.delete(id);
    }
    pendingCandidates.delete(id);
    removeVideo(id);
  }

  function getOrCreatePeerConnection(id, stream) {
    let pc = peerConnections.get(id);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
    }
    pc = new RTCPeerConnection(peerConfig);
    peerConnections.set(id, pc);
    setupICELogging(pc);

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }
    return pc;
  }

  function cleanupVideoCall() {
    if (localStream) {
      try {
        localStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      localStream = null;
    }
    const localVideo = document.getElementById("localVideo");
    if (localVideo) {
      localVideo.srcObject = null;
    }
    for (const [id, pc] of peerConnections) {
      try {
        pc.close();
      } catch (e) {
        console.warn("[WebRTC] cleanup pc close error:", e);
      }
    }
    peerConnections.clear();
    pendingCandidates.clear();
    joinedIds = [];
    if (container) {
      const existing = container.querySelectorAll(
        ".video-modal-child:not(#localVideo)",
      );
      existing.forEach((el) => el.remove());
    }
    updateStyles();
  }

  function closeExistingConnection() {
    // Left as legacy compatibility stub
  }

  // WebRTC Logic
  async function startVideoCall(excludeIds) {
    if (!currentRoom) {
      return M.toast({ html: "Select a room first!", classes: "rounded" });
    }
    const localVideo = document.getElementById("localVideo");
    if (excludeIds.length === 0) {
      cleanupVideoCall();
    }
    try {
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideo.srcObject = localStream;
      }
      for (const id of roomMembers) {
        if (joinedIds.includes(id) || excludeIds.includes(id)) continue;
        const remoteVideo = addVideo(id);
        const peerConnection = getOrCreatePeerConnection(id, localStream);

        setupOnTrack(peerConnection, remoteVideo);

        peerConnection.onicecandidate = (e) => {
          if (e.candidate && peerConnections.get(id) === peerConnection) {
            socket.emit("handshake", {
              id: socket.id,
              to: id,
              room: { name: currentRoom },
              signal: { type: "candidate", candidate: e.candidate },
              excludeIds: excludeIds,
            });
          }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("handshake", {
          id: socket.id,
          to: id,
          room: { name: currentRoom },
          signal: offer,
          excludeIds: excludeIds,
        });
      }
      videoModal.style.display = "flex";
      M.toast({ html: "Calling room members...", classes: "rounded blue" });
      updateStyles();
    } catch (err) {
      console.error("[WebRTC] Failed to start call:", err);
      M.toast({ html: "Camera/mic access denied", classes: "rounded red" });
    }
  }

  async function receiveVideoCall(id, name, signal, skipBusyCheck) {
    const localVideo = document.getElementById("localVideo");

    if (!skipBusyCheck && videoModal.style.display === "flex") {
      if (name !== currentRoom) {
        const div = getDivByTextContent(name);
        if (!div) {
          console.warn(`[WebRTC] Room "${name}" not found in room list`);
          return;
        }
        showNotification(
          `🔥 Room "<strong>${escapeHtml(name)}</strong>" is live! Wanna join?`,
          () => {
            const oldRoom = currentRoom;
            socket.emit("exit-video", { room: { name: oldRoom } });
            cleanupVideoCall();
            selectRoom(div, name);
            receiveVideoCall(id, name, signal, true);
          },
        );
        return;
      }
    }

    const div = getDivByTextContent(name);
    if (!div) {
      console.warn(`[WebRTC] Room "${name}" not found in room list`);
      return;
    }
    selectRoom(div, name);
    const remoteVideo = addVideo(id);
    try {
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideo.srcObject = localStream;
      }

      const peerConnection = getOrCreatePeerConnection(id, localStream);

      setupOnTrack(peerConnection, remoteVideo);

      peerConnection.onicecandidate = (e) => {
        if (e.candidate && peerConnections.get(id) === peerConnection) {
          socket.emit("handshake", {
            id: socket.id,
            to: id,
            room: { name: currentRoom },
            signal: { type: "candidate", candidate: e.candidate },
          });
        }
      };

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal),
      );
      console.log("[WebRTC] remote description (offer) set");
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("[WebRTC] answer created and sent");

      const candidates = pendingCandidates.get(id) || [];
      for (const c of candidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(c));
        } catch (_) {}
      }
      pendingCandidates.delete(id);

      socket.emit("handshake", {
        id: socket.id,
        to: id,
        room: { name: currentRoom },
        signal: answer,
      });
      videoModal.style.display = "flex";
      M.toast({ html: "Answering Call...", classes: "rounded blue" });
      updateStyles();
    } catch (err) {
      console.error("[WebRTC] Failed to receive call:", err);
      M.toast({ html: "Failed to connect video call", classes: "rounded red" });
    }
  }

  // ── Notification Drawer ───────────────────────────────────────────────
  const showNotification = (() => {
    const style = document.createElement("style");
    style.textContent =
      ".nd-item.nd-out{transform:translateX(120%)!important;opacity:0!important;}.nd-item{will-change:transform,opacity;}";
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "notification-drawer";
    container.style.cssText =
      "position:fixed;top:16px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(container);

    const notifications = [];
    const GAP = 8;
    const DURATION = 6000;

    function layout() {
      let top = 0;
      for (const n of notifications) {
        n.el.style.top = top + "px";
        top += n.el.offsetHeight + GAP;
      }
    }

    function remove(entry) {
      const idx = notifications.indexOf(entry);
      if (idx !== -1) notifications.splice(idx, 1);
      entry.el.classList.add("nd-out");
      setTimeout(() => {
        entry.el.remove();
        layout();
      }, 300);
    }

    return function show(msg, action) {
      const el = document.createElement("div");
      el.className = "nd-item";
      el.style.cssText =
        "position:relative;pointer-events:auto;background:#1565C0;color:#fff;padding:14px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);font-size:14px;line-height:1.5;display:flex;align-items:center;gap:14px;max-width:380px;transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;";

      const body = document.createElement("span");
      body.innerHTML = msg;
      el.appendChild(body);

      if (action) {
        const btn = document.createElement("button");
        btn.textContent = "Yes";
        btn.style.cssText =
          "flex-shrink:0;background:#fff;color:#1565C0;font-weight:700;border:none;border-radius:6px;padding:6px 18px;cursor:pointer;font-size:13px;";
        btn.onclick = (e) => {
          e.stopPropagation();
          remove(entry);
          action();
        };
        el.appendChild(btn);
      }

      container.appendChild(el);
      const entry = { el };
      notifications.push(entry);

      requestAnimationFrame(() => {
        el.style.transform = "translateX(0)";
      });
      layout();

      setTimeout(() => remove(entry), DURATION);
    };
  })();

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function addMessage(from, message, time, profile, prepend = false) {
    const finalContainer = document.createElement("div");
    finalContainer.className = "final-container";
    const head = document.createElement("div");
    head.className = "time-name-container";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = from;
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

  function updateTypingUI() {
    const textEl = document.getElementById("typing-text");
    if (!textEl || !typingIndicator) return;
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

  // Listeners
  const searchInput = document.getElementById("search");
  if (searchInput)
    searchInput.addEventListener("input", debounce(handleSearch, 400));

  const createRoomBtn = document.getElementById("create-room");
  if (createRoomBtn) createRoomBtn.addEventListener("click", handleRoomCreate);

  const inviteUserBtn = document.getElementById("invite-user");
  if (inviteUserBtn) {
    inviteUserBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!currentRoom)
        return M.toast({ html: "Select a room!", classes: "rounded" });
      if (invitedUsers.length === 0)
        return M.toast({ html: "Select users to invite!", classes: "rounded" });
      socket.emit("invite", {
        room: { name: currentRoom, admin: window.userInfo.username },
        usernames: invitedUsers,
      });
      M.Modal.getInstance(document.getElementById("search-modal")).close();
    });
  }

  const sendBtn = document.getElementById("send-button");
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);

  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });
    messageInput.addEventListener("input", () => {
      if (!isTyping && currentRoom) {
        isTyping = true;
        socket.emit("typing", { to: currentRoom });
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        isTyping = false;
        if (currentRoom) {
          socket.emit("stop-typing", { to: currentRoom });
        }
      }, 3000);
    });
  }

  // Scroll-to-top → load older room messages
  if (messagesDiv) {
    messagesDiv.addEventListener("scroll", () => {
      if (
        messagesDiv.scrollTop < 10 &&
        hasMoreHistory &&
        !isLoadingHistory &&
        currentRoom
      ) {
        loadRoomHistory(currentRoom, true);
      }
    });
  }

  // Mobile "..." toggle for file upload button
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

  // Mood Button feedback (vibe/mood features are in the main Chat page)
  const moodBtn = document.getElementById("mood-btn");
  if (moodBtn) {
    moodBtn.addEventListener("click", () => {
      M.toast({
        html: "Vibe features are available on the Chat page!",
        classes: "rounded orange",
      });
    });
  }

  const videoBtn = document.getElementById("video-call-btn");
  if (videoBtn)
    videoBtn.addEventListener("click", () => {
      startVideoCall([]);
    });

  const exitVideoBtn = document.getElementById("exit-video");
  if (exitVideoBtn) {
    exitVideoBtn.addEventListener("click", () => {
      cleanupVideoCall();
      videoModal.style.display = "none";
      socket.emit("exit-video", {
        room: { name: currentRoom },
      });
    });
  }

  const fileInput = document.getElementById("file-input");
  function onFileChange() {
    const uploadBtn = document.getElementById("custom-file-upload");
    if (uploadBtn) uploadBtn.style.backgroundColor = "#e67e22";
  }
  if (fileInput) {
    fileInput.addEventListener("change", onFileChange);
    window.eventListeners.push({
      element: fileInput,
      event: "change",
      handler: onFileChange,
    });
  }

  window.eventListeners.push({
    element: window,
    event: "resize",
    handler: updateStyles,
  });

  function registerSocketEvents() {
    socket.on("error", ({ error }) => {
      if (error === "999") window.loadPage("login.html", "login");
      else addError(error);
    });
    socket.on("disconnect", () => {
      addError("Connection lost. Reconnecting...");
    });
    socket.on("room-created", ({ notify }) => addError(notify, "green"));
    socket.on("invited", ({ notify }) => addError(notify, "blue"));
    socket.on("room-info", ({ name, admin, created_at, memberIds }) => {
      console.log("[Room] Info received:", { admin, created_at, memberIds });
      roomMembers = memberIds.filter((id) => id !== socket.id);
    });
    socket.on("room message", ({ roomName, from, time, message, profile }) => {
      if (roomName === currentRoom) {
        addMessage(from, message, new Date(time).toLocaleString(), profile);
      }
    });
    socket.on("invitation", ({ name, notify }) => {
      addError(notify, "orange");
      if (!window.rooms.some((r) => r.name === name)) {
        window.rooms.push({ name });
        addRoomToList(name);
      }
    });
    socket.on("handshake", async ({ id, room, signal, excludeIds = [] }) => {
      console.log(
        "[WebRTC] handshake received from",
        id,
        "signal type:",
        signal.type,
      );
      if (signal.type === "offer") {
        await receiveVideoCall(id, room.name, signal);
      } else if (signal.type === "answer") {
        const pc = peerConnections.get(id);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          console.log("[WebRTC] remote description (answer) set for", id);
          const candidates = pendingCandidates.get(id) || [];
          for (const c of candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (_) {}
          }
          pendingCandidates.delete(id);
        }
      } else if (signal.type === "candidate") {
        const pc = peerConnections.get(id);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (_) {}
        } else {
          if (!pendingCandidates.has(id)) {
            pendingCandidates.set(id, []);
          }
          pendingCandidates.get(id).push(signal.candidate);
        }
      } else if (signal.type === "connect-rest-members") {
        console.log("Connecting rest members:", excludeIds);
        startVideoCall(excludeIds);
      }
    });
    socket.on("user-typing", ({ from, to }) => {
      if (to === currentRoom) {
        typingUsers.add(from);
        updateTypingUI();
      }
    });
    socket.on("user-stop-typing", ({ from }) => {
      typingUsers.delete(from);
      updateTypingUI();
    });
    socket.on(
      "room file",
      ({ roomName, from, time, fileData, fileType, profile }) => {
        if (roomName === currentRoom) {
          removeUploadProgress();
          const date = new Date(time).toLocaleString();
          const type =
            fileType && fileType.startsWith("image/")
              ? "image"
              : fileType && fileType.startsWith("video/")
                ? "video"
                : "document";
          if (from === window.userInfo.username)
            embedDriveFilesTo(date, fileData, type);
          else embedDriveFiles(date, from, fileData, profile, type);
        }
      },
    );
    socket.on("exit-video", ({ id }) => {
      console.log("exited video call", id);
      closePeerConnection(id);
    });
    socket.on("exit-room", ({ id }) => {
      console.log("exited room", id);
      roomMembers = roomMembers.filter((mId) => mId !== id);
      closePeerConnection(id);
    });
  }
})();
