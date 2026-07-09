process.env.JWT_SECRET = "test-secret";
process.env.GOOGLE_KEY_FILE = "fake-key.json";
process.env.GDRIVE_FOLDER_ID = "fake-folder";

const jwt = require("jsonwebtoken");

jest.mock("../../services/storage/googleDrive", () => {
  const chunkMap = new Map();
  return {
    gatherChunksMap: chunkMap,
    uploadFile: jest.fn(() => Promise.resolve("https://drive.google.com/fake-doc")),
  };
});

jest.mock("../../services/database/chatStore", () => ({
  storeChats: jest.fn(() => Promise.resolve()),
  storeRoom: jest.fn(() => Promise.resolve()),
  addRoomMembers: jest.fn(() => Promise.resolve()),
}));

const state = require("../../sockets/state");

function freshState() {
  for (const map of [state.users, state.names, state.photos, state.socIns, state.moods, state.rooms, state.ackIds, state.handshakeQueue, state.processingAcks]) {
    for (const k of Object.keys(map)) delete map[k];
  }
}

function mkSocket(id) {
  return {
    id,
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    broadcast: { emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) },
    connected: true,
    disconnect: jest.fn(),
  };
}

function mkIO() {
  const io = jest.fn();
  io.to = jest.fn(() => ({ emit: jest.fn() }));
  io.emit = jest.fn();
  return io;
}

// ─── Auth ─────────────────────────────────────────────────────────────────
describe("auth handlers", () => {
  let auth, io, socket;

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    auth = require("../../sockets/handlers/auth");
    io = mkIO();
    socket = mkSocket("sock-1");
  });

  describe("handleInsertName", () => {
    it("emits error when JWT is invalid", () => {
      jest.spyOn(jwt, "verify").mockImplementation(() => { throw new Error("bad"); });
      auth.handleInsertName(socket, io, { jwtoken: "bad-token" });
      expect(io.to).toHaveBeenCalledWith("sock-1");
    });

    it("registers user when JWT is valid", () => {
      jest.spyOn(jwt, "verify").mockReturnValue({ username: "alice", imageurl: "pic.jpg" });
      auth.handleInsertName(socket, io, { jwtoken: "good-token" });
      expect(state.users.alice).toBe("sock-1");
      expect(state.names["sock-1"]).toBe("alice");
    });

    it("disconnects existing session on duplicate login (error 999)", () => {
      const oldSocket = mkSocket("sock-old");
      oldSocket.connected = true;
      state.users.alice = "sock-old";
      state.socIns.alice = oldSocket;

      jest.spyOn(jwt, "verify").mockReturnValue({ username: "alice", imageurl: "pic.jpg" });
      auth.handleInsertName(socket, io, { jwtoken: "new-token" });

      expect(io.to).toHaveBeenCalledWith("sock-old");
      expect(oldSocket.disconnect).toHaveBeenCalledWith(true);
      expect(state.users.alice).toBe("sock-1");
    });
  });

  describe("handleDisconnect", () => {
    it("removes user from state and cleans up rooms", () => {
      state.users.alice = "sock-1";
      state.names["sock-1"] = "alice";
      state.photos["sock-1"] = "pic.jpg";
      state.socIns.alice = socket;
      state.rooms.room1 = { members: ["sock-1"], onCallIds: [] };

      auth.handleDisconnect(socket, io);

      expect(state.users.alice).toBeUndefined();
      expect(state.names["sock-1"]).toBeUndefined();
      expect(state.rooms.room1.members).toEqual([]);
    });
  });
});

// ─── Rooms ────────────────────────────────────────────────────────────────
describe("room handlers", () => {
  let rooms, io, socket;

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    rooms = require("../../sockets/handlers/rooms");
    io = mkIO();
    socket = mkSocket("sock-1");
  });

  it("creates room and joins socket", () => {
    rooms.handleCreateRoom(socket, io, { room: { name: "test-room", admin: "alice" } });
    expect(state.rooms["test-room"]).toBeDefined();
    expect(state.rooms["test-room"].admin).toBe("alice");
    expect(state.rooms["test-room"].members).toEqual(["sock-1"]);
    expect(socket.join).toHaveBeenCalledWith("test-room");
  });

  it("adds socket to existing room members on join", () => {
    state.rooms.room1 = { admin: "alice", created_at: 100, members: ["sock-2"], onCallIds: ["sock-2"] };
    rooms.handleJoinRooms(socket, io, { rooms: ["room1"] });
    expect(state.rooms.room1.members).toContain("sock-1");
  });
});

// ─── WebRTC ───────────────────────────────────────────────────────────────
describe("webrtc handlers", () => {
  let webrtc, io, socketA, socketB;

  function mockIoTo() {
    return jest.fn(() => ({ emit: jest.fn() }));
  }

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    webrtc = require("../../sockets/handlers/webrtc");
    io = { to: mockIoTo(), emit: jest.fn() };
    socketA = mkSocket("sock-a");
    socketB = mkSocket("sock-b");
    state.rooms.room1 = { members: ["sock-a", "sock-b"], onCallIds: [] };
    state.names["sock-a"] = "alice";
    state.names["sock-b"] = "bob";
  });

  it("adds first caller via init-call without setting ackIds", () => {
    webrtc.handleHandshake(socketA, io, {
      id: "sock-a",
      room: { name: "room1" },
      signal: { type: "init-call" },
    });
    expect(state.rooms.room1.onCallIds).toEqual(["sock-a"]);
    expect(state.processingAcks.room1).toBeUndefined();
  });

  it("adds new caller with offer and sets ackIds", () => {
    state.rooms.room1.onCallIds = ["sock-a"];
    webrtc.handleHandshake(socketB, io, {
      id: "sock-b",
      to: "sock-a",
      room: { name: "room1" },
      signal: { type: "offer", sdp: "fake" },
    });
    expect(state.rooms.room1.onCallIds).toContain("sock-b");
    expect(state.ackIds.room1).toEqual(["sock-a", "sock-b"]);
    expect(state.processingAcks.room1).toBe(true);
  });

  it("queues new callers when processingAcks is true", () => {
    state.rooms.room1.onCallIds = ["sock-a"];
    state.processingAcks.room1 = true;

    webrtc.handleHandshake(socketB, io, {
      id: "sock-b",
      to: "sock-a",
      room: { name: "room1" },
      signal: { type: "offer", sdp: "fake" },
    });
    expect(state.rooms.room1.onCallIds).not.toContain("sock-b");
    expect(state.handshakeQueue.room1).toHaveLength(1);
  });

  it("processes queued handshake after all acks clear", () => {
    // Arrange: A in call, B queued, both need to ack
    state.rooms.room1.onCallIds = ["sock-a"];
    state.ackIds.room1 = ["sock-a", "sock-b"];
    state.processingAcks.room1 = true;
    state.handshakeQueue.room1 = [
      { socket: socketB, data: { id: "sock-b", to: "sock-a", room: { name: "room1" }, signal: { type: "offer", sdp: "fake" } } },
    ];

    // Act: B acks → ackIds becomes [A], queue still has 1 item
    webrtc.handleAck(socketB, io, { roomName: "room1" });
    expect(state.ackIds.room1).toEqual(["sock-a"]);

    // A acks → ackIds becomes [], processNextHandshake fires
    // processHandshake dequeues the queued handshake, pushes sock-b into onCallIds,
    // and sets up new ackIds for both callers (since signal is not "init-call")
    const socketAck = { id: "sock-a", emit: jest.fn(), join: jest.fn(), broadcast: { emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }, connected: true, disconnect: jest.fn() };
    webrtc.handleAck(socketAck, io, { roomName: "room1" });
    // Queue dequeued the item
    expect(state.handshakeQueue.room1).toEqual([]);
    // sock-b was added to onCallIds by processHandshake
    expect(state.rooms.room1.onCallIds).toEqual(["sock-a", "sock-b"]);
  });

  it("passes ICE candidates through without queuing", () => {
    state.rooms.room1.onCallIds = ["sock-a", "sock-b"];
    state.processingAcks.room1 = true;

    webrtc.handleHandshake(socketB, io, {
      id: "sock-b",
      to: "sock-a",
      room: { name: "room1" },
      signal: { type: "candidate", candidate: { candidate: "fake" } },
    });
    expect(io.to).toHaveBeenCalledWith("sock-a");
  });

  it("removes socket from onCallIds on exit-video", () => {
    state.rooms.room1.onCallIds = ["sock-a", "sock-b"];
    state.ackIds.room1 = ["sock-a", "sock-b"];
    webrtc.handleExitVideo(socketA, io, { room: { name: "room1" } });
    expect(state.rooms.room1.onCallIds).toEqual(["sock-b"]);
    expect(state.ackIds.room1).toEqual(["sock-b"]);
  });

  it("emits reject-call to the target", () => {
    webrtc.handleRejectCall(socketB, io, { to: "sock-a", room: "room1" });
    expect(io.to).toHaveBeenCalledWith("sock-a");
  });
});

// ─── Messaging ────────────────────────────────────────────────────────────
describe("messaging handlers", () => {
  let msg, io, socket;

  function mkMsgIo() {
    return { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() };
  }

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    msg = require("../../sockets/handlers/messaging");
    io = mkMsgIo();
    socket = mkSocket("sock-1");
    state.names["sock-1"] = "alice";
    state.photos["sock-1"] = "pic.jpg";
  });

  describe("handlePrivateMessage", () => {
    it("sends to online recipient", async () => {
      state.users.bob = "sock-2";
      state.photos["sock-2"] = "bob-pic.jpg";
      await msg.handlePrivateMessage(socket, io, { to: "bob", message: "hello", date: "today" });
      expect(io.to).toHaveBeenCalledWith("sock-2");
    });

    it("emits error when recipient is offline", async () => {
      await msg.handlePrivateMessage(socket, io, { to: "bob", message: "hello", date: "today" });
      expect(io.to).toHaveBeenCalledWith("sock-1");
    });

    it("ignores empty messages", async () => {
      await msg.handlePrivateMessage(socket, io, { to: "bob", message: "   ", date: "today" });
      expect(io.to).not.toHaveBeenCalled();
    });

    it("ignores unregistered senders", async () => {
      const anonSocket = mkSocket("anon");
      await msg.handlePrivateMessage(anonSocket, io, { to: "bob", message: "hi", date: "today" });
      expect(io.to).not.toHaveBeenCalled();
    });
  });

  describe("handlePublicMessage", () => {
    it("broadcasts to everyone except sender", async () => {
      await msg.handlePublicMessage(socket, io, { message: "hello everyone", date: "today" });
      expect(socket.broadcast.emit).toHaveBeenCalledWith("public message", expect.objectContaining({ message: "hello everyone" }));
    });

    it("ignores empty public messages", async () => {
      await msg.handlePublicMessage(socket, io, { message: "", date: "today" });
      expect(socket.broadcast.emit).not.toHaveBeenCalled();
    });
  });

  describe("handleRoomMessage", () => {
    it("broadcasts to room", async () => {
      await msg.handleRoomMessage(socket, io, { room: { name: "room1" }, message: "hi room", date: "today" });
      expect(socket.broadcast.to).toHaveBeenCalledWith("room1");
    });
  });
});
