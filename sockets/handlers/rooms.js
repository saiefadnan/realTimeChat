const state = require("../state");
const { addRoomMembers, storeRoom } = require("../../services/database/chatStore");

function handleJoinRooms(socket, io, { rooms: roomNames }) {
  for (const roomName of roomNames) {
    if (state.rooms[roomName]) {
      socket.join(roomName);
      if (!state.rooms[roomName].members.includes(socket.id)) {
        state.rooms[roomName].members.push(socket.id);
      }
      io.to(roomName).emit("room-info", {
        name: roomName,
        admin: state.rooms[roomName].admin,
        created_at: state.rooms[roomName].created_at,
        memberIds: state.rooms[roomName].members,
        onCallIds: state.rooms[roomName].onCallIds || [],
      });
    }
  }
}

function handleCreateRoom(socket, io, { room }) {
  socket.join(room.name);
  state.rooms[room.name] = {
    admin: room.admin,
    created_at: Date.now(),
    members: [socket.id],
    onCallIds: [],
  };
  storeRoom(room.name, room.admin);
  io.to(room.name).emit("room-created", {
    notify: `Room "${room.name}" created by ${room.admin}`,
  });
}

function handleInvite(socket, io, { room, usernames }) {
  for (const username of usernames) {
    if (state.socIns[username]) {
      state.socIns[username].join(room.name);
      if (!state.rooms[room.name].members.includes(state.users[username])) {
        state.rooms[room.name].members.push(state.users[username]);
      }
    }
  }
  addRoomMembers(room.name, usernames);
  socket.broadcast.to(room.name).emit("invitation", {
    name: room.name,
    notify: `${state.names[socket.id]} added you to room "${room.name}"`,
  });
  io.to(socket.id).emit("invited", {
    notify: `Invited: ${usernames.join(", ")}`,
  });
  io.to(room.name).emit("room-info", {
    name: room.name,
    admin: state.rooms[room.name].admin,
    created_at: state.rooms[room.name].created_at,
    memberIds: state.rooms[room.name].members,
    onCallIds: state.rooms[room.name].onCallIds,
  });
}

module.exports = { handleJoinRooms, handleCreateRoom, handleInvite };
