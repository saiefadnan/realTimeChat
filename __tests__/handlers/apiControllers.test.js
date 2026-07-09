process.env.JWT_SECRET = "test-secret";
process.env.GOOGLE_KEY_FILE = "fake-key.json";
process.env.GDRIVE_FOLDER_ID = "fake-folder";
process.env.CLOUDINARY_CLOUD_NAME = "fake";
process.env.CLOUDINARY_API_KEY = "fake";
process.env.CLOUDINARY_API_SECRET = "fake";
process.env.MONGO_URI = "mongodb://fake:27017/test";
process.env.FIREBASE_SERVICE_ACCOUNT = "fake-key.json";

jest.mock("node-cron", () => ({ schedule: jest.fn() }));

jest.mock("../../config/firebase", () => {
  const mockDoc = {
    get: jest.fn(() => Promise.resolve({ data: () => ({}) })),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
  };
  const coll = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn(() => Promise.resolve({ docs: [] })),
    where: jest.fn(() => coll),
    orderBy: jest.fn(() => coll),
    limit: jest.fn(() => coll),
  };
  return {
    admin: { firestore: jest.fn(() => ({ collection: jest.fn(() => coll) })), apps: [] },
    db: { collection: jest.fn(() => coll) },
  };
});

jest.mock("../../models/User", () => {
  const fn = jest.fn((data) => ({
    ...data,
    _id: "generated-id",
    save: jest.fn().mockResolvedValue(),
  }));
  fn.findOne = jest.fn();
  fn.updateOne = jest.fn();
  fn.findOneAndUpdate = jest.fn();
  return fn;
});

jest.mock("../../services/storage/googleDrive", () => ({
  gatherChunksMap: new Map(),
  uploadFile: jest.fn(() => Promise.resolve("https://drive.google.com/fake-doc")),
}));

jest.mock("../../services/database/chatStore", () => ({
  storeChats: jest.fn(() => Promise.resolve()),
  storeRoom: jest.fn(() => Promise.resolve()),
  addRoomMembers: jest.fn(() => Promise.resolve()),
  retrieveChats: jest.fn(() => Promise.resolve([])),
  retrieveRoomChats: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../services/storage/cloudinary", () => ({
  uploadImageToCloudinary: jest.fn(() => Promise.resolve({ imageUrl: "https://fake.cloudinary.com/img.jpg" })),
}));

const state = require("../../sockets/state");

function freshState() {
  for (const map of [state.users, state.names, state.photos, state.socIns, state.moods, state.rooms, state.ackIds, state.handshakeQueue, state.processingAcks]) {
    for (const k of Object.keys(map)) delete map[k];
  }
}

// ─── Auth Controller ──────────────────────────────────────────────────────
describe("authController", () => {
  let authController, res;

  const mkReq = (body) => ({ body });

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    authController = require("../../controllers/authController");
    res = { status: jest.fn(() => res), send: jest.fn(), json: jest.fn() };
  });

  describe("loginData", () => {
    it("returns 400 for missing email", async () => {
      await authController.loginData(mkReq({ password: "x" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 for non-existent user", async () => {
      const User = require("../../models/User");
      User.findOne.mockResolvedValue(null);
      await authController.loginData(mkReq({ email: "missing@x.com", password: "x" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 200 for wrong password", async () => {
      const User = require("../../models/User");
      User.findOne.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
        username: "alice",
      });
      await authController.loginData(mkReq({ email: "a@b.com", password: "real" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 200 with logged-in-elsewhere when user already connected", async () => {
      const User = require("../../models/User");
      state.users.alice = "sock-existing";
      User.findOne.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(true),
        username: "alice",
        profilePicture: "pic.jpg",
        _id: "id",
      });
      await authController.loginData(mkReq({ email: "a@b.com", password: "real" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 200 with token on successful login", async () => {
      const User = require("../../models/User");
      User.findOne.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(true),
        username: "alice",
        profilePicture: "pic.jpg",
        _id: "id",
      });
      await authController.loginData(mkReq({ email: "a@b.com", password: "real" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("signinData", () => {
    it("returns 400 for missing fields", async () => {
      await authController.signinData(mkReq({ email: "only" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 for existing user", async () => {
      const User = require("../../models/User");
      User.findOne.mockResolvedValue({ username: "alice" });
      await authController.signinData(mkReq({ email: "exists@x.com", username: "alice", password: "pw" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 201 on successful creation", async () => {
      const User = require("../../models/User");
      User.findOne.mockResolvedValue(null);
      await authController.signinData(mkReq({ email: "new@x.com", username: "bob", password: "pw" }), res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});

// ─── Room Controller ─────────────────────────────────────────────────────
describe("roomController", () => {
  let rc, res;

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    rc = require("../../controllers/roomController");
    res = { status: jest.fn(() => res), send: jest.fn(), json: jest.fn() };
  });

  it("getUserRooms returns 200", async () => {
    await rc.getUserRooms({ user: { username: "alice" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getRoomChats returns 400 if roomName missing", async () => {
    await rc.getRoomChats({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getRoomChats returns 200 on success", async () => {
    await rc.getRoomChats({ body: { roomName: "room1" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── Chat Controller ──────────────────────────────────────────────────────
describe("chatController", () => {
  let cc, res;

  beforeEach(() => {
    freshState();
    jest.clearAllMocks();
    cc = require("../../controllers/chatController");
    res = { status: jest.fn(() => res), send: jest.fn(), json: jest.fn(), end: jest.fn() };
  });

  it("getUserInfo returns user info from req.user", async () => {
    await cc.getUserInfo({ user: { username: "alice", imageurl: "pic.jpg" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userinfo: { username: "alice", imageurl: "pic.jpg" },
    });
  });

  it("chatData returns 200", async () => {
    await cc.chatData({ user: { username: "alice" }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("queryUser returns 400 for empty query", async () => {
    await cc.queryUser({ body: { query: "" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("queryUser returns 200 for valid query", async () => {
    const User = require("../../models/User");
    User.find = jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([])) }));
    await cc.queryUser({ body: { query: "ali" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("ping returns 200", async () => {
    await cc.ping({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
