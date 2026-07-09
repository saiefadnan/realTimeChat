# RealTimeChat

**Mesh‑topology WebRTC video calls + real‑time chat + segmented file uploads + live room call indicators, all vanilla JS.**

A full‑stack real‑time communication platform where the frontend is a zero‑framework SPA, the signaling layer runs on Socket.IO, and the media plane is pure peer‑to‑peer. Built for the browser, not for slides.

---

## ✨ What it actually does

### Real‑time messaging
Instant room‑based and private messaging over Socket.IO, persisted in **Firestore**. Message history, typing indicators, online presence — the usual suspects, done solid.

### Mesh WebRTC video calls
Not a toy "foundational support" — a working **mesh‑topology** call system. Every peer opens a dedicated `RTCPeerConnection` to every other peer. The server only relays signaling (offers, answers, ICE candidates); media never touches the backend.

**The hard part:** When multiple people join a call at the same instant, the server serializes joins through a **non‑blocking handshake queue with ack synchronization**. No busy‑wait loops, no deadlocks, no race conditions. The queue accepts handshake events, processes them one at a time, and waits for every participant to acknowledge the updated room state before moving to the next join. (Read the gory details in [`docs/video-call-workflow.md`](docs/video-call-workflow.md).)

ICE candidates are buffered until the remote description is set. Stale connections are guarded by identity checks. The whole thing is about 600 lines of client‑side JS — no framework, no library, no magic.

### Live room call indicators
Every room in the sidebar displays a glowing green dot when a video call is active in that room. The dot appears/disappears in real time — driven by `update-room-info` socket events — so you always know which rooms are live before you click in.

### Segmented file uploads with SHA‑256 dedup
Files are split into **512 KB chunks** and uploaded over Socket.IO to Google Drive. The server computes a SHA‑256 hash of each file before upload; identical files are deduplicated automatically. A per‑socket chunk buffer (`gatherChunksMap`, keyed by `socket.id`) prevents interleaving when multiple users upload simultaneously.

### Dual‑database architecture
- **MongoDB (Mongoose)** — users, authentication, persistent records
- **Firestore** — chat messages, rooms, real‑time data

This is not accidental. Metadata lives in MongoDB. High‑velocity, high‑volume real‑time data lives in Firestore. Each is used for what it does best.

### Enterprise‑grade auth (the boring but necessary part)
- JWT with 30‑day expiry
- Rate limiting: 10 requests / 15 min on auth endpoints, 200 / 15 min on the general API
- Helmet headers (CSP disabled intentionally for CDN scripts)
- 50 MB body parser limit
- Token accepted from `Authorization: Bearer` header **or** `req.body.token` (because sometimes you need both)

---

## 🧱 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS SPA (no framework, no build step) |
| Backend | Node.js, Express, Socket.IO |
| Real‑time signaling | Socket.IO |
| Peer media | WebRTC (mesh topology) |
| Users / auth | MongoDB (Mongoose) |
| Messages / rooms | Firestore |
| File storage | Google Drive API (chunked upload) |
| Profile pics | Cloudinary |

---

## 🚀 Getting started

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas account
- Firebase service account (Firestore)

### Setup

```bash
npm install
```

Create a `.env` file based on [`.env.example`](.env.example). Key requirements:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — token signing secret
- `FIREBASE_SERVICE_ACCOUNT` — path to your Firebase service account JSON
- `GDRIVE_FOLDER_ID` — Google Drive folder ID for file uploads

Also place your Firebase service account JSON in the `private/` directory (gitignored).

**Start the server:**

```bash
node server.js
```

(There is no `npm run dev` script. Use `npx nodemon server.js` if you want auto‑restart.)

The app runs on **port 4000** by default.

### Tests

```bash
npm test
```

Three Jest test files covering the UMD media preview module, all 7 socket handler modules (auth, messaging, rooms, WebRTC, file chunks, typing, entry point), and all 3 Express controllers (auth, chat, room). Handlers are tested in isolation with mocked dependencies — no network, no database, no filesystem.

---

## 📁 Project structure

```
realTimeChat/
├── server.js                     # Express entrypoint
├── controllers/
│   ├── authController.js         # Login / signin
│   ├── chatController.js         # Chat history, search, cleanup cron
│   └── roomController.js         # Room CRUD, room chat history
├── sockets/
│   ├── chatSocket.js             # Socket.IO entry point (wires all events)
│   ├── state.js                  # In‑memory maps (users, rooms, ackIds, …)
│   └── handlers/
│       ├── auth.js               # JWT verify, duplicate‑session kill (999)
│       ├── messaging.js          # Private / public / room messages
│       ├── fileChunks.js         # Chunked file upload state per socket
│       ├── rooms.js              # Room create, join, invite
│       ├── typing.js             # Typing indicators, mood updates
│       └── webrtc.js             # Handshake queue with ack sync
├── middleware/
│   ├── auth.js                   # JWT verification
│   └── rateLimiter.js            # IP‑based rate limiting
├── models/
│   └── User.js                   # Mongoose user schema + bcrypt hooks
├── config/
│   └── firebase.js               # Firestore client (service‑account JSON)
├── services/
│   ├── storage/
│   │   ├── googleDrive.js        # Chunked GDrive upload, SHA‑256 dedup
│   │   └── cloudinary.js         # Profile picture upload
│   └── database/
│       └── chatStore.js          # Firestore CRUD helpers
├── public/
│   ├── index.html                # SPA shell
│   ├── loadfunc.js               # Page loader (loadPage, closeSockets)
│   ├── components/
│   │   ├── chatMessage.js        # Message rendering (text, files, embeds)
│   │   ├── uploadProgress.js     # Upload progress bar factory
│   │   ├── typingIndicator.js    # Typing indicator UI factory
│   │   ├── notificationDrawer.js # Room‑live notification drawer
│   │   ├── webRTC.js             # WebRTCManager class (mesh peer mgmt)
│   │   └── incomingCallModal.js  # Incoming call modal (IIFE, not a module)
│   ├── views/
│   │   ├── dynamic_chat_91235.js # Chat page (private + public messaging)
│   │   ├── dynamic_room_91235.js # Room page (rooms list, video calls, green dot)
│   │   └── dynamic_*_91235.html  # HTML shells loaded by loadPage()
│   ├── css/
│   │   └── styles.css            # All styles (CSS custom properties)
│   └── js/                       # Legacy / utility scripts
├── docs/
│   └── video-call-workflow.md    # Deep dive into the WebRTC implementation
└── __tests__/
    ├── chatMediaPreview.test.js   # UMD module test (fake document)
    └── handlers/
        ├── socketHandlers.test.js # All 7 socket handler modules
        └── apiControllers.test.js # All 3 Express controllers
```

---

## 📐 Architecture highlights

### Chat cleanup cron
Every hour, the server deletes Firestore chats older than 5 hours and removes their associated files from Google Drive. Defined in `controllers/controller.js:351`.

### Error code 999
When a user is already logged in elsewhere, the server kicks the old session and sends error code `999`. The client redirects to login.

### WebRTC signaling topology

```
     socket.emit("handshake", { signal })
          │
          ▼
    Server processHandshake()
     ├── Adds caller to onCallIds
     ├── Sets ackIds (all current call participants)
     ├── Sets processingAcks = true
     ├── Broadcasts update-room-info
     └── Forwards signal to recipient
          │
          ▼
    Recipient: setRemoteDescription → createAnswer → candidate
          │
          ▼
    Server forwards (no ack wait for existing callers)
          │
          ▼
    Original caller receives answer / candidates
```

When a third peer joins during an active call, their handshake is queued (`handshakeQueue[room]`) until all participants acknowledge the current room state. This prevents a peer from receiving a "new participant" notification before receiving that participant's offer.

---

## ⚠️ Known quirks (read before contributing)

- **No `npm run dev`** — README says it exists; it doesn't. Use `npx nodemon server.js`.
- **Azure Blob code exists but is unused** — there's an `azure.js` from an earlier iteration. It's dead code.
- **CSP is disabled** (`contentSecurityPolicy: false`) — CDN‑loaded scripts depend on it. Don't re‑enable without testing.
- **`.env.example` shows individual Firebase fields** but `config/firebase.js` actually loads a service account JSON file. Set `FIREBASE_SERVICE_ACCOUNT` to the JSON path.
- **Pending messages queue** — `window.Pending()` buffers messages/files during disconnect and flushes on reconnect (5s delay).
- **File upload race** — per‑socket chunk buffer in `gatherChunksMap` (keyed by `socket.id`), NOT a global array.
- **Dynamic page scripts** are loaded as regular `<script>` tags (not `type="module"`); view files use dynamic `import()` to load ES modules from `components/`.
- **Dynamic page scripts** register cleanup in `window.eventListeners[]`, which runs on page transition.
- **Error code `999`** from server means "already logged in elsewhere" — client redirects to login.
- **`--forceExit`** may be needed when running Jest because the hourly chat cleanup cron keeps a handle open.

---

*Developed with focus on engineering substance over framework hype. No Node modules were harmed in the making of this README.*
