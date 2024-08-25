const { admin, db} = require('./firebase');
async function storeChats(sender, receiver, content, type, date){
    try{
        await db.collection('chat').add({
            sender: sender,
            receiver: receiver,
            content: content,
            type: type,
            date: date,
            timestamp: admin.firestore.Timestamp.now()
        });
        console.log('Chat stored successfully');
    }catch(err){
        console.error(err);
    }
}

module.exports = {storeChats};