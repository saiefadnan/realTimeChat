const {google} = require('googleapis'); 
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const User = require('./mongodb/user');
const {v4: uuidv4} = require('uuid');
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '/etc/secrets/realtimechat59-4f88949d8c8b.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
const drive = google.drive({version: 'v3', auth});
const gatherChunks = [];
const documentsId = '184PugQuK9uoTYYZzW40ueoJ-etTLeLY5';
const imageId = '1SJJRpr8nseA3c-TRHYa8-E2iyBn7OhTN';
const videoId = '1KJA4bEkaaOWh1_C__nyQmX2GrNuzeDmn';
async function calculateFileHash(file){
    return new Promise((resolve,reject)=>{
        const hash = crypto.createHash('sha256');
        hash.update(file);
        resolve(hash.digest('hex'));
    })
}

async function fileExists(fileType, file){
    let id='';
    if(fileType==='document') id=documentsId;
    else if(fileType==='image') id=imageId;
    else id=videoId;
    console.log(id);
    const fileHash = await calculateFileHash(file);
    const response =await drive.files.list({
        q: `'${id}' in parents and properties has {key='file_hash' and value='${fileHash}'} and trashed = false`,
        fields: 'files(id, name)',
    })
    console.log(response.data,response.data.files.length);
    return response.data.files.length>0;

}

async function uploadOperation(fileType,fileName,fileBuffer){
    let id='';
    if(fileType==='document') id=documentsId;
    else if(fileType==='image') id=imageId;
    else id=videoId;
    const fileMetadata = {
        name: fileName,
        parents: [id],
        properties: {
            file_hash: await calculateFileHash(fileBuffer)
        }
    }
    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);
    const media = {
        mimeType: 'application/octet-stream',
        body: readableStream
    }
    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
    });
    console.log('Uploaded file ID:', response.data.id, fileType);
}
async function uploadFile(fileType,fileName,Username){
    try{
        console.log(gatherChunks.length);
        const file = Buffer.concat(gatherChunks);
        if(await fileExists(fileType, file)){
            console.log('file already exists!!!');
            return;
        }
        await uploadOperation(fileType,`${uuidv4()}-${fileName}`, file);
        // const result = await User.findOneAndUpdate(
        //     { username: Username },      
        //     { $addToSet: { folderIds: folderId } },
        //     { new: true, useFindAndModify: false }
        //   );
        // console.log('Updated User:', result);
    }catch(err){
        console.log(err);
    }
    finally{
        gatherChunks.length = 0;
    }

}

module.exports = {uploadFile, gatherChunks};























// async function getStorageQuota() {
//     try {
//       const response = await drive.about.get({
//         fields: 'storageQuota'
//       });
//       const quota = response.data.storageQuota;
//       console.log(`Total Storage: ${quota.limit}`);
//       console.log(`Used Storage: ${quota.usage}`);
//       console.log(`Remaining Storage: ${quota.limit - quota.usage}`);
//     } catch (error) {
//       console.error('Error retrieving storage quota:', error);
//     }
//   }

// async function createDir(fileName){
//     const folderName = 'Video';
//     const fileMetadata = {
//         'name': folderName,
//         'mimeType': 'application/vnd.google-apps.folder'
//     };

//     const folder = await drive.files.create({
//         resource: fileMetadata,
//         fields: 'id'
//     });

//     return folder.data.id;
// }

// async function shareFolder(folderId) {
//     const permissions = {
//         type: 'user',
//         role: 'reader', // or 'writer' for read-write access
//         emailAddress: 'saifnemesis@gmail.com'
//     };

//     try {
//         const response = await drive.permissions.create({
//             resource: permissions,
//             fileId: folderId,
//             fields: 'id'
//         });
//         console.log(`Permission ID: ${response.data.id}`);
//     } catch (error) {
//         console.error('Error sharing folder:', error.message);
//     }
// }