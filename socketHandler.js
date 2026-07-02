const jwt = require("jsonwebtoken");
const { uploadFile, gatherChunksMap } = require("./Gdrive");
const { storeChats } = require("./storeChats");

const secretKey = process.env.JWT_SECRET;

// In-memory user maps — exported so cron job / chatData can access them
const users = {}; // username   → socket.id
const names = {}; // socket.id  → username
const photos = {}; // socket.id  → profile picture URL
const socIns = {}; // username   → socket instance
const moods = {}; // username   → emoji mood
const rooms = {};

/**
 * Verifies a JWT and extracts { username, imageurl }.
 * Returns null on failure instead of throwing — keeps socket handlers clean.
 * @param {string} token
 * @returns {{ username: string, imageurl: string } | null}
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, secretKey);
  } catch {
    return null;
  }
}

/**
 * Broadcasts the active user list to the appropriate target(s).
 * @param {import('socket.io').Server} io
 * @param {'init'|'refresh'|'add'|'remove'} operation
 * @param {string|null} name
 * @param {string|null} photo
 * @param {import('socket.io').Socket} socket
 */
function emitActiveUsers(io, operation, name, photo, socket) {
  const activeUsers = Object.values(names);
  const profile = Object.values(photos);
  const mds = activeUsers.map((u) => moods[u] || "");

  if (operation === "init" || operation === "refresh") {
    io.to(socket.id).emit("init activeUsers", {
      activeUsers,
      profile,
      moods: mds,
    });
  } else if (operation === "add" || operation === "update") {
    const mood = moods[name] || "";
    io.emit("activeUsers", { operation, name, photo, mood });
  } else {
    io.emit("activeUsers", { operation, name });
  }
}

/**
 * Registers all Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Show currently active users to this socket ──────────────────────
    socket.on("show active-users", () => {
      if (Object.keys(names).length > 0) {
        emitActiveUsers(io, "init", null, null, socket);
      }
    });

    // ── Register user identity (requires valid JWT) ─────────────────────
    socket.on("insert name", ({ jwtoken }) => {
      const decoded = verifyToken(jwtoken);
      if (!decoded) {
        io.to(socket.id).emit("error", {
          error: "Invalid or expired session. Please log in again.",
        });
        return;
      }

      const { username, imageurl } = decoded;

      if (users[username]) {
        // Username already connected on another socket
        io.to(socket.id).emit("error", { error: "999" });
        return;
      }

      users[username] = socket.id;
      names[socket.id] = username;
      photos[socket.id] = imageurl;
      socIns[username] = socket;

      console.log(`[Socket] Registered user: ${username}`);

      if (Object.keys(names).length > 0) {
        emitActiveUsers(io, "init", null, null, socket);
        emitActiveUsers(io, "add", username, imageurl, socket);
      }
    });

    // ── File chunk collection (per-socket buffer) ───────────────────────
    // Each socket gets its own chunk buffer to prevent race conditions
    // when multiple users upload files simultaneously.
    const chunkHandlers = [
      "private image",
      "public image",
      "private video",
      "public video",
      "public file",
      "private file",
      "room file",
    ];
    chunkHandlers.forEach((event) => {
      socket.on(event, ({ fileData }) => {
        if (!gatherChunksMap.has(socket.id)) {
          gatherChunksMap.set(socket.id, []);
        }
        gatherChunksMap.get(socket.id).push(fileData);
      });
    });

    // ── Complete file upload (flush buffer) ─────────────────────────────
    socket.on("complete", async ({ to, fileType, fileName }) => {
      const date = new Date().toLocaleString();
      const fromUsername = names[socket.id];

      try {
        // uploadFile now reads from per-socket buffer
        if (to === "public") {
          let docUrl;
          if (fileType.startsWith("image/")) {
            docUrl = await uploadFile(socket.id, "image", fileName);
            await storeChats(fromUsername, "public", docUrl, "image", date);
            io.emit("public image", {
              from: fromUsername,
              time: Date.now(),
              fileData: docUrl,
              profile: photos[socket.id],
              state: true,
            });
          } else if (fileType.startsWith("video/")) {
            docUrl = await uploadFile(socket.id, "video", fileName);
            await storeChats(fromUsername, "public", docUrl, "video", date);
            io.emit("public video", {
              from: fromUsername,
              time: Date.now(),
              fileData: docUrl,
              profile: photos[socket.id],
              state: true,
            });
          } else {
            docUrl = await uploadFile(socket.id, "document", fileName);
            await storeChats(fromUsername, "public", docUrl, "document", date);
            io.emit("public file", {
              from: fromUsername,
              time: Date.now(),
              fileData: docUrl,
              fileName,
              profile: photos[socket.id],
              state: true,
            });
          }
        } else {
          const recipientSocketId = users[to]; // `to` is a username
          let docUrl;

          if (fileType.startsWith("image/")) {
            docUrl = await uploadFile(socket.id, "image", fileName);
            await storeChats(fromUsername, to, docUrl, "image", date); // FIX: was names[recipientSocketId]
          } else if (fileType.startsWith("video/")) {
            docUrl = await uploadFile(socket.id, "video", fileName);
            await storeChats(fromUsername, to, docUrl, "video", date);
          } else {
            docUrl = await uploadFile(socket.id, "document", fileName);
            await storeChats(fromUsername, to, docUrl, "document", date);
          }

          if (recipientSocketId) {
            const eventName = fileType.startsWith("image/")
              ? "private image"
              : fileType.startsWith("video/")
                ? "private video"
                : "private file";
            const payload = {
              from: fromUsername,
              time: Date.now(),
              fileData: docUrl,
              profile: photos[socket.id],
              state: true,
            };
            if (
              !fileType.startsWith("image/") &&
              !fileType.startsWith("video/")
            )
              payload.fileName = fileName;
            [recipientSocketId, socket.id].forEach((id) =>
              io.to(id).emit(eventName, payload),
            );
          } else {
            io.to(socket.id).emit("error", {
              error: `${to} is not currently online.`,
            });
          }
        }
      } catch (err) {
        console.error("[Socket] File upload error:", err);
        io.to(socket.id).emit("error", {
          error: "File upload failed. Please try again.",
        });
      }
    });

    // ── Room file upload ────────────────────────────────────────────────
    socket.on("room file complete", async ({ room, fileType, fileName }) => {
      const fromUsername = names[socket.id];
      try {
        let docUrl;
        let event = "room file";
        const payload = {
          from: fromUsername,
          time: Date.now(),
          profile: photos[socket.id],
        };

        if (fileType.startsWith("image/")) {
          docUrl = await uploadFile(socket.id, "image", fileName);
        } else if (fileType.startsWith("video/")) {
          docUrl = await uploadFile(socket.id, "video", fileName);
        } else {
          docUrl = await uploadFile(socket.id, "document", fileName);
          payload.fileName = fileName;
        }

        payload.fileData = docUrl;
        io.to(room.name).emit(event, payload);
      } catch (err) {
        console.error("[Socket] Room file upload error:", err);
        io.to(socket.id).emit("error", { error: "Room file upload failed." });
      }
    });

    // ── Text messaging ──────────────────────────────────────────────────
    socket.on("private message", async ({ to, message, date }) => {
      if (!message || !message.trim()) return;
      const fromUsername = names[socket.id];
      const recipientSocketId = users[to];

      if (recipientSocketId) {
        try {
          await storeChats(fromUsername, to, message, "text", date);
          io.to(recipientSocketId).emit("private message", {
            from: fromUsername,
            time: Date.now(),
            message,
            profile: photos[socket.id],
          });
        } catch (err) {
          console.error("[Socket] storeChats error:", err);
        }
      } else {
        io.to(socket.id).emit("error", {
          error: `${to} is not currently online.`,
        });
      }
    });

    socket.on("public message", async (message, date) => {
      if (!message || !message.trim()) return;
      const fromUsername = names[socket.id];
      try {
        await storeChats(fromUsername, "public", message, "text", date);
        socket.broadcast.emit("public message", {
          from: fromUsername,
          time: Date.now(),
          message,
          profile: photos[socket.id],
        });
      } catch (err) {
        console.error("[Socket] storeChats error:", err);
      }
    });

    // ── Room management ─────────────────────────────────────────────────
    socket.on("create-room", ({ room }) => {
      socket.join(room.name);
      rooms[room.name] = {
        admin: room.admin,
        created_at: Date.now(),
        members: [],
      };
      io.to(room.name).emit("room-created", {
        notify: `Room "${room.name}" created by ${room.admin}`,
      });
    });

  
    socket.on("invite", ({ room, usernames }) => {
      for (const username of usernames) {
        if (socIns[username]) {
          socIns[username].join(room.name);
          rooms[room.name].members.push(users[username]);
        }
      }
      socket.broadcast.to(room.name).emit("invitation", {
        name: room.name,
        notify: `${names[socket.id]} added you to room "${room.name}"`,
      });
      io.to(socket.id).emit("invited", {
        notify: `Invited: ${usernames.join(", ")}`,
      });
      io.to(room.name).emit("room-info", {
        name: room.name,
        admin: rooms[room.name].admin,
        created_at: rooms[room.name].created_at,
        memberIds: rooms[room.name].members,
      });
    });

    socket.on("room message", ({ room, message, date }) => {
      if (!message || !message.trim()) return;
      socket.broadcast.to(room.name).emit("room message", {
        from: names[socket.id],
        time: Date.now(),
        message,
        profile: photos[socket.id],
      });
    });

    // ── Gen Z Features: Typing & Moods ──────────────────────────────────
    socket.on("typing", ({ to }) => {
      if (to === "public") {
        socket.broadcast.emit("user-typing", {
          from: names[socket.id],
          to: "public",
        });
      } else if (users[to]) {
        io.to(users[to]).emit("user-typing", {
          from: names[socket.id],
          to: "private",
        });
      }
    });

    socket.on("stop-typing", ({ to }) => {
      if (to === "public") {
        socket.broadcast.emit("user-stop-typing", {
          from: names[socket.id],
          to: "public",
        });
      } else if (users[to]) {
        io.to(users[to]).emit("user-stop-typing", {
          from: names[socket.id],
          to: "private",
        });
      }
    });

    socket.on("update-mood", ({ mood }) => {
      const username = names[socket.id];
      if (username) {
        moods[username] = mood;
        emitActiveUsers(io, "update", username, photos[socket.id], socket);
      }
    });

    // ── WebRTC signaling ────────────────────────────────────────────────
    socket.on("initiator", ({ room }) => {
      rooms[room.name].initiator = rooms[room.name].initiator ?? socket.id;
    });
    socket.on("handshake", ({ room, signal }) => {
      const memberIds = rooms[room.name]?.members || [];
      for (const memberId of memberIds) {
        io.to(memberId).emit("handshake", { id: socket.id, room, signal });
      }
    });
    socket.on("mesh-connection", ({ room, to }) => {
      if (socket.id !== rooms[room.name]?.initiator) return;
      io.to(to).emit("handshake", { id: socket.id, room, signal: { type: "mesh-request" } });
    });
    socket.on("exit-room", ({ room }) => {
      socket.broadcast.to(room.name).emit("exit-room", { id: socket.id });
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const username = names[socket.id];
      console.log(
        `[Socket] Disconnected: ${socket.id} (${username || "unregistered"})`,
      );

      if (username) {
        emitActiveUsers(io, "remove", username, null, socket);
        delete users[username];
        delete socIns[username];
      }
      delete names[socket.id];
      delete photos[socket.id];

      // Clean up per-socket chunk buffer
      gatherChunksMap.delete(socket.id);

      console.log(`[Socket] Active connections: ${Object.keys(users).length}`);
    });
  });
}

module.exports = { socketHandler, names, photos, users };
