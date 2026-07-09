# WebRTC Video Call — Implementation Reference

Complete documentation of the mesh-topology WebRTC video call system in this project.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server State (`chatSocket.js`)](#2-server-state-chatsocketjs)
3. [Client State (`dynamic_room_91235.js`)](#3-client-state-dynamic_room_91235js)
4. [Call Flow — Step by Step](#4-call-flow--step-by-step)
5. [The Handshake Queue (Ack Synchronization)](#5-the-handshake-queue-ack-synchronization)
6. [ICE, STUN, and TURN](#6-ice-stun-and-turn)
7. [Cleanup & Edge Cases](#7-cleanup--edge-cases)
8. [Common Bugs and Fixes](#8-common-bugs-and-fixes)

---

## 1. Architecture Overview

**Topology**: Mesh — every peer connects directly to every other peer via a dedicated `RTCPeerConnection`.

```
                ┌─────────┐
     ┌──────────│ PEER A  │──────────┐
     │          └─────────┘          │
     │                 │             │
     ▼                 ▼             ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│ PEER B  │     │ PEER C  │     │ PEER D  │
└─────────┘     └─────────┘     └─────────┘
```

- **Signaling** (offer/answer/ICE) goes through the Socket.IO server.
- **Media** flows directly peer-to-peer using WebRTC.
- The server never sees the video/audio data.

### Key design decisions

| Decision | Reason |
|----------|--------|
| Mesh (not SFU/MCU) | Simpler; no server-side media processing. Works for 2–6 peers. Beyond that, bandwidth grows O(n²) per peer |
| `members` = flat socket ID array | Tracks all connected sockets in a room. Used for room-info broadcasts |
| `onCallIds` = flat socket ID array | Tracks only peers who have joined the video call. Used for signaling forwarding and ack synchronization |
| Per-socket chunk buffer | File upload chunks are buffered per `socket.id` (not a global array) to avoid race conditions |

---

## 2. Server State (`chatSocket.js`)

### In-memory maps (module-level)

| Variable | Shape | Purpose |
|----------|-------|---------|
| `users` | `{ username → socket.id }` | Lookup socket ID by username |
| `names` | `{ socket.id → username }` | Lookup username by socket ID |
| `photos` | `{ socket.id → profile URL }` | Profile pictures for messages |
| `socIns` | `{ username → socket instance }` | Direct socket reference for forced disconnect |
| `rooms` | `{ roomName → { admin, created_at, members[], onCallIds[] } }` | Per-room state |
| `ackIds` | `{ roomName → [socket.id, ...] }` | Sockets that must ACK before the next handshake is processed |
| `handshakeQueue` | `{ roomName → [{ socket, data }, ...] }` | Queued handshake events pending ack clearance |
| `processingAcks` | `{ roomName → boolean }` | Whether a handshake is waiting for acks in this room |

### Room object shape

```js
rooms[roomName] = {
  admin: "username",
  created_at: 1700000000000,
  members: ["socketId1", "socketId2"],     // all connected sockets in room
  onCallIds: ["socketId1", "socketId2"],   // only those in the video call
};
```

### Events emitted to clients

| Event | Payload | When |
|-------|---------|------|
| `room-info` | `{ name, admin, created_at, memberIds, onCallIds }` | On join-rooms, create-room, invite |
| `update-room-info` | `{ name, signal, memberIds, onCallIds }` | On handshake (join call), exit-video, disconnect |
| `handshake` | `{ id, room, signal }` | Forwarding offer/answer/candidate to a specific peer |
| `exit-video` | `{ id }` | A peer left the video call |
| `exit-room` | `{ id }` | A peer disconnected from the server |
| `reject-call` | `{ id, room, username }` | A peer declined an incoming call |

---

## 3. Client State (`dynamic_room_91235.js`)

### Key variables

| Variable | Shape | Purpose |
|----------|-------|---------|
| `roomMembers` | `Map<roomName → [socketId, ...]>` | All connected sockets in each room |
| `liveMembers` | `Map<roomName → [socketId, ...]>` | Sockets currently in the video call (filtered to exclude self) |
| `peerConnections` | `Map<socketId → RTCPeerConnection>` | Active peer connections keyed by peer socket ID |
| `pendingCandidates` | `Map<socketId → [RTCIceCandidate, ...]>` | ICE candidates buffered before remote description is set |
| `joinedIds` | `[socketId, ...]` | IDs of peers we have created video elements for |
| `currentRoom` | `string \| undefined` | Currently selected room name |
| `localStream` | `MediaStream \| null` | Our camera+mic stream |

### How `liveMembers` is populated

```js
// room-info handler
liveMembers.set(name, onCallIds.filter((m) => m !== socket.id));

// update-room-info handler (same logic)
liveMembers.set(name, onCallIds.filter((m) => m !== socket.id));
```

The `filter(m => m !== socket.id)` removes self — you don't create a peer connection to yourself.

---

## 4. Call Flow — Step by Step

### 4.1 User clicks "Start Video Call" (first caller, no one else in call)

```
CALLER                          SERVER
  │                                │
  ├─ startVideoCall()              │
  │  ├─ getUserMedia()             │
  │  ├─ liveMembers is empty       │
  │  └─ emit("handshake", {        │
  │       signal: {type:"init-call"│
  │     })                         │
  │                                ├─ onCallIds.push(caller.id)
  │                                ├─ isCallOngoing = false
  │                                ├─ signal.type === "init-call"
  │                                │  → set callerId, callerName
  │                                ├─ emit("update-room-info", {
  │                                │    signal: {type:"init-call",
  │                                │            callerId, callerName}
  │                                │   })
  │                                │
  │◄─ update-room-info ────────────┤
  │  (signal.type === "init-call") │
  │  callerId === socket.id → skip │    ─┐
  │  no ack sent                   │     │
```

The key: `init-call` does NOT set `ackIds` or `processingAcks`. No synchronization is needed because there's no offer to forward yet.

### 4.2 Receiver gets the incoming call modal

```
RECEIVER                        SERVER
  │                                │
  │◄─ update-room-info ────────────┤
  │  signal.type === "init-call"   │
  │  callerId !== socket.id        │
  │  → callingModal() fires        │
  │     │                          │
  │     ├─ window.incomingCall()    │
  │     │  (ringtone, modal)       │
  │     │                          │
  │     ├─ User presses ACCEPT     │
  │     │  → selectRoom(room)      │
  │     │  → await startVideoCall()│
  │     │     │                    │
  │     │     ├─ getUserMedia()    │
  │     │     ├─ liveMembers now   │
  │     │     │  has [caller.id]   │
  │     │     ├─ Create offer      │
  │     │     │  for caller        │
  │     │     └─ emit("handshake", │
  │     │        {to:caller.id,    │
  │     │         signal:offer})   │
  │                                ├─ processHandshake()
  │                                │  ├─ receiver NOT in onCallIds
  │                                │  │  → push(receiver.id)
  │                                │  ├─ signal.type !== "init-call"
  │                                │  │  → ackIds = [...onCallIds]
  │                                │  │  → processingAcks = true
  │                                │  ├─ emit("update-room-info",
  │                                │  │    signal: null)
  │                                │  └─ emit("handshake",
  │                                │       to:caller.id,
  │                                │       signal: offer)
  │                                │
```

### 4.3 Offer/Answer/ICE exchange

```
RECEIVER                    SERVER                   CALLER
  │                           │                        │
  │  (offer emitted above)    │                        │
  │                           ├─ handshake forwarded   │
  │                           │   to caller            │
  │                           │                        │◄─ handshake(offer)
  │                           │                        ├─ setRemoteDescription
  │                           │                        ├─ createAnswer
  │                           │                        ├─ setLocalDescription
  │                           │                        └─ emit("handshake",
  │                           │                           {to:receiver.id,
  │                           │                            signal:answer})
  │                           │                        │
  │◄─ handshake(answer) ──────┤                        │
  ├─ setRemoteDescription     │                        │
  ├─ flush pendingCandidates  │                        │
  │                           │                        │
  │  (both sides send ICE)    │                        │
  │◄═ candidate ─═════════════╪══════════════ candidate═┤
  ╪══════════════ candidate ══╪═══════════════► candidate►│
```

### 4.4 Ack flow (what happens after step 4.2)

After `processHandshake` adds the receiver to `onCallIds`:

```
SERVER
  │
  ├─ ackIds = ["caller.id", "receiver.id"]
  ├─ processingAcks = true
  ├─ emit("update-room-info", signal: null)
  │
  │  ┌─ CALLER receives update-room-info
  │  │  signal is null → signal?.type !== "init-call"
  │  │  → emit("ack", {roomName})
  │  │
  │  └─ RECEIVER receives update-room-info
  │     signal is null → signal?.type !== "init-call"
  │     → emit("ack", {roomName})
  │
  ├─ CALLER's ack arrives
  │  ackIds → ["receiver.id"]
  ├─ RECEIVER's ack arrives
  │  ackIds → []
  │  → processNextHandshake(roomName)
  │     queue empty → processingAcks = false
```

### 4.5 Third peer joins (while acks are pending)

```
THIRD PEER                      SERVER
  │                                │
  ├─ accept incoming call          │
  │  → startVideoCall()            │
  │  → emit("handshake",           │
  │     {to:existing_peer,         │
  │      signal:offer})            │
  │                                ├─ isNewCaller check:
  │                                │  has "to"? YES
  │                                │  in members? YES
  │                                │  in onCallIds? NO
  │                                │  → isNewCaller = true
  │                                ├─ processingAcks is TRUE
  │                                │  → QUEUE the handshake
  │                                ├─ handshakeQueue["room"] = [{socket,data}]
  │                                │
  │  (third peer's offer is queued │
  │   until acks clear)            │
  │                                │
  │  ╔══ acks clear ═══════════════╗
  │  ║ processNextHandshake()      ║
  │  ║ → dequeues third peer       ║
  │  ║ → processHandshake()        ║
  │  ║ → adds to onCallIds         ║
  │  ║ → sets ackIds again         ║
  │  ║ → forwards offer            ║
  │  ╚═════════════════════════════╝
```

Only **new callers** (not yet in `onCallIds`) are queued. ICE candidates and answers from existing callers pass through freely.

---

## 5. The Handshake Queue (Ack Synchronization)

### Why it exists

When multiple peers join a call simultaneously, the server emits `update-room-info` for each join. Without synchronization, a peer might receive `update-room-info` about a new participant before receiving the forwarded offer from that participant, causing inconsistent state.

### Implementation

```
handshakeQueue:  roomName → [{ socket, data }]
processingAcks:  roomName → boolean
ackIds:          roomName → [socket.id, ...]
```

**How a handshake is processed:**

```
socket.on("handshake", data)
  │
  ├─ isNewCaller?
  │  data.to exists
  │  AND socket in members
  │  AND socket NOT in onCallIds
  │
  ├─ YES + processingAcks[room] is TRUE
  │  → push to handshakeQueue[room]
  │  → return
  │
  └─ NO → processHandshake(socket, data)
```

**How `processHandshake` works:**

```
processHandshake(socket, data)
  │
  ├─ socket NOT in onCallIds AND socket in members?
  │  YES → onCallIds.push(socket.id)
  │       → emit update-room-info
  │       → if NOT an init-call:
  │            ackIds = copy of onCallIds
  │            processingAcks = true
  │
  └─ data.to exists AND data.to in onCallIds?
     → forward handshake to data.to
```

**How acks are collected:**

```
socket.on("ack", { roomName })
  │
  ├─ socket.id in ackIds[roomName]
  │  → remove from ackIds
  │
  └─ ackIds[roomName] is now empty?
     → processNextHandshake(roomName)
```

**How `processNextHandshake` works:**

```
processNextHandshake(roomName)
  │
  ├─ handshakeQueue[roomName] empty?
  │  → processingAcks = false
  │  → return
  │
  └─ dequeue next { socket, data }
     → processHandshake(socket, data)
```

### Edge cases handled

| Scenario | Handling |
|----------|----------|
| Disconnect during ack wait | `disconnect` handler removes socket from `ackIds`; if empty, triggers `processNextHandshake` |
| Exit video during ack wait | `exit-video` handler removes socket from `ackIds`; if empty, triggers `processNextHandshake` |
| Init-call doesn't set acks | `init-call` type is excluded from ack wait — first caller doesn't need synchronization |
| Existing caller sends ICE/answer | `isNewCaller` is false → passes through without queuing |

---

## 6. ICE, STUN, and TURN

### Configuration

```js
const iceConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};
const peerConfig = { ...iceConfiguration, offerExtmapAllowMixed: true };
```

### When ICE fails

If `iceConnectionState` reaches `failed`, both peers are behind strict NAT. A TURN server is needed.

### Per-connection ICE setup

```js
function getOrCreatePeerConnection(id, stream) {
  let pc = peerConnections.get(id);
  if (pc) return pc;
  pc = new RTCPeerConnection(peerConfig);
  peerConnections.set(id, pc);
  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }
  return pc;
}
```

The `onicecandidate` handler is set per-connection inside `startVideoCall` and the `handshake` handler (for offer receivers). Both emit candidates via:

```js
pc.onicecandidate = (e) => {
  if (e.candidate && peerConnections.get(peerId) === pc) {
    socket.emit("handshake", {
      id: socket.id,
      to: peerId,
      room: { name: currentRoom },
      signal: { type: "candidate", candidate: e.candidate },
    });
  }
};
```

The `peerConnections.get(peerId) === pc` guard prevents stale candidates from being sent after a peer connection is replaced.

---

## 7. Cleanup & Edge Cases

### 7.1 Exiting the video call

```
User clicks "End Call"
  │
  ├─ cleanupVideoCall()
  │  ├─ stop all localStream tracks
  │  ├─ close all RTCPeerConnections
  │  ├─ clear peerConnections Map
  │  ├─ clear pendingCandidates
  │  ├─ remove all remote video elements
  │  └─ updateStyles()
  │
  ├─ videoModal.style.display = "none"
  │
  └─ emit("exit-video", { room: { name: currentRoom } })
```

Server-side:

```
socket.on("exit-video")
  │
  ├─ onCallIds = onCallIds.filter(id => id !== socket.id)
  ├─ if socket in ackIds → remove, check if empty
  ├─ emit("update-room-info") to all room members
  └─ broadcast("exit-video", { id: socket.id }) to room
```

### 7.2 Disconnect

```
socket.on("disconnect")
  │
  for each room in Object.keys(rooms):
    ├─ members = members.filter(id => id !== socket.id)
    ├─ onCallIds = onCallIds.filter(id => id !== socket.id)
    ├─ if socket in ackIds → remove, check if empty
    ├─ emit("update-room-info") to room
    └─ broadcast("exit-room", { id: socket.id })
```

### 7.3 Page navigation (client)

`closeAllSockets()` in `loadfunc.js`:

```
closeAllSockets(socket)
  │
  ├─ socket.off(... all event names ...)
  ├─ stop local video tracks
  ├─ stop all remote video tracks
  ├─ clear video modal container
  ├─ hide video modal
  └─ window.incomingCallClose() if exists
```

---

## 8. Common Bugs and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Remote video blank | Autoplay blocked by browser | Ensure `autoplay playsinline` on `<video>`, try muted autoplay |
| Remote video blank | `srcObject` set before `onloadedmetadata` | Call `video.play()` after setting `srcObject` |
| ICE stuck at `checking` | No STUN/TURN or network issue | Check ICE server config; add TURN for strict NAT |
| Queue grows forever | `ackIds` includes sockets not on room page | Fixed: `ackIds` only includes `onCallIds` (video participants) |
| Busy-wait blocks server | `while (ackIds.length > 0)` spin-loop | Fixed: non-blocking queue with event-driven `ack` handler |
| `addIceCandidate` throws | Candidate arrives before `setRemoteDescription` | Buffer in `pendingCandidates` Map, flush after remote description is set |
| Peer sees own video as remote | Self not filtered from `liveMembers` | `onCallIds.filter(m => m !== socket.id)` removes self |
| Stale peer connection persists | `exit-room` handler missing | `exit-room` handler calls `closePeerConnection(id)` |
| Second caller can't join | Queue deadlock from previous session | Server restart clears `ackIds`, `handshakeQueue`, `processingAcks` |
| Firefox getUserMedia hangs | Permission prompt blocked or camera busy | 10s timeout via `Promise.race`; check camera permissions |
