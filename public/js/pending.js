const DB_NAME = 'offlineQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingQueue';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function enqueue(chatType, recipient, content, offset) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add({
                chatType,
                recipient,
                content,
                offset,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Enqueue error:', err);
    }
}

export async function getPending(chatType) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result || [];
                const filtered = results.filter(item => item.chatType === chatType);
                filtered.sort((a, b) => a.id - b.id);
                resolve(filtered);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Get queue error:', err);
        return [];
    }
}

export async function deletePending(id) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Delete error:', err);
    }
}

export function Pending(recipient, content, offset) {
    const chatType = document.getElementById('room-list') ? 'room' : 'chat';
    enqueue(chatType, recipient, content, offset);

    // Keep legacy fallback sync wrapper object if any scripts read it
    const pendingObj = window.pending;
    if (pendingObj) {
        pendingObj.status = true;
        pendingObj.recipient = recipient;
        pendingObj.content = content;
        pendingObj.offset = offset;
    }
}

export function clearPending() {
    const pendingObj = window.pending;
    if (pendingObj) {
        pendingObj.status = false;
        pendingObj.recipient = null;
        pendingObj.content = null;
        pendingObj.offset = null;
    }
}