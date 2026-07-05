const cron = require("node-cron");
const User = require("../models/User");
const { admin, db } = require("../config/firebase");
const { names, photos, users, rooms } = require("../sockets/chatSocket");
const { drive } = require("../services/storage/googleDrive");

const DEACTIVE_AVATAR =
  "https://ui-avatars.com/api/?name=?&background=333&color=fff";

let io_ = null;

/**
 * Injects Socket.IO instance.
 */
function assign(io) {
  io_ = io;
}

/**
 * Deletes a file from Google Drive by its file ID.
 */
async function deleteFile(file_id) {
  try {
    await drive.files.delete({ fileId: file_id });
    console.log(`[GDrive] Deleted file: ${file_id}`);
  } catch (err) {
    console.error("[GDrive] File deletion failed:", err.message);
  }
}

/**
 * POST /api/userData (protected)
 */
const getUserInfo = async (req, res) => {
  try {
    return res.status(200).json({
      userinfo: {
        username: req.user.username,
        imageurl: req.user.imageurl,
      },
    });
  } catch (err) {
    console.error("[getUserInfo] Error:", err);
    return res.status(500).json({ error: "An internal error occurred." });
  }
};

/**
 * POST /api/getchats (protected)
 * Supports cursor-based pagination via `before` (ISO timestamp) and `limit`.
 */
const chatData = async (req, res) => {
  try {
    const username = req.user.username;
    const limit = Math.min(parseInt(req.body.limit) || 30, 100);
    const before = req.body.before ? new Date(req.body.before) : null;
    const beforeTs = before ? admin.firestore.Timestamp.fromDate(before) : null;

    const chatRef = db.collection("chat");

    const buildQuery = (baseQuery) =>
      beforeTs ? baseQuery.where("timestamp", "<", beforeTs) : baseQuery;

    const [senderSnap, publicSnap, receiverSnap] = await Promise.all([
      buildQuery(chatRef.where("sender", "==", username)).get(),
      buildQuery(
        chatRef
          .where("receiver", "==", "public")
          .where("sender", "!=", username)
      ).get(),
      buildQuery(chatRef.where("receiver", "==", username)).get(),
    ]);

    const combined = [
      ...senderSnap.docs,
      ...publicSnap.docs,
      ...receiverSnap.docs,
    ];

    combined.sort(
      (a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis()
    );

    const page = combined.slice(0, limit);

    return res.status(200).json({
      chats: page.reverse().map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp:
            data.timestamp && data.timestamp.toDate
              ? data.timestamp.toDate().toISOString()
              : data.timestamp,
          imageUrl: photos[users[data.sender]] || DEACTIVE_AVATAR,
        };
      }),
      hasMore: combined.length > limit,
    });
  } catch (err) {
    console.error("[chatData] Error:", err);
    return res.status(500).json({ error: "Failed to retrieve chat history." });
  }
};

/**
 * POST /api/search (protected)
 */
const queryUser = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({ message: "Search query is too short." });
    }

    const queryUsers = await User.find(
      { username: { $regex: query.trim(), $options: "i" } },
      { username: 1, _id: 0 },
    ).limit(20);

    return res.status(200).json({
      message: `${queryUsers.length} user(s) found.`,
      querynames: queryUsers.map((u) => ({ name: u.username })),
    });
  } catch (err) {
    console.error("[queryUser] Error:", err);
    return res.status(500).json({ error: "Search failed." });
  }
};

/**
 * Deletes Firestore chat documents older than 5 hours,
 * removes their Google Drive files.
 */
const cleanUpOldChats = async () => {
  try {
    const fiveHourAgoMillis =
      admin.firestore.Timestamp.now().toMillis() - 5 * 3600 * 1000;
    const fiveHourAgo = new admin.firestore.Timestamp(
      Math.floor(fiveHourAgoMillis / 1000),
      (fiveHourAgoMillis % 1000) * 1_000_000,
    );
    const chatRef = db.collection("chat");
    const snapshot = await chatRef.where("timestamp", "<", fiveHourAgo).get();

    if (snapshot.empty) {
      console.log("[Cron] Database is already clean.");
    } else {
      console.log(
        `[Cron] Cleaning ${snapshot.docs.length} old chat record(s)...`,
      );
      const batch = db.batch();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.type !== "text") await deleteFile(data.content);
        batch.delete(doc.ref);
      }
      await batch.commit();
      console.log("[Cron] Database cleanup complete.");
    }

    console.log(
      "[Cron] Cleanup complete. Profile picture URLs are permanent (Cloudinary)."
    );
  } catch (err) {
    console.error("[Cron] Error during cleanup:", err);
  }
};

cron.schedule("0 */1 * * *", cleanUpOldChats);

/**
 * GET /ping (no auth, no rate-limit)
 */
const ping = async (req, res) => {
  res.status(200).end();
};

module.exports = {
  chatData,
  assign,
  getUserInfo,
  queryUser,
  ping,
};
