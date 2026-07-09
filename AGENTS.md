# RealTimeChat — Agent Guide

## Entrypoints

- **Server**: `server.js` — Express + Socket.IO on port 4000
- **Frontend SPA**: `public/index.html` loads pages dynamically as `dynamic_*_91235.html` + companion `.js`

## Commands

| Command | What it does |
|---------|-------------|
| `npm start` | `node server.js` |
| `npm test` | `jest --runInBand` (single test: `__tests__/chatMediaPreview.test.js`) |

No `dev` script in `package.json` (README says `npm run dev` but it doesn't exist — use `npx nodemon server.js` if needed).

## Architecture

- **Database**: MongoDB (Mongoose) for users; **Firestore** for chat messages & rooms
- **Auth**: JWT (30d expiry). `middleware/auth.js` accepts token from `Authorization: Bearer` header OR `req.body.token`
- **Rate limiting**: Auth endpoints 10/15min; general API 200/15min (`middleware/rateLimiter.js`)
- **File storage**: Google Drive API (`Gdrive.js`) — chunked upload via Socket.IO (512KB chunks), SHA-256 dedup. Cloudinary for profile pics. Azure Blob code exists but is unused.
- **Chat cleanup**: Cron job hourly — deletes Firestore chats >5h old + their GDrive files (`controllers/controller.js:351`)
- **WebRTC**: Signaling infra in `socketHandler.js`; full reference in `docs/video-call-workflow.md`

## Client-side modules (`public/components/`)

View files (`views/dynamic_*.js`) dynamically import ES modules from `components/`:

| Module | Exports | Used by |
|--------|---------|---------|
| `components/chatMessage.js` | `addMessage`, `addMessageTo`, `embedDriveFiles`, `embedDriveFilesTo`, `addError`, `addOfflineTextPreview`, `addOfflineFilePreview`, `buildDrivePreview` | chat, room |
| `components/uploadProgress.js` | `createUploadProgress()` → `{addUploadProgress, updateChatProgress, removeUploadProgress}` | chat, room |
| `components/typingIndicator.js` | `createTypingIndicator(chatWrapper)` → `{typingUsers, updateTypingUI, indicatorEl}` | chat, room |
| `components/notificationDrawer.js` | `createNotificationDrawer()` → `show(msg, action?)` | room |
| `components/webRTC.js` | `default: WebRTCManager` class | room |
| `components/incomingCallModal.js` | `window.incomingCall()` via IIFE (loaded as `<script>`, not module) | room |

All components accept their dependencies (DOM refs, socket, etc.) explicitly — no global state coupling.

## Gotchas

- Frontend is vanilla JS SPA (no framework). Pages loaded via `loadPage()` in `public/loadfunc.js` — fetches `dynamic_{name}_91235.html`, appends `dynamic_{name}_91235.js` as script tag (NOT `type="module"`; view files use dynamic `import()` instead)
- View IIFEs use `import("../components/...")` — ensure all imports return a promise before wiring socket events
- Helmet CSP disabled (`contentSecurityPolicy: false`) — CDN-loaded scripts depend on it
- Body parser limit: 50mb
- `private/` contains Firebase service account JSONs (gitignored). Set `FIREBASE_SERVICE_ACCOUNT` env var to the JSON path
- `.env.example` shows individual Firebase fields but `firebase.js` actually loads a service account JSON file (not individual fields)
- Socket disconnect: pending messages/files queue via `window.Pending()` and flush on reconnect (5s delay)
- File upload race: per-socket chunk buffer in `gatherChunksMap` (keyed by socket.id), NOT a global array
- Error code `999` from server means "already logged in elsewhere" — client redirects to login
- Dynamic page scripts maintain `window.eventListeners[]` for cleanup on page transition

## Testing

- Single Jest test file tests `public/chatMediaPreview.js` (UMD module). Test creates a fake `document` since it runs in Node.
- Run: `npm test`
