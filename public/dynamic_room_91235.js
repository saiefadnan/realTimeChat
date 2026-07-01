(async function () {
  let socket = window.socket;
  let peerId = 0;
  const chunkSize = 512 * 1024;
  let _uploadProgressEl = null;
  const items = document.getElementById("item-list");
  const activeRoom = document.getElementById("room-list");
  const roomNameInput = document.getElementById("room-name");
  const CurrentroomLabel = document.getElementById("current-room");
  const messagesDiv = document.getElementById("chat-content");
  const videoModal = document.getElementById("video-modal");
  const container = document.getElementById("video-modal-content");
  window.addEventListener("resize", updateStyles);

  function addVideo() {
    const id = `remoteVideo${peerId}`;
    container.insertAdjacentHTML(
      "beforeend",
      `<video id="${id}" class="video-modal-child" autoplay playsinline muted style="border: 2px solid red;"></video>`,
    );
    const video = document.getElementById(id);
    peerId++;
    console.log("[WebRTC] addVideo created:", id);
    return video;
  }

  function getDivByTextContent(text) {
    console.log("[getDivByTextContent] Searching for:", text);
    Array.from(activeRoom.children).forEach((div) => {
      console.log(`[${div.textContent}]`);
    });
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

  let localConnection;
  let connectionId = 0; // guards stale ICE candidates from previous calls
  let pendingCandidates = [];
  let currentRoom;
  let invitedUsers = [];
  let debounceTimer;

  function init() {
    const modalElems = document.querySelectorAll(".modal");
    M.Modal.init(modalElems);

    if (window.rooms) {
      window.rooms.forEach((room) => addRoomToList(room.name));
    }
    updateLayout();
    window.addEventListener("resize", updateLayout);
  }

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

  function sendChunks(room, file, offset) {
    if (window._uploadAborted) return;

    if (!socket || !socket.connected) {
      if (window.Pending) window.Pending(room, file, offset);
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

  async function sendMessage(rec = null, msg = null) {
    const messageInput = document.getElementById("message-input");
    let message = messageInput.value.trim();
    let targetRoom = currentRoom;

    if (rec && msg) {
      targetRoom = rec;
      message = msg;
    }

    if (message && targetRoom) {
      const date = new Date().toLocaleString();
      addMessageTo(message, date);

      if (!socket || !socket.connected) {
        if (window.Pending) window.Pending(targetRoom, message, -1);
        messageInput.value = "";
        return;
      }

      socket.emit("room message", {
        room: { name: targetRoom, admin: window.userInfo.username },
        message,
        date,
      });
      messageInput.value = "";
    }

    const fileInputEl = document.getElementById("file-input");
    const file = fileInputEl.files[0];
    if (file && targetRoom) {
      document.getElementById("custom-file-upload").style.backgroundColor =
        "#2ecc71";
      sendChunks(targetRoom, file, 0);
    }
  }

  function selectRoom(div, name) {
    activeRoom.querySelectorAll(".room-item").forEach((d) => {
      d.classList.remove("active-room-card");
    });
    div.classList.add("active-room-card");
    currentRoom = name;
    CurrentroomLabel.textContent = `Room: ${name}`;
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
  function setupOnTrack(remoteVideo) {
    localConnection.ontrack = (e) => {
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

  function setupICELogging() {
    localConnection.oniceconnectionstatechange = () => {
      console.log("[ICE state]", localConnection.iceConnectionState);
    };
  }

  function closeExistingConnection() {
    if (localConnection) {
      localConnection.close();
      localConnection = null;
    }
    pendingCandidates = [];
    const existing = container.querySelectorAll(
      ".video-modal-child:not(#localVideo)",
    );
    existing.forEach((el) => el.remove());
  }

  // WebRTC Logic
  async function startVideoCall() {
    if (!currentRoom)
      return M.toast({ html: "Select a room first!", classes: "rounded" });

    const localVideo = document.getElementById("localVideo");

    closeExistingConnection();

    const remoteVideo = addVideo();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = stream;
      console.log(
        "[WebRTC] getUserMedia OK, tracks:",
        stream.getTracks().map((t) => t.kind),
      );

      localConnection = new RTCPeerConnection(iceConfiguration);
      const thisConnectionId = ++connectionId;
      stream
        .getTracks()
        .forEach((track) => localConnection.addTrack(track, stream));

      setupOnTrack(remoteVideo);
      setupICELogging();

      localConnection.onicecandidate = (e) => {
        if (e.candidate && connectionId === thisConnectionId) {
          socket.emit("signal", {
            room: currentRoom,
            signal: { type: "candidate", candidate: e.candidate },
          });
        }
      };

      const offer = await localConnection.createOffer();
      await localConnection.setLocalDescription(offer);
      console.log("[WebRTC] offer created and sent");
      socket.emit("signal", { room: currentRoom, signal: offer });

      // M.Modal.getInstance(videoModal).open();
      videoModal.style.display = "flex";
      M.toast({ html: "Calling room members...", classes: "rounded blue" });
      updateStyles();
    } catch (err) {
      console.error("[WebRTC] Failed to start call:", err);
      M.toast({ html: "Camera/mic access denied", classes: "rounded red" });
    }
  }

  async function receiveVideoCall(name, signal) {
    const localVideo = document.getElementById("localVideo");

    closeExistingConnection();
    const div = getDivByTextContent(name);
    console.log("got you", div);
    selectRoom(div, name);
    const remoteVideo = addVideo();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = stream;
      console.log(
        "[WebRTC] receiveVideoCall getUserMedia OK, tracks:",
        stream.getTracks().map((t) => t.kind),
      );

      localConnection = new RTCPeerConnection(iceConfiguration);
      const thisConnectionId = ++connectionId;
      stream
        .getTracks()
        .forEach((track) => localConnection.addTrack(track, stream));

      setupOnTrack(remoteVideo);
      setupICELogging();

      localConnection.onicecandidate = (e) => {
        if (e.candidate && connectionId === thisConnectionId) {
          socket.emit("signal", {
            room: currentRoom,
            signal: { type: "candidate", candidate: e.candidate },
          });
        }
      };

      await localConnection.setRemoteDescription(
        new RTCSessionDescription(signal),
      );
      console.log("[WebRTC] remote description (offer) set");
      const answer = await localConnection.createAnswer();
      await localConnection.setLocalDescription(answer);
      console.log("[WebRTC] answer created and sent");

      pendingCandidates.forEach((c) => {
        localConnection.addIceCandidate(new RTCIceCandidate(c));
      });
      pendingCandidates = [];

      socket.emit("signal", { room: currentRoom, signal: answer });
      // M.Modal.getInstance(videoModal).open();
      videoModal.style.display = "flex";
      M.toast({ html: "Answering Call...", classes: "rounded blue" });
      updateStyles();
    } catch (err) {
      console.error("[WebRTC] Failed to receive call:", err);
      M.toast({ html: "Failed to connect video call", classes: "rounded red" });
    }
  }

  // Initialize socket connection if missing
  if (!socket || !socket.connected) {
    socket = io();
    window.socket = socket;

    socket.on("connect", () => {
      console.log("[Room Socket] Connected");
      socket.emit("insert name", { jwtoken: Cookies.get("token") });
    });
  }

  // Socket Events
  socket.on("room-created", ({ notify }) => addFeedback(notify, "green"));
  socket.on("invited", ({ notify }) => addFeedback(notify, "blue"));
  socket.on("room message", ({ from, time, message, profile }) => {
    addMessage(from, message, new Date(time).toLocaleString(), profile);
  });

  socket.on("invitation", ({ name, notify }) => {
    addFeedback(notify, "orange");
    if (!window.rooms.some((r) => r.name === name)) {
      window.rooms.push({ name });
      addRoomToList(name);
    }
  });

  socket.on("signal", async ({ room, signal }) => {
    console.log(
      "[WebRTC] signal received:",
      signal.type,
      "localConnection:",
      !!localConnection,
    );

    if (signal.type === "offer") {
      // closeExistingConnection is called inside receiveVideoCall
      await receiveVideoCall(room, signal);
    } else if (signal.type === "answer" && localConnection) {
      await localConnection.setRemoteDescription(
        new RTCSessionDescription(signal),
      );
      console.log("[WebRTC] remote description (answer) set");
      pendingCandidates.forEach((c) => {
        localConnection.addIceCandidate(new RTCIceCandidate(c));
      });
      pendingCandidates = [];
    } else if (signal.type === "candidate") {
      if (localConnection && localConnection.remoteDescription) {
        await localConnection.addIceCandidate(
          new RTCIceCandidate(signal.candidate),
        );
      } else {
        pendingCandidates.push(signal.candidate);
        console.log(
          "[WebRTC] candidate queued (no remote desc yet), pending:",
          pendingCandidates.length,
        );
      }
    }
  });

  socket.on("room file", ({ from, time, fileData, profile }) => {
    removeUploadProgress();
    const date = new Date(time).toLocaleString();
    if (from === window.userInfo.username) embedDriveFilesTo(date, fileData);
    else embedDriveFiles(date, from, fileData, profile);
  });

  // UI Feedback
  function addFeedback(msg, color) {
    const err = document.createElement("div");
    err.textContent = msg;
    Object.assign(err.style, {
      color:
        color === "green"
          ? "#2ecc71"
          : color === "blue"
            ? "#3498db"
            : "#f39c12",
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
    setTimeout(() => err.remove(), 4000);
  }

  function addMessage(from, message, time, profile) {
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
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addMessageTo(message, time) {
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
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function embedDriveFiles(time, from, file_id, profile) {
    const container = document.createElement("div");
    container.className = "message-receive-container";
    container.style.flexDirection = "column";
    container.style.alignItems = "flex-start";
    container.style.padding = "10px";
    const header = document.createElement("div");
    header.style.display = "flex";
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
    info.append(nameSpan, timeSpan);
    header.append(img, info);
    const iframe = document.createElement("iframe");
    iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
    Object.assign(iframe.style, {
      width: "100%",
      maxWidth: "300px",
      height: "215px",
      border: "none",
      borderRadius: "8px",
      backgroundColor: "#000",
    });
    container.append(header, iframe);
    messagesDiv.appendChild(container);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function embedDriveFilesTo(time, file_id) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "flex-end";
    container.style.padding = "10px";
    const timeLabel = document.createElement("small");
    timeLabel.textContent = time;
    const iframe = document.createElement("iframe");
    iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
    Object.assign(iframe.style, {
      width: "100%",
      maxWidth: "300px",
      height: "215px",
      border: "none",
      borderRadius: "8px",
      backgroundColor: "#000",
    });
    container.append(timeLabel, iframe);
    messagesDiv.appendChild(container);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
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

  const videoBtn = document.getElementById("video-call-btn");
  if (videoBtn) videoBtn.addEventListener("click", startVideoCall);

  const exitVideoBtn = document.getElementById("exit-video");
  if (exitVideoBtn) {
    exitVideoBtn.addEventListener("click", () => {
      closeExistingConnection();
      const localVideo = document.getElementById("localVideo");
      const remoteVideos = [];
      for (let i = 0; i < peerId; i++) {
        remoteVideos.push(document.getElementById(`remoteVideo${i}`));
      }
      if (localVideo && localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach((t) => t.stop());
        localVideo.srcObject = null;
      }
      remoteVideos.forEach((remoteVideo) => {
        if (remoteVideo && remoteVideo.srcObject) {
          remoteVideo.srcObject.getTracks().forEach((t) => t.stop());
          remoteVideo.srcObject = null;
        }
      });
      videoModal.style.display = "none";
    });
  }

  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const uploadBtn = document.getElementById("custom-file-upload");
      if (uploadBtn) uploadBtn.style.backgroundColor = "#e67e22";
    });
  }

  window.eventListeners.push({
    element: window,
    event: "resize",
    handler: updateStyles,
  });

  init();
})();
