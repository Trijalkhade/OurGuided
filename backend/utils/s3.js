const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Uploads a buffer to S3 and returns the public URL
 * @param {Buffer} buffer - The file data
 * @param {string} mimetype - image/jpeg, image/png, etc.
 * @param {string} folder - 'profile' or 'posts'
 */
async function uploadToS3(buffer, mimetype, folder = 'images') {
  if (!buffer) return null;
  
  // Generate a random unique filename
  const extension = mimetype.split('/')[1] || 'jpeg';
  const key = `${folder}/${crypto.randomUUID()}.${extension}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    CacheControl: 'max-age=31536000', // Cache for 1 year
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
}

/**
 * Deletes an object from S3 given its URL
 */
async function deleteFromS3(url) {
  if (!url || !url.includes(BUCKET)) return;
  const key = url.split('.amazonaws.com/')[1];
  if (key) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
}

module.exports = { uploadToS3, deleteFromS3 };
