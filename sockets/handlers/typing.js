const state = require("../state");
const { emitActiveUsers } = require("./auth");

function handleTyping(socket, io, { to }) {
  if (to === "public") {
    socket.broadcast.emit("user-typing", {
      from: state.names[socket.id],
      to: "public",
    });
  } else if (state.users[to]) {
    io.to(state.users[to]).emit("user-typing", {
      from: state.names[socket.id],
      to: "private",
    });
  } else if (state.rooms[to]) {
    socket.broadcast.to(to).emit("user-typing", {
      from: state.names[socket.id],
      to: to,
    });
  }
}

function handleStopTyping(socket, io, { to }) {
  if (to === "public") {
    socket.broadcast.emit("user-stop-typing", {
      from: state.names[socket.id],
      to: "public",
    });
  } else if (state.users[to]) {
    io.to(state.users[to]).emit("user-stop-typing", {
      from: state.names[socket.id],
      to: "private",
    });
  } else if (state.rooms[to]) {
    socket.broadcast.to(to).emit("user-stop-typing", {
      from: state.names[socket.id],
      to: to,
    });
  }
}

function handleUpdateMood(socket, io, { mood }) {
  const username = state.names[socket.id];
  if (username) {
    state.moods[username] = mood;
    emitActiveUsers(io, "update", username, state.photos[socket.id], socket);
  }
}

module.exports = { handleTyping, handleStopTyping, handleUpdateMood };
