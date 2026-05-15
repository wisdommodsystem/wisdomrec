const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file to Cloudinary
 * @param {string} filePath - Path to the file
 * @param {string} fileName - Desired public ID for the file
 * @returns {Promise<object>} - Cloudinary upload result
 */
async function uploadToCloudinary(filePath, fileName) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'video', // Required for audio files
            public_id: fileName.replace('.mp3', ''),
            folder: 'wisdom_recordings'
        });
        return result;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        throw error;
    }
}

/**
 * Creates a Cloudinary upload stream
 * @param {string} fileName - Desired public ID for the file
 * @param {function} callback - Callback for completion
 * @returns {WritableStream} - Cloudinary upload stream
 */
function createCloudinaryUploadStream(fileName, callback) {
    return cloudinary.uploader.upload_stream({
        resource_type: 'video',
        public_id: fileName.replace('.mp3', ''),
        folder: 'wisdom_recordings'
    }, callback);
}

module.exports = { uploadToCloudinary, createCloudinaryUploadStream };
