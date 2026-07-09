const state = require("../state");

function processHandshake(io, socket, { id, to, room, signal }) {
  const isCallOngoing =
    state.rooms[room.name] && state.rooms[room.name].onCallIds.length > 0;

  if (
    !state.rooms[room.name]?.onCallIds.includes(socket.id) &&
    state.rooms[room.name]?.members.includes(socket.id)
  ) {
    state.rooms[room.name].onCallIds.push(socket.id);
    io.to(room.name).emit("update-room-info", {
      name: room.name,
      signal:
        !isCallOngoing && signal?.type === "init-call"
          ? { ...signal, callerId: socket.id, room, callerName: state.names[socket.id] }
          : null,
      memberIds: state.rooms[room.name].members || [],
      onCallIds: state.rooms[room.name].onCallIds || [],
    });
    if (signal?.type !== "init-call") {
      state.ackIds[room.name] = [...state.rooms[room.name].onCallIds];
      state.processingAcks[room.name] = true;
    }
  }
  if (to && state.rooms[room.name].onCallIds.includes(to)) {
    io.to(to).emit("handshake", { id: socket.id, room, signal });
  }
}

function processNextHandshake(io, roomName) {
  if (!state.handshakeQueue[roomName] || state.handshakeQueue[roomName].length === 0) {
    state.processingAcks[roomName] = false;
    return;
  }
  state.processingAcks[roomName] = true;
  const { socket: qs, data } = state.handshakeQueue[roomName].shift();
  processHandshake(io, qs, data);
}

function handleHandshake(socket, io, data) {
  const isNewCaller =
    data.to &&
    state.rooms[data.room.name]?.members.includes(socket.id) &&
    !state.rooms[data.room.name]?.onCallIds.includes(socket.id);

  if (isNewCaller && state.processingAcks[data.room.name]) {
    if (!state.handshakeQueue[data.room.name]) {
      state.handshakeQueue[data.room.name] = [];
    }
    state.handshakeQueue[data.room.name].push({ socket, data });
    return;
  }
  processHandshake(io, socket, data);
}

function handleRejectCall(socket, io, { to, room }) {
  io.to(to).emit("reject-call", {
    id: socket.id,
    room,
    username: state.names[socket.id] || "Unknown",
  });
}

function handleExitVideo(socket, io, { room }) {
  if (state.rooms[room.name]) {
    state.rooms[room.name].onCallIds = state.rooms[room.name].onCallIds.filter(
      (id) => id !== socket.id,
    );
  }

  if (state.ackIds[room.name]) {
    state.ackIds[room.name] = state.ackIds[room.name].filter((id) => id !== socket.id);
    if (state.ackIds[room.name].length === 0) {
      processNextHandshake(io, room.name);
    }
  }

  io.to(room.name).emit("update-room-info", {
    name: room.name,
    memberIds: state.rooms[room.name]?.members || [],
    onCallIds: state.rooms[room.name]?.onCallIds || [],
  });
  socket.broadcast.to(room.name).emit("exit-video", { id: socket.id });
}

function handleAck(socket, io, { roomName }) {
  if (state.ackIds[roomName] && state.ackIds[roomName].includes(socket.id)) {
    state.ackIds[roomName] = state.ackIds[roomName].filter((id) => id !== socket.id);
    if (state.ackIds[roomName].length === 0) {
      processNextHandshake(io, roomName);
    }
  }
}

module.exports = { processNextHandshake, handleHandshake, handleRejectCall, handleExitVideo, handleAck };
