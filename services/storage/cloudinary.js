const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a base64-encoded image to Cloudinary.
 * @param {{ name: string, data: string, type: string }} profile
 * @returns {Promise<{ imageUrl: string }>} Permanent Cloudinary URL
 */
async function uploadImageToCloudinary(profile) {
    const { name, data, type } = profile;

    if (!name || !data || !type) {
        throw new Error('Profile object is missing required properties (name, data, type)');
    }

    const dataUri = `data:${type};base64,${data}`;

    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'chatapp/profiles',
        public_id: name.replace(/\.[^/.]+$/, ''), // strip extension
        overwrite: false,
        resource_type: 'image',
    });

    console.log(`[Cloudinary] Uploaded: ${result.secure_url}`);
    return { imageUrl: result.secure_url };
}

module.exports = { uploadImageToCloudinary };
