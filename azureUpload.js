const { BlobServiceClient } = require('@azure/storage-blob');

async function uploadImageToAzure(profile) {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
        throw new Error('Azure Storage connection string is not defined in environment variables');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

    const { name, data, type } = profile;

    if (!name || !data || !type) {
        throw new Error('Profile object is missing required properties');
    }

    const blockBlobClient = containerClient.getBlockBlobClient(name);

    const buffer = Buffer.from(data, 'base64');  // Convert base64 data to buffer

    const uploadBlobResponse = await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: type }
    });

    console.log(`Blob uploaded successfully. URL: ${blockBlobClient.url}`);
    return blockBlobClient.url;
}

module.exports = { uploadImageToAzure };
