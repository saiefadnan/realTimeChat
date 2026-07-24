const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelay",
      credential: "openrelay",
    },
  ],
};
const PEER_CONFIG = { ...ICE_CONFIG, offerExtmapAllowMixed: true };

export default class WebRTCManager {
  constructor(socket, { container, videoModal }) {
    this.socket = socket;
    this.container = container;
    this.videoModal = videoModal;
    this.localStream = null;
    this.peerConnections = new Map();
    this.pendingCandidates = new Map();
    this.joinedIds = [];

    window.addEventListener("resize", () => this.updateStyles());
  }

  getOrCreatePeerConnection(id, stream) {
    let pc = this.peerConnections.get(id);
    if (pc) return pc;
    pc = new RTCPeerConnection(PEER_CONFIG);
    this.peerConnections.set(id, pc);
    this._setupICELogging(pc);
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }
    return pc;
  }

  closePeerConnection(id) {
    const pc = this.peerConnections.get(id);
    if (pc) {
      try {
        pc.close();
      } catch (_) {}
      this.peerConnections.delete(id);
    }
    this.pendingCandidates.delete(id);
    this.removeVideo(id);
  }

  addVideo(id) {
    if (document.getElementById(`remoteVideo${id}`)) return null;
    const videoId = `remoteVideo${id}`;
    this.joinedIds.push(id);
    if (!this.container) return null;
    this.container.insertAdjacentHTML(
      "beforeend",
      `<video id="${videoId}" class="video-modal-child" autoplay playsinline></video>`,
    );
    const video = document.getElementById(videoId);
    this.updateStyles();
    return video;
  }

  removeVideo(id) {
    const videoId = `remoteVideo${id}`;
    const indx = this.joinedIds.indexOf(id);
    if (indx !== -1) this.joinedIds.splice(indx, 1);
    const video = document.getElementById(videoId);
    if (video) {
      video.remove();
      this.updateStyles();
    }
  }

  updateStyles() {
    const count = this.container
      ? this.container.querySelectorAll(".video-modal-child").length
      : 0;
    if (!this.container) return;
    const isMobile = window.innerWidth < 700;
    const isTablet = window.innerWidth < 1000;
    if (isMobile) {
      this.container.style.gridTemplateColumns = "1fr";
      return;
    }
    if (isTablet) {
      this.container.style.gridTemplateColumns = "1fr 1fr";
      return;
    }
    if (count === 1) this.container.style.gridTemplateColumns = "1fr";
    else if (count <= 4) this.container.style.gridTemplateColumns = "1fr 1fr";
    else if (count <= 9)
      this.container.style.gridTemplateColumns = "1fr 1fr 1fr";
    else this.container.style.gridTemplateColumns = "repeat(4, 1fr)";
  }

  setupOnTrack(peerConnection, remoteVideo) {
    peerConnection.ontrack = (e) => {
      const incomingStream = e.streams && e.streams[0];
      if (incomingStream) {
        if (remoteVideo.srcObject !== incomingStream) {
          remoteVideo.srcObject = incomingStream;
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
      }
      clearTimeout(remoteVideo._playDebounce);
      remoteVideo._playDebounce = setTimeout(() => {
        remoteVideo.play().catch((err) => {
          if (err.name === "AbortError") return;
          remoteVideo.muted = true;
          remoteVideo.play().catch(() => {});
        });
      }, 50);
    };
  }

  _setupICELogging(pc) {
    pc.oniceconnectionstatechange = () => {
      console.log("[ICE state]", pc.iceConnectionState);
    };
  }

  cleanupVideoCall() {
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.localStream = null;
    }
    const localVideo = document.getElementById("localVideo");
    if (localVideo) localVideo.srcObject = null;
    for (const [, pc] of this.peerConnections) {
      try {
        pc.close();
      } catch (_) {}
    }
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.joinedIds = [];
    if (this.container) {
      this.container
        .querySelectorAll(".video-modal-child:not(#localVideo)")
        .forEach((el) => el.remove());
    }
    this.updateStyles();
  }

  async startVideoCall(currentRoom, liveMembers) {
    const localVideo = document.getElementById("localVideo");
    this.cleanupVideoCall();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not available in this browser");
      }
      if (!this.localStream) {
        const gdm = navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("getUserMedia timed out")), 10000),
        );
        this.localStream = await Promise.race([gdm, timeout]);
        localVideo.srcObject = this.localStream;
      }
      const live = liveMembers || [];
      if (live.length > 0) {
        for (const peerId of live) {
          if (this.peerConnections.has(peerId)) continue;
          const remoteVideo = this.addVideo(peerId);
          const pc = this.getOrCreatePeerConnection(peerId, this.localStream);
          this.setupOnTrack(pc, remoteVideo);
          pc.onicecandidate = (e) => {
            if (e.candidate && this.peerConnections.get(peerId) === pc) {
              this.socket.emit("handshake", {
                id: this.socket.id,
                to: peerId,
                room: { name: currentRoom },
                signal: { type: "candidate", candidate: e.candidate },
              });
            }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit("handshake", {
            id: this.socket.id,
            to: peerId,
            room: { name: currentRoom },
            signal: offer,
          });
        }
        this.videoModal.style.display = "flex";
        M.toast({
          html: "Connecting room members...",
          classes: "rounded blue",
        });
        this.updateStyles();
      } else {
        this.socket.emit("handshake", {
          id: this.socket.id,
          room: { name: currentRoom },
          signal: { type: "init-call" },
        });
        M.toast({
          html: "Calling all the members of the room...",
          classes: "rounded red",
        });
        this.videoModal.style.display = "flex";
      }
    } catch (err) {
      console.error("[WebRTC] Failed to start call:", err);
      M.toast({
        html: "Video call failed: " + err.message,
        classes: "rounded red",
      });
    }
  }

  async handleHandshake(id, room, signal, currentRoom, liveMembers) {
    if (signal.type === "offer") {
      if (this.peerConnections.has(id)) {
        this.closePeerConnection(id);
      }
      const rv = this.addVideo(id);
      if (!rv) return;
      const pc = this.getOrCreatePeerConnection(id, this.localStream);
      this.setupOnTrack(pc, rv);
      pc.onicecandidate = (e) => {
        if (e.candidate && this.peerConnections.get(id) === pc) {
          this.socket.emit("handshake", {
            id: this.socket.id,
            to: id,
            room: { name: currentRoom },
            signal: { type: "candidate", candidate: e.candidate },
          });
        }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const candidates = this.pendingCandidates.get(id) || [];
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (_) {}
        }
        this.pendingCandidates.delete(id);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit("handshake", {
          id: this.socket.id,
          to: id,
          room: { name: currentRoom },
          signal: answer,
        });
      } catch (err) {
        console.error("[WebRTC] Failed to mesh-connect to", id, err);
      }
    } else if (signal.type === "answer") {
      const pc = this.getOrCreatePeerConnection(id, this.localStream);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const candidates = this.pendingCandidates.get(id) || [];
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (_) {}
        }
        this.pendingCandidates.delete(id);
      }
    } else if (signal.type === "candidate") {
      const pc = this.peerConnections.get(id);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (_) {}
      } else {
        if (!this.pendingCandidates.has(id)) {
          this.pendingCandidates.set(id, []);
        }
        this.pendingCandidates.get(id).push(signal.candidate);
      }
    }
  }
}
