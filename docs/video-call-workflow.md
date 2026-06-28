# WebRTC Video Call — How It Works & How to Build It

A complete reference for building peer-to-peer video calls using WebRTC + Socket.IO signaling, based on the working implementation in this project.

---

## Table of Contents

1. [What is WebRTC?](#1-what-is-webrtc)
2. [The Big Picture — Call Flow](#2-the-big-picture--call-flow)
3. [ICE, STUN, and TURN](#3-ice-stun-and-turn)
4. [HTML Setup](#4-html-setup)
5. [The ICE Configuration](#5-the-ice-configuration)
6. [State Variables](#6-state-variables)
7. [Starting a Call (Caller Side)](#7-starting-a-call-caller-side)
8. [Receiving a Call (Receiver Side)](#8-receiving-a-call-receiver-side)
9. [The Signal Handler (Socket Events)](#9-the-signal-handler-socket-events)
10. [Shared Helpers](#10-shared-helpers)
11. [Ending a Call](#11-ending-a-call)
12. [Common Bugs and Fixes](#12-common-bugs-and-fixes)
13. [Minimal Boilerplate to Copy](#13-minimal-boilerplate-to-copy)

---

## 1. What is WebRTC?

WebRTC (Web Real-Time Communication) is a browser API that lets two peers send video, audio, and data **directly to each other** — no server in the middle for the media stream itself.

The server (via Socket.IO in this project) is only used for **signaling** — the initial handshake where both peers exchange connection details. Once connected, the video flows peer-to-peer.

---

## 2. The Big Picture — Call Flow

```
CALLER                          SERVER (Socket.IO)              RECEIVER
  |                                     |                           |
  |-- getUserMedia() (get camera) ----  |                           |
  |-- createOffer() -----------------> emit('signal', offer) ----> |
  |                                     |                           |-- getUserMedia()
  |                                     |                           |-- createAnswer()
  |                                     | <--- emit('signal', answer) -|
  |-- setRemoteDescription(answer) --   |                           |
  |                                     |                           |
  | <--- emit('signal', candidate) <----|--- onicecandidate ------> |
  |--- onicecandidate ----------------> emit('signal', candidate) ->|
  |                                     |                           |
  |======== VIDEO FLOWS DIRECTLY (P2P, no server) ================|
```

Key terms:
- **Offer/Answer** — SDP (Session Description Protocol) blobs that describe each peer's media capabilities (codecs, resolution, etc.)
- **ICE Candidate** — a network path (IP + port) the peer can be reached at. Multiple candidates are gathered and exchanged until one works.
- **Signaling** — the process of exchanging offer, answer, and candidates through the server. This is the only part the server touches.

---

## 3. ICE, STUN, and TURN

To connect two peers, WebRTC needs to figure out their public IP addresses. This is what ICE (Interactive Connectivity Establishment) does.

| Server Type | Purpose | When Needed |
|-------------|---------|-------------|
| **STUN** | Tells a peer its own public IP | Almost always |
| **TURN** | Relays traffic when direct P2P fails | Strict NAT / firewalls |

**STUN is free and reliable** (Google hosts public ones).

**TURN relays all video through a server** — expensive bandwidth-wise. Only needed when peers are on different networks with strict NAT (common on mobile data, corporate firewalls).

### What worked in this project

```js
const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};
```

Two STUN servers is enough for same-network or friendly NAT situations. If you add 5+ servers the browser logs a warning and slows down ICE discovery.

### If ICE keeps failing (state = `failed`)

Both peers are behind strict NAT. You need a TURN server. Free options:
- **Twilio** (free trial, reliable): https://www.twilio.com/docs/stun-turn
- **Metered** (free tier): https://www.metered.ca/turn-server
- **Self-hosted**: install `coturn` on any VPS

---

## 4. HTML Setup

```html
<!-- The video elements. Both need autoplay + playsinline + muted -->
<video id="localVideo"  autoplay muted playsinline></video>
<video id="remoteVideo" autoplay muted playsinline></video>
```

Why each attribute matters:
- `autoplay` — starts playing as soon as `srcObject` is set. Without this the video renders blank even if the stream is attached.
- `muted` — browsers block autoplay on unmuted video (security policy). Local video should always be muted anyway (avoids echo). Remote video can be unmuted in JS after play starts if needed: `remoteVideo.muted = false`.
- `playsinline` — required on iOS Safari. Without it, video goes fullscreen on mobile.

**The video button must NOT be a Materialize `modal-trigger`.**

```html
<!-- WRONG — Materialize opens the modal instantly on click, before getUserMedia runs -->
<a href="#video-modal" class="btn modal-trigger" id="video-call-btn">...</a>

<!-- CORRECT — plain button, JS opens the modal manually after stream is ready -->
<button id="video-call-btn" class="btn">...</button>
```

---

## 5. The ICE Configuration

```js
const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};
```

This object is passed to `new RTCPeerConnection(iceConfiguration)`. It tells WebRTC which servers to use when gathering ICE candidates.

To add TURN later:
```js
{
    urls: 'turn:your-turn-server.com:3478',
    username: 'youruser',
    credential: 'yourpassword'
}
```

---

## 6. State Variables

```js
let localConnection;   // the active RTCPeerConnection object
let connectionId = 0;  // increments on every new call — guards against stale candidates
let pendingCandidates = []; // ICE candidates that arrived before remoteDescription was set
```

### Why `connectionId`?

When a call ends and a new one starts, the old connection's ICE candidates can still arrive via Socket.IO (network delay). If you apply them to the new `RTCPeerConnection`, it throws `Unknown ufrag` errors and fails.

The fix: capture the ID at connection creation, and only emit/apply candidates if the ID still matches the current active connection.

```js
localConnection = new RTCPeerConnection(iceConfiguration);
const thisConnectionId = ++connectionId; // bump global, capture local snapshot

localConnection.onicecandidate = e => {
    if (e.candidate && connectionId === thisConnectionId) { // guard here
        socket.emit('signal', { room: currentRoom, signal: { type: 'candidate', candidate: e.candidate } });
    }
};
```

### Why `pendingCandidates`?

ICE candidates from the remote peer can arrive via socket **before** `setRemoteDescription()` has been called. WebRTC rejects candidates added before a remote description exists.

The fix: buffer them, then apply in bulk after `setRemoteDescription()` completes.

```js
// In signal handler — candidate arrives early
} else if (signal.type === 'candidate') {
    if (localConnection && localConnection.remoteDescription) {
        await localConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else {
        pendingCandidates.push(signal.candidate); // buffer it
    }
}

// Later, after setRemoteDescription:
pendingCandidates.forEach(c => localConnection.addIceCandidate(new RTCIceCandidate(c)));
pendingCandidates = [];
```

---

## 7. Starting a Call (Caller Side)

```js
async function startVideoCall() {
    if (!currentRoom) return; // must be in a room

    closeExistingConnection(); // clean up any previous call first

    // 1. Get camera + mic stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream; // show caller their own video

    // 2. Create peer connection
    localConnection = new RTCPeerConnection(iceConfiguration);
    const thisConnectionId = ++connectionId;

    // 3. Add all local tracks to the connection (this is what the remote side receives)
    stream.getTracks().forEach(track => localConnection.addTrack(track, stream));

    // 4. Set up ontrack — fires when remote tracks arrive
    setupOnTrack(remoteVideo);

    // 5. Set up ICE candidate handler
    localConnection.onicecandidate = e => {
        if (e.candidate && connectionId === thisConnectionId) {
            socket.emit('signal', { room: currentRoom, signal: { type: 'candidate', candidate: e.candidate } });
        }
    };

    // 6. Create offer (SDP describing our media capabilities)
    const offer = await localConnection.createOffer();

    // 7. Set it as our local description (starts ICE gathering)
    await localConnection.setLocalDescription(offer);

    // 8. Send offer to remote peer via server
    socket.emit('signal', { room: currentRoom, signal: offer });

    // 9. Open the modal NOW — stream is already attached
    M.Modal.getInstance(videoModal).open();
}
```

Step-by-step:
1. `getUserMedia` — prompts the user for camera/mic permission. Returns a `MediaStream`.
2. `new RTCPeerConnection` — creates the WebRTC connection object.
3. `addTrack` — registers each video/audio track with the connection so they get sent to the peer.
4. `ontrack` — callback that fires when the remote peer's tracks arrive. Assign them to `remoteVideo.srcObject`.
5. `onicecandidate` — fires each time a new network path is discovered. Send each one to the peer via server.
6. `createOffer` — generates an SDP offer blob.
7. `setLocalDescription` — registers the offer locally and begins ICE candidate gathering.
8. Emit the offer to the server, which forwards it to the room.
9. Open the modal — only after stream is attached, not before.

---

## 8. Receiving a Call (Receiver Side)

This is triggered automatically when a `signal` event of type `offer` arrives via socket.

```js
async function receiveVideoCall(signal) {
    closeExistingConnection(); // clean up stale connection if any

    // 1. Get own camera + mic
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;

    // 2. Create peer connection
    localConnection = new RTCPeerConnection(iceConfiguration);
    const thisConnectionId = ++connectionId;

    // 3. Add local tracks
    stream.getTracks().forEach(track => localConnection.addTrack(track, stream));

    // 4. Set up ontrack and ICE candidate handler (same as caller)
    setupOnTrack(remoteVideo);
    localConnection.onicecandidate = e => {
        if (e.candidate && connectionId === thisConnectionId) {
            socket.emit('signal', { room: currentRoom, signal: { type: 'candidate', candidate: e.candidate } });
        }
    };

    // 5. Apply the caller's offer as remote description
    await localConnection.setRemoteDescription(new RTCSessionDescription(signal));

    // 6. Create answer
    const answer = await localConnection.createAnswer();

    // 7. Set as local description
    await localConnection.setLocalDescription(answer);

    // 8. Apply any buffered ICE candidates that arrived before this point
    pendingCandidates.forEach(c => localConnection.addIceCandidate(new RTCIceCandidate(c)));
    pendingCandidates = [];

    // 9. Send answer back to caller
    socket.emit('signal', { room: currentRoom, signal: answer });

    // 10. Open modal
    M.Modal.getInstance(videoModal).open();
}
```

Key difference from caller side: instead of `createOffer`, the receiver calls `setRemoteDescription(offer)` first, then `createAnswer()`.

---

## 9. The Signal Handler (Socket Events)

The server forwards all WebRTC signaling messages to other room members. This handler processes them:

```js
socket.on('signal', async ({ signal }) => {

    if (signal.type === 'offer') {
        // Someone is calling us — start receiving
        await receiveVideoCall(signal);

    } else if (signal.type === 'answer' && localConnection) {
        // Our offer was answered — apply the answer
        await localConnection.setRemoteDescription(new RTCSessionDescription(signal));
        // Apply buffered candidates
        pendingCandidates.forEach(c => localConnection.addIceCandidate(new RTCIceCandidate(c)));
        pendingCandidates = [];

    } else if (signal.type === 'candidate') {
        // A new network path from the remote peer
        if (localConnection && localConnection.remoteDescription) {
            await localConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
            pendingCandidates.push(signal.candidate); // too early, buffer it
        }
    }
});
```

The three signal types:
- `offer` — caller sends this first. Contains their media capabilities.
- `answer` — receiver sends this back. Contains their media capabilities.
- `candidate` — either peer sends these continuously as network paths are discovered. Both sides collect and try them until one works.

---

## 10. Shared Helpers

### `setupOnTrack`

```js
function setupOnTrack(remoteVideo) {
    localConnection.ontrack = e => {
        if (e.streams && e.streams[0]) {
            remoteVideo.srcObject = e.streams[0];
        } else {
            // Fallback: e.streams[0] can be undefined in some browsers
            let inbound = remoteVideo.srcObject || new MediaStream();
            inbound.addTrack(e.track);
            remoteVideo.srcObject = inbound;
        }
    };
}
```

`ontrack` fires when the remote peer's media tracks arrive. Assign the stream to `remoteVideo.srcObject` and the video plays automatically (because of `autoplay`).

The fallback handles older browsers or cases where the stream container isn't attached — it manually builds a `MediaStream` and adds the track to it.

### `setupICELogging`

```js
function setupICELogging() {
    localConnection.oniceconnectionstatechange = () => {
        console.log('[ICE state]', localConnection.iceConnectionState);
    };
}
```

Possible states in order: `new` → `checking` → `connected` → `completed`

If it goes `checking` → `failed`, ICE failed. You need TURN. If it reaches `connected`, video should be flowing.

### `closeExistingConnection`

```js
function closeExistingConnection() {
    if (localConnection) {
        localConnection.close();
        localConnection = null;
    }
    pendingCandidates = [];
}
```

Always call this before creating a new `RTCPeerConnection`. Closes the old peer connection properly and flushes stale candidates. Forgetting this causes the `Unknown ufrag` error.

---

## 11. Ending a Call

```js
exitVideoBtn.addEventListener('click', () => {
    closeExistingConnection(); // close RTCPeerConnection + flush candidates

    // Stop camera and mic tracks (releases hardware)
    if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(t => t.stop());
        localVideo.srcObject = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(t => t.stop());
        remoteVideo.srcObject = null;
    }
});
```

`getTracks().forEach(t => t.stop())` is important — it releases the camera and microphone hardware. Without it the browser camera indicator light stays on.

---

## 12. Common Bugs and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Remote video blank (green/black) | `autoplay` missing on `<video>` | Add `autoplay playsinline muted` |
| Remote video blank | Modal opens before stream attaches | Remove `modal-trigger`, open modal in JS after `getUserMedia` |
| Remote video blank | `ontrack` fires but `e.streams[0]` is undefined | Use fallback `MediaStream` in `ontrack` |
| ICE state stuck at `checking` | TURN server broken or missing | Test with just STUN first; add real TURN if needed |
| ICE state `failed` | Both peers behind strict NAT | Need a working TURN server |
| `Unknown ufrag` error | Stale candidates applied to new connection | Use `connectionId` guard + `closeExistingConnection()` |
| Browser warning "5 or more servers" | Too many ICE servers | Use max 2–3 servers |
| Camera light stays on after call ends | Tracks not stopped | Call `.stop()` on every track |
| Second call doesn't work | Previous connection not closed | Call `closeExistingConnection()` before creating new `RTCPeerConnection` |

---

## 13. Minimal Boilerplate to Copy

This is the smallest working WebRTC setup. Everything else in the project is app-specific wrapping around this core.

```js
// --- Config ---
const iceConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

let pc;              // RTCPeerConnection
let connId = 0;      // stale candidate guard
let pending = [];    // buffered candidates

function closePC() {
    if (pc) { pc.close(); pc = null; }
    pending = [];
}

function onTrack(remoteVideo) {
    pc.ontrack = e => {
        if (e.streams?.[0]) remoteVideo.srcObject = e.streams[0];
        else { let s = remoteVideo.srcObject || new MediaStream(); s.addTrack(e.track); remoteVideo.srcObject = s; }
    };
}

// --- Caller ---
async function call(roomId, localVideo, remoteVideo, socket) {
    closePC();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    pc = new RTCPeerConnection(iceConfig);
    const id = ++connId;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    onTrack(remoteVideo);
    pc.onicecandidate = e => { if (e.candidate && connId === id) socket.emit('signal', { roomId, signal: { type: 'candidate', candidate: e.candidate } }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { roomId, signal: offer });
}

// --- Receiver ---
async function answer(signal, roomId, localVideo, remoteVideo, socket) {
    closePC();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    pc = new RTCPeerConnection(iceConfig);
    const id = ++connId;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    onTrack(remoteVideo);
    pc.onicecandidate = e => { if (e.candidate && connId === id) socket.emit('signal', { roomId, signal: { type: 'candidate', candidate: e.candidate } }); };
    await pc.setRemoteDescription(new RTCSessionDescription(signal));
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    pending.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); pending = [];
    socket.emit('signal', { roomId, signal: ans });
}

// --- Signal handler ---
socket.on('signal', async ({ signal }) => {
    if (signal.type === 'offer') {
        await answer(signal, roomId, localVideo, remoteVideo, socket);
    } else if (signal.type === 'answer' && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        pending.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c))); pending = [];
    } else if (signal.type === 'candidate') {
        if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        else pending.push(signal.candidate);
    }
});

// --- Server side (Node.js + Socket.IO) ---
// io.on('connection', socket => {
//     socket.on('signal', ({ roomId, signal }) => {
//         socket.to(roomId).emit('signal', { signal }); // forward to everyone else in room
//     });
// });
```

The server-side is intentionally minimal — it just forwards signal messages to the room. All WebRTC logic lives in the browser.