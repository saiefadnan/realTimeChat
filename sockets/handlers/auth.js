const jwt = require("jsonwebtoken");
const state = require("../state");
const { gatherChunksMap } = require("../../services/storage/googleDrive");

const secretKey = process.env.JWT_SECRET;

function verifyToken(token) {
  try {
    return jwt.verify(token, secretKey);
  } catch {
    return null;
  }
}

function emitActiveUsers(io, operation, name, photo, socket) {
  const activeUsers = Object.values(state.names);
  const profile = Object.values(state.photos);
  const mds = activeUsers.map((u) => state.moods[u] || "");

  if (operation === "init" || operation === "refresh") {
    io.to(socket.id).emit("init activeUsers", {
      activeUsers,
      profile,
      moods: mds,
    });
  } else if (operation === "add" || operation === "update") {
    const mood = state.moods[name] || "";
    io.emit("activeUsers", { operation, name, photo, mood });
  } else {
    io.emit("activeUsers", { operation, name });
  }
}

function handleShowActiveUsers(socket, io) {
  if (Object.keys(state.names).length > 0) {
    emitActiveUsers(io, "init", null, null, socket);
  }
}

function handleInsertName(socket, io, { jwtoken }) {
  const decoded = verifyToken(jwtoken);
  if (!decoded) {
    io.to(socket.id).emit("error", {
      error: "Invalid or expired session. Please log in again.",
    });
    return;
  }

  const { username, imageurl } = decoded;

  const existingSocketId = state.users[username];
  if (existingSocketId && existingSocketId !== socket.id) {
    const existingSocket = state.socIns[username];
    if (existingSocket && existingSocket.connected) {
      io.to(existingSocketId).emit("error", { error: "999" });
      existingSocket.disconnect(true);
    }
    delete state.users[username];
    delete state.socIns[username];
  }

  state.users[username] = socket.id;
  state.names[socket.id] = username;
  state.photos[socket.id] = imageurl;
  state.socIns[username] = socket;

  if (Object.keys(state.names).length > 0) {
    emitActiveUsers(io, "init", null, null, socket);
    emitActiveUsers(io, "add", username, imageurl, socket);
  }
}

function handleDisconnect(socket, io) {
  const { processNextHandshake } = require("./webrtc");
  const username = state.names[socket.id];

  for (const roomName of Object.keys(state.rooms)) {
    state.rooms[roomName].members = state.rooms[roomName].members.filter(
      (id) => id !== socket.id,
    );
    state.rooms[roomName].onCallIds = state.rooms[roomName].onCallIds.filter(
      (id) => id !== socket.id,
    );

    if (state.ackIds[roomName] && state.ackIds[roomName].includes(socket.id)) {
      state.ackIds[roomName] = state.ackIds[roomName].filter(
        (id) => id !== socket.id,
      );
      if (state.ackIds[roomName].length === 0) {
        processNextHandshake(io, roomName);
      }
    }

    io.to(roomName).emit("update-room-info", {
      name: roomName,
      memberIds: state.rooms[roomName]?.members || [],
      onCallIds: state.rooms[roomName]?.onCallIds || [],
    });
    socket.broadcast.to(roomName).emit("exit-room", { id: socket.id });
  }

  if (username) {
    emitActiveUsers(io, "remove", username, null, socket);
    delete state.users[username];
    delete state.socIns[username];
  }
  delete state.names[socket.id];
  delete state.photos[socket.id];

  gatherChunksMap.delete(socket.id);
}

module.exports = { handleShowActiveUsers, handleInsertName, handleDisconnect, emitActiveUsers };
