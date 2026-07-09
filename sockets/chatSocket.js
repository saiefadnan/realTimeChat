const state = require("./state");
const { handleShowActiveUsers, handleInsertName, handleDisconnect } = require("./handlers/auth");
const { handlePrivateMessage, handlePublicMessage, handleRoomMessage, handleComplete, handleRoomFileComplete } = require("./handlers/messaging");
const { setupChunkHandlers } = require("./handlers/fileChunks");
const { handleJoinRooms, handleCreateRoom, handleInvite } = require("./handlers/rooms");
const { handleTyping, handleStopTyping, handleUpdateMood } = require("./handlers/typing");
const { handleHandshake, handleRejectCall, handleExitVideo, handleAck } = require("./handlers/webrtc");

function socketHandler(io) {
  io.on("connection", (socket) => {
    socket.on("show active-users", () => handleShowActiveUsers(socket, io));
    socket.on("insert name", (data) => handleInsertName(socket, io, data));
    setupChunkHandlers(socket);
    socket.on("complete", (data) => handleComplete(socket, io, data));
    socket.on("room file complete", (data) => handleRoomFileComplete(socket, io, data));
    socket.on("private message", (data) => handlePrivateMessage(socket, io, data));
    socket.on("public message", (data) => handlePublicMessage(socket, io, data));
    socket.on("room message", (data) => handleRoomMessage(socket, io, data));
    socket.on("join-rooms", (data) => handleJoinRooms(socket, io, data));
    socket.on("create-room", (data) => handleCreateRoom(socket, io, data));
    socket.on("invite", (data) => handleInvite(socket, io, data));
    socket.on("typing", (data) => handleTyping(socket, io, data));
    socket.on("stop-typing", (data) => handleStopTyping(socket, io, data));
    socket.on("update-mood", (data) => handleUpdateMood(socket, io, data));
    socket.on("handshake", (data) => handleHandshake(socket, io, data));
    socket.on("reject-call", (data) => handleRejectCall(socket, io, data));
    socket.on("exit-video", (data) => handleExitVideo(socket, io, data));
    socket.on("ack", (data) => handleAck(socket, io, data));
    socket.on("disconnect", () => handleDisconnect(socket, io));
  });
}

module.exports = { socketHandler, ...state };
