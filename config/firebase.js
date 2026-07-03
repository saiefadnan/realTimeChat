const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT)
  ? process.env.FIREBASE_SERVICE_ACCOUNT
  : path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT);

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('firebase initialized...');
}

const db = admin.firestore();
module.exports = { admin, db };
