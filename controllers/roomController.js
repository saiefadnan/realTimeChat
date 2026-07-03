const { db } = require("../config/firebase");
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

      const activeMemberIds = (data.members || [])
        .map((uname) => users[uname])
        .filter(Boolean);

      rooms[data.name] = {
        initiator: rooms[data.name]?.initiator || null,
        admin: data.admin,
        created_at: data.created_at || Date.now(),
        members: activeMemberIds,
        onCallIds: rooms[data.name]?.onCallIds || [],
      };
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
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: "roomName is required." });
    }

    const snapshot = await db
      .collection("chat")
      .where("receiver", "==", roomName)
      .get();

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

    // Sort in-memory to avoid Firestore composite index requirement error
    chats.sort((a, b) => a.timestamp - b.timestamp);

    // Convert timestamps to ISO string before sending to client
    const formattedChats = chats.map((chat) => ({
      ...chat,
      timestamp: chat.timestamp.toISOString(),
    }));

    return res.status(200).json({ chats: formattedChats });
  } catch (err) {
    console.error("[getRoomChats] Error:", err);
    return res.status(500).json({ error: "Failed to retrieve room chats." });
  }
};

module.exports = {
  getUserRooms,
  getRoomChats,
};
