const { gatherChunksMap } = require("../../services/storage/googleDrive");

const CHUNK_EVENTS = [
  "private image",
  "public image",
  "private video",
  "public video",
  "public file",
  "private file",
  "room file",
];

function setupChunkHandlers(socket) {
  CHUNK_EVENTS.forEach((event) => {
    socket.on(event, ({ fileData }) => {
      if (!gatherChunksMap.has(socket.id)) {
        gatherChunksMap.set(socket.id, []);
      }
      gatherChunksMap.get(socket.id).push(fileData);
    });
  });
}

module.exports = { setupChunkHandlers };
