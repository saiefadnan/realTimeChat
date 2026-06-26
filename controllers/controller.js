const cron = require('node-cron');
const User = require('../mongodb/user');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../firebase');
const { StorageSharedKeyCredential } = require('@azure/storage-blob');
const { uploadImageToAzure, generateSasToken } = require('../azureUpload');
const { names, photos, users } = require('../socketHandler');
const { drive } = require('../Gdrive');

const DEACTIVE_AVATAR = 'https://ui-avatars.com/api/?name=?&background=333&color=fff';
const accountName = process.env.AZURE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_ACCOUNT_KEY;
const secretKey = process.env.JWT_SECRET;

// io_ is set by assign() once the HTTP server is ready
let io_ = null;

/**
 * Called from server.js to inject the Socket.IO instance so the cron job
 * can broadcast SAS token refresh events to all connected clients.
 * @param {import('socket.io').Server} io
 */
function assign(io) {
    io_ = io;
}

/**
 * Deletes a file from Google Drive by its file ID.
 * @param {string} file_id
 */
async function deleteFile(file_id) {
    try {
        await drive.files.delete({ fileId: file_id });
        console.log(`[GDrive] Deleted file: ${file_id}`);
    } catch (err) {
        console.error('[GDrive] File deletion failed:', err.message);
    }
}

/**
 * Generates a fresh Azure SAS token for a profile picture blob.
 * @param {string} profilePicture - Full Azure blob URL (without existing SAS)
 * @returns {Promise<string>} New SAS token string
 */
const refreshToken = async (profilePicture) => {
    const blobName = decodeURIComponent(profilePicture.substring(profilePicture.lastIndexOf('/') + 1));
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const sasToken = await generateSasToken(blobName, credential);
    return sasToken;
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/login
 * Authenticates a user with email + password, returns a signed JWT.
 */
const loginData = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ login: false, notify: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({ login: false, notify: 'Invalid login attempt.' });
        }

        const passMatch = await user.comparePassword(password);
        if (!passMatch) {
            return res.status(200).json({ login: false, notify: 'Invalid login attempt.' });
        }

        if (users[user.username]) {
            return res.status(200).json({
                login: false,
                notify: 'You are currently logged in elsewhere!'
            });
        }

        const sasToken = await refreshToken(user.profilePicture);
        const jwtoken = jwt.sign(
            {
                username: user.username,
                imageurl: `${user.profilePicture}?${sasToken}`
            },
            secretKey,
            { expiresIn: '30d' }
        );

        // Update last login timestamp
        await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

        return res.status(200).json({
            login: true,
            notify: `Welcome back, ${user.username}!`,
            token: jwtoken
        });
    } catch (err) {
        console.error('[Login] Error:', err);
        return res.status(500).json({ error: 'An internal error occurred.' });
    }
};

/**
 * POST /api/signin
 * Registers a new user (username + email must be unique), returns a signed JWT.
 */
const signinData = async (req, res) => {
    try {
        const { email, username, password, profile } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ signin: false, notify: 'All fields are required.' });
        }

        const [existingUser, existingEmail] = await Promise.all([
            User.findOne({ username }),
            User.findOne({ email })
        ]);

        if (existingUser || existingEmail) {
            return res.status(200).json({
                signin: false,
                notify: 'Email or username already exists. Please log in.'
            });
        }

        let blobPath = 'https://gifdb.com/images/high/eren-yeager-blowing-hair-o63aaatimhxaojbu.gif';
        let sasToken = '';

        if (profile) {
            const { blobPath: uploadedPath, sasToken: uploadedToken } = await uploadImageToAzure(profile);
            blobPath = uploadedPath;
            sasToken = uploadedToken;
        }

        const user = new User({ username, password, email, profilePicture: blobPath });
        await user.save();

        const jwtoken = jwt.sign(
            {
                username: user.username,
                imageurl: `${user.profilePicture}?${sasToken}`
            },
            secretKey,
            { expiresIn: '30d' }
        );

        return res.status(201).json({
            signin: true,
            notify: `Successfully registered! Welcome, ${user.username}!`,
            token: jwtoken
        });
    } catch (err) {
        console.error('[Signup] Error:', err);
        return res.status(500).json({ error: 'An internal error occurred.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Protected Controllers (require authMiddleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/userData  (protected)
 * Returns the decoded user info from the JWT already verified by authMiddleware.
 */
const getUserInfo = async (req, res) => {
    try {
        // req.user is populated by authMiddleware
        return res.status(200).json({
            userinfo: {
                username: req.user.username,
                imageurl: req.user.imageurl
            }
        });
    } catch (err) {
        console.error('[getUserInfo] Error:', err);
        return res.status(500).json({ error: 'An internal error occurred.' });
    }
};

/**
 * POST /api/getchats  (protected)
 * Fetches all chat messages (sent, received, public) sorted by timestamp.
 */
const chatData = async (req, res) => {
    try {
        const username = req.user.username;  // comes from authMiddleware
        const chatRef = db.collection('chat');

        const [senderSnap, publicSnap, receiverSnap] = await Promise.all([
            chatRef.where('sender', '==', username).get(),
            chatRef.where('receiver', '==', 'public').where('sender', '!=', username).get(),
            chatRef.where('receiver', '==', username).get()
        ]);

        const combined = [...senderSnap.docs, ...publicSnap.docs, ...receiverSnap.docs];

        combined.sort((a, b) =>
            a.data().timestamp.toMillis() - b.data().timestamp.toMillis()
        );

        return res.status(200).json({
            chats: combined.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // If timestamp is a Firestore Timestamp, convert to ISO string
                    // This fixed the "Invalid Date" issue in the frontend
                    timestamp: data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp,
                    imageUrl: photos[users[data.sender]] || DEACTIVE_AVATAR
                };
            })
        });

    } catch (err) {
        console.error('[chatData] Error:', err);
        return res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
};

/**
 * POST /api/search  (protected)
 * Searches users by username (case-insensitive regex).
 */
const queryUser = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || query.trim().length < 1) {
            return res.status(400).json({ message: 'Search query is too short.' });
        }

        const queryUsers = await User.find(
            { username: { $regex: query.trim(), $options: 'i' } },
            { username: 1, _id: 0 }   // only return username, exclude _id
        ).limit(20);

        return res.status(200).json({
            message: `${queryUsers.length} user(s) found.`,
            querynames: queryUsers.map((u) => ({ name: u.username }))
        });
    } catch (err) {
        console.error('[queryUser] Error:', err);
        return res.status(500).json({ error: 'Search failed.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cron Jobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes Firestore chat documents older than 5 hours,
 * removes their Google Drive files, and refreshes Azure SAS tokens.
 * Scheduled every hour.
 */
const cleanUpOldChats = async () => {
    try {
        const fiveHourAgoMillis = admin.firestore.Timestamp.now().toMillis() - 5 * 3600 * 1000;
        const fiveHourAgo = new admin.firestore.Timestamp(
            Math.floor(fiveHourAgoMillis / 1000),
            (fiveHourAgoMillis % 1000) * 1_000_000
        );
        const chatRef = db.collection('chat');
        const snapshot = await chatRef.where('timestamp', '<', fiveHourAgo).get();

        if (snapshot.empty) {
            console.log('[Cron] Database is already clean.');
        } else {
            console.log(`[Cron] Cleaning ${snapshot.docs.length} old chat record(s)...`);
            const batch = db.batch();
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (data.type !== 'text') await deleteFile(data.content);
                batch.delete(doc.ref);
            }
            await batch.commit();
            console.log('[Cron] Database cleanup complete.');
        }

        // Refresh Azure SAS tokens for all currently connected users
        for (const socket_id in photos) {
            const baseUrl = photos[socket_id].substring(0, photos[socket_id].lastIndexOf('?'));
            if (!baseUrl) continue;
            try {
                const newToken = await refreshToken(baseUrl);
                photos[socket_id] = `${baseUrl}?${newToken}`;
            } catch (tokenErr) {
                console.error(`[Cron] Failed to refresh token for socket ${socket_id}:`, tokenErr.message);
            }
        }

        // Broadcast updated profile pictures to all connected clients
        if (io_ && Object.keys(names).length > 0) {
            const activeUsers = Object.values(names);
            const profile = Object.values(photos);
            io_.emit('init activeUsers', { activeUsers, profile });
            console.log('[Cron] SAS tokens refreshed and broadcast.');
        }
    } catch (err) {
        console.error('[Cron] Error during cleanup:', err);
    }
};

// Schedule cleanup every hour on the hour
cron.schedule('0 */1 * * *', cleanUpOldChats);

module.exports = {
    loginData,
    signinData,
    chatData,
    refreshToken,
    assign,
    getUserInfo,
    queryUser
};