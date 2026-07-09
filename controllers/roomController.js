const { admin, db } = require("../config/firebase");
const { users, photos, rooms } = require("../sockets/chatSocket");

const DEACTIVE_AVATAR =
  "https://ui-avatars.com/api/?name=?&background=333&color=fff";

/**
 * POST /api/user-rooms (protected)
 */
const getUserRooms = async (req, res) => {
  try {
    const username = req.user.username;
    const snapshot = await db
      .collection("rooms")
      .where("members", "array-contains", username)
      .get();
    const roomsList = snapshot.docs.map((doc) => {
      const data = doc.data();

      if (!rooms[data.name]) {
        rooms[data.name] = {
          initiator: null,
          admin: data.admin,
          created_at: data.created_at || Date.now(),
          members: [],
          onCallIds: [],
        };
      }
      return { name: data.name, admin: data.admin };
    });
    return res.status(200).json({ rooms: roomsList });
  } catch (err) {
    console.error("[getUserRooms] Error:", err);
    return res.status(500).json({ error: "Failed to retrieve rooms." });
  }
};

/**
 * POST /api/room-chats (protected)
 */
const getRoomChats = async (req, res) => {
  try {
    const { roomName, limit, before } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: "roomName is required." });
    }

    const chatLimit = Math.min(parseInt(limit) || 30, 100);
    const beforeTs = before ? admin.firestore.Timestamp.fromDate(new Date(before)) : null;

    let query = db.collection("chat").where("receiver", "==", roomName);
    if (beforeTs) {
      query = query.where("timestamp", "<", beforeTs);
    }

    const snapshot = await query.get();

    const chats = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        sender: data.sender,
        content: data.content,
        type: data.type,
        timestamp:
          data.timestamp && data.timestamp.toDate
            ? data.timestamp.toDate()
            : data.timestamp ? new Date(data.timestamp) : new Date(),
        imageUrl: photos[users[data.sender]] || DEACTIVE_AVATAR,
      };
    });

    // Sort descending (newest first) for consistent cursor-based pagination
    chats.sort((a, b) => b.timestamp - a.timestamp);

    const page = chats.slice(0, chatLimit);

    return res.status(200).json({
      chats: page.reverse().map((chat) => ({
        ...chat,
        timestamp: chat.timestamp.toISOString(),
      })),
      hasMore: chats.length > chatLimit,
    });
  } catch (err) {
    console.error("[getRoomChats] Error:", err);
    return res.status(500).json({ error: "Failed to retrieve room chats." });
  }
};

module.exports = {
  getUserRooms,
  getRoomChats,
};
