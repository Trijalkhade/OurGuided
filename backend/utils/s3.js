const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
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
 * Uploads a file (or buffer) to S3 and returns the public URL
 * @param {Buffer|string} fileData - The file buffer or a file path string
 * @param {string} mimetype - image/jpeg, image/png, video/mp4, etc.
 * @param {string} folder - 'profile' or 'posts'
 */
async function uploadToS3(fileData, mimetype, folder = 'images') {
  if (!fileData) return null;
  
  // Generate a random unique filename
  const extension = mimetype.split('/')[1] || 'jpeg';
  const key = `${folder}/${crypto.randomUUID()}.${extension}`;

  const bodyStream = typeof fileData === 'string' ? fs.createReadStream(fileData) : fileData;

  const parallelUploads3 = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: bodyStream,
      ContentType: mimetype,
      CacheControl: 'max-age=31536000', // Cache for 1 year
    },
    partSize: 10 * 1024 * 1024, // 10 MB per worker
    queueSize: Math.max(1, require('os').cpus().length - 1), // Max concurrency (-1)
    leavePartsOnError: false, // Clean up failed parts
  });

  await parallelUploads3.done();

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
