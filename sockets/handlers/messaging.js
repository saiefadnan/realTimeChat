const state = require("../state");
const {
  uploadFile,
  gatherChunksMap,
} = require("../../services/storage/googleDrive");
const { storeChats } = require("../../services/database/chatStore");

async function handlePrivateMessage(socket, io, { to, message, date }) {
  if (!message || !message.trim()) return;
  const fromUsername = state.names[socket.id];
  if (!fromUsername) return;
  const recipientSocketId = state.users[to];

  if (recipientSocketId) {
    try {
      await storeChats(fromUsername, to, message, "text", date);
      io.to(recipientSocketId).emit("private message", {
        from: fromUsername,
        time: Date.now(),
        message,
        profile: state.photos[socket.id],
      });
    } catch (err) {
      console.error("[Socket] storeChats error:", err);
    }
  } else {
    io.to(socket.id).emit("error", {
      error: `${to} is not currently online.`,
    });
  }
}

async function handlePublicMessage(socket, io, { message, date }) {
  if (!message || !message.trim()) return;
  const fromUsername = state.names[socket.id];
  if (!fromUsername) return;
  try {
    await storeChats(fromUsername, "public", message, "text", date);
    socket.broadcast.emit("public message", {
      from: fromUsername,
      time: Date.now(),
      message,
      profile: state.photos[socket.id],
    });
  } catch (err) {
    console.error("[Socket] storeChats error:", err);
  }
}

async function handleRoomMessage(socket, io, { room, message, date }) {
  if (!message || !message.trim()) return;
  const fromUsername = state.names[socket.id];
  if (!fromUsername) return;
  socket.broadcast.to(room.name).emit("room message", {
    roomName: room.name,
    from: fromUsername,
    time: Date.now(),
    message,
    profile: state.photos[socket.id],
  });
  storeChats(
    fromUsername,
    room.name,
    message,
    "text",
    date || new Date().toLocaleString(),
  );
}

function classifyFile(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

async function handleComplete(socket, io, { to, fileType, fileName }) {
  const date = new Date().toLocaleString();
  const fromUsername = state.names[socket.id];
  if (!fromUsername) return;

  try {
    if (to === "public") {
      const chatType = classifyFile(fileType);
      const docUrl = await uploadFile(socket.id, chatType, fileName);
      await storeChats(fromUsername, "public", docUrl, chatType, date);
      const eventName = `public ${chatType === "document" ? "file" : chatType}`;
      const payload = {
        from: fromUsername,
        time: Date.now(),
        fileData: docUrl,
        profile: state.photos[socket.id],
        state: true,
      };
      if (chatType === "document") payload.fileName = fileName;
      io.emit(eventName, payload);
    } else {
      const recipientSocketId = state.users[to];
      const chatType = classifyFile(fileType);
      const docUrl = await uploadFile(socket.id, chatType, fileName);
      await storeChats(fromUsername, to, docUrl, chatType, date);

      if (recipientSocketId) {
        const eventName = `private ${chatType === "document" ? "file" : chatType}`;
        const payload = {
          from: fromUsername,
          time: Date.now(),
          fileData: docUrl,
          profile: state.photos[socket.id],
          state: true,
        };
        if (chatType === "document") payload.fileName = fileName;
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
}

async function handleRoomFileComplete(socket, io, { room, fileType, fileName }) {
  const fromUsername = state.names[socket.id];
  if (!fromUsername) return;
  try {
    const chatType = classifyFile(fileType);
    const docUrl = await uploadFile(socket.id, chatType, fileName);
    const payload = {
      from: fromUsername,
      time: Date.now(),
      fileData: docUrl,
      fileType,
      profile: state.photos[socket.id],
      roomName: room.name,
    };
    if (chatType === "document") payload.fileName = fileName;

    io.to(room.name).emit("room file", payload);
    storeChats(fromUsername, room.name, docUrl, chatType, new Date().toLocaleString());
  } catch (err) {
    console.error("[Socket] Room file upload error:", err);
    io.to(socket.id).emit("error", { error: "Room file upload failed." });
  }
}

module.exports = { handlePrivateMessage, handlePublicMessage, handleRoomMessage, handleComplete, handleRoomFileComplete };
