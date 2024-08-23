const { BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions } = require('@azure/storage-blob');
const {v4: uuidv4} = require('uuid');
const moment = require('moment');

async function generateSasToken(blobName, blobCredential){
    const sasOptions = {
        containerName: process.env.AZURE_CONTAINER_NAME,
        blobName: blobName,
        permissions: ContainerSASPermissions.parse("r"),
        startsOn: new Date(new Date().getTime() - 5 * 60 * 1000),
        expiresOn: moment().add(1,'hour').toDate()
    }

    return generateBlobSASQueryParameters(sasOptions,blobCredential).toString();
}

async function uploadImageToAzure(profile) {
    try{
        if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
            throw new Error('Azure Storage connection string is not defined in environment variables');
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

        const { name, data, type } = profile;

        if (!name || !data || !type) {
            throw new Error('Profile object is missing required properties');
        }
        
        const uniqueName = `${uuidv4()}-${name}`;
        // console.log(uniqueName);

        const blockBlobClient = containerClient.getBlockBlobClient(uniqueName);

        const buffer = Buffer.from(data, 'base64');  // Convert base64 data to buffer

        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: type }
        });
        const sasToken = await generateSasToken(uniqueName,blobServiceClient.credential);
        console.log(`Blob uploaded successfully. URL: ${blockBlobClient.url}?${sasToken}`);
        return {
            blobPath: blockBlobClient.url, 
            sasToken: sasToken
        };
    }catch(err){
        console.error(err);
    }
}

module.exports = { uploadImageToAzure, generateSasToken };




