const {google} = require('googleapis'); 
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const {v4: uuidv4} = require('uuid');
const auth = new google.auth.GoogleAuth({
    keyFile: 'private/realtimechat59-4f88949d8c8b.json',
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
const drive = google.drive({version: 'v3', auth});
console.log('gdrive connected...');
const gatherChunks = [];
const documentsId = process.env.DOCUMENTS_ID;
const imageId = process.env.IMAGE_ID;
const videoId = process.env.VIDEO_ID;
async function calculateFileHash(file){
    return new Promise((resolve,reject)=>{
        const hash = crypto.createHash('sha256');
        hash.update(file);
        resolve(hash.digest('hex'));
    })
}

async function sharePublic(fileId) {
    const permissions = {
        type: 'anyone',
        role: 'reader'
    };

    try {
        const response = await drive.permissions.create({
            resource: permissions,
            fileId: fileId,
            fields: 'id'
        });
        console.log(`Permission ID: ${response.data.id}`);
    } catch (error) {
        console.error('Error sharing folder:', error.message);
    }
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
    //console.log(response.data);
    if(response.data.files.length>0) return {status: true, webUrl: response.data.files[0].id}
    return { status: false, webUrl: null};

}

async function uploadOperation(fileType,fileName,fileBuffer){
    let id='';
    if(fileType==='video') id=videoId;
    else if(fileType==='image') id=imageId;
    else id=documentsId;
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
    const media = {y
        mimeType: 'application/octet-stream',
        body: readableStream
    }
    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
    });
    console.log('uploading......');
    //console.log(response.data);
    return response.data.id;
}
async function uploadFile(fileType,fileName){
    try{
        console.log(gatherChunks.length);
        const file = Buffer.concat(gatherChunks);
        const exists = await fileExists(fileType, file);
        if(exists.status){
            console.log('file already exists!!!',exists.webUrl);
            return exists.webUrl;
        }
        const file_id = await uploadOperation(fileType,`${uuidv4()}-${fileName}`, file);
        await sharePublic(file_id);
        return file_id;
    }catch(err){
        console.log(err);
    }
    finally{
        gatherChunks.length = 0;
    }

}

module.exports = {drive, uploadFile, gatherChunks};























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

