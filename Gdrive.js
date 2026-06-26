const {google} = require('googleapis'); 
const crypto = require('crypto');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');

const auth = new google.auth.GoogleAuth({
    keyFile: "/etc/secrets/realtimechat59-4f88949d8c8b.json", //render
    scopes: ["https://www.googleapis.com/auth/drive"],
});

// const auth = new google.auth.GoogleAuth({
//     keyFile: 'private/realtimechat59-4f88949d8c8b.json', //local
//     scopes: ['https://www.googleapis.com/auth/drive'],
// });
const drive = google.drive({ version: 'v3', auth });
console.log('[GDrive] Connected.');

// Per-socket chunk buffer — Map<socketId, Buffer[]>
// Fixes race condition where concurrent uploads from different users
// would share a single global array and corrupt each other's data.
const gatherChunksMap = new Map();

const documentsId = process.env.DOCUMENTS_ID;
const imageId = process.env.IMAGE_ID;
const videoId = process.env.VIDEO_ID;

/**
 * Returns a SHA-256 hash of the file buffer for deduplication.
 * @param {Buffer} file
 * @returns {string}
 */
function calculateFileHash(file) {
    return crypto.createHash('sha256').update(file).digest('hex');
}

/**
 * Sets the file's Google Drive permissions to public/read.
 * @param {string} fileId
 */
async function sharePublic(fileId) {
    try {
        await drive.permissions.create({
            resource: { type: 'anyone', role: 'reader' },
            fileId,
            fields: 'id'
        });
    } catch (error) {
        console.error('[GDrive] Error sharing file:', error.message);
    }
}

/**
 * Checks if an identical file (by hash) already exists in the target Drive folder.
 * @param {string} fileType - 'image' | 'video' | 'document'
 * @param {Buffer} file
 * @returns {Promise<{ status: boolean, webUrl: string|null }>}
 */
async function fileExists(fileType, file) {
    const id = fileType === 'document' ? documentsId : fileType === 'image' ? imageId : videoId;
    const fileHash = calculateFileHash(file);

    const response = await drive.files.list({
        q: `'${id}' in parents and properties has {key='file_hash' and value='${fileHash}'} and trashed = false`,
        fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
        return { status: true, webUrl: response.data.files[0].id };
    }
    return { status: false, webUrl: null };
}

/**
 * Uploads a file buffer to the appropriate Google Drive folder.
 * @param {string} fileType - 'image' | 'video' | 'document'
 * @param {string} fileName
 * @param {Buffer} fileBuffer
 * @returns {Promise<string>} Google Drive file ID
 */
async function uploadOperation(fileType, fileName, fileBuffer) {
    const id = fileType === 'video' ? videoId : fileType === 'image' ? imageId : documentsId;

    const fileMetadata = {
        name: fileName,
        parents: [id],
        properties: { file_hash: calculateFileHash(fileBuffer) }
    };

    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: { mimeType: 'application/octet-stream', body: readableStream },
        fields: 'id'
    });

    return response.data.id;
}

/**
 * Uploads a file to Google Drive, with deduplication by hash.
 * Reads from the per-socket chunk buffer identified by socketId.
 * Clears the buffer when done (even on error).
 *
 * @param {string} socketId - The uploading socket's ID (used to look up chunk buffer)
 * @param {string} fileType - 'image' | 'video' | 'document'
 * @param {string} fileName
 * @returns {Promise<string>} Google Drive file ID
 */
async function uploadFile(socketId, fileType, fileName) {
    const chunks = gatherChunksMap.get(socketId) || [];
    try {
        if (chunks.length === 0) throw new Error('No file chunks received.');

        const file = Buffer.concat(chunks);
        const existing = await fileExists(fileType, file);

        if (existing.status) {
            console.log(`[GDrive] Duplicate file detected: ${existing.webUrl}`);
            return existing.webUrl;
        }

        const file_id = await uploadOperation(fileType, `${uuidv4()}-${fileName}`, file);
        await sharePublic(file_id);
        console.log(`[GDrive] Uploaded file: ${file_id}`);
        return file_id;
    } finally {
        // Always clear the buffer for this socket, even on error
        gatherChunksMap.delete(socketId);
    }
}

module.exports = { drive, uploadFile, gatherChunksMap };
