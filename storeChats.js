const { admin, db } = require('./firebase');

async function storeChats(sender, receiver, content, type, date) {
    try {
        await db.collection('chat').add({
            sender: sender,
            receiver: receiver,
            content: content,
            type: type,
            date: date,
            timestamp: admin.firestore.Timestamp.now()
        });
        console.log('Chat stored successfully');
    } catch (err) {
        console.error(err);
    }
}

function storeRoom(name, roomAdmin) {
    db.collection("rooms").doc(name).set({
        name,
        admin: roomAdmin,
        created_at: Date.now(),
        members: [roomAdmin],
    }).catch((err) => console.error("[Firestore] Failed to persist room:", err));
}

function addRoomMembers(name, usernames) {
    db.collection("rooms").doc(name).update({
        members: admin.firestore.FieldValue.arrayUnion(...usernames),
    }).catch((err) => console.error("[Firestore] Failed to update room members:", err));
}

module.exports = { storeChats, storeRoom, addRoomMembers };