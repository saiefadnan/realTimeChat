const admin = require('firebase-admin');
const serviceAccount = require('./private/realtimechat-ea555-firebase-adminsdk-rhfxu-27e6017626.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log('initialized....');
const db = admin.firestore();
module.exports = {admin, db};
