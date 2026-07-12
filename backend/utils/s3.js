const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const crypto = require('crypto');

// --- Clients ---
// Primary: Cloudflare R2
const r2Client = process.env.R2_ENDPOINT_URL ? new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  }
}) : null;

// Fallback: AWS S3
const awsClient = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const AWS_BUCKET = process.env.AWS_S3_BUCKET;
const R2_BUCKET = process.env.R2_BUCKET || AWS_BUCKET;

// CDN base URL — usually mapped to Cloudflare/R2
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/+$/, '');

/**
 * Build the public URL for a key.
 * If uploaded to R2, it prefers the CDN URL.
 * If uploaded to AWS (fallback), it returns the direct S3 URL unless configured otherwise.
 */
function buildUrl(key, uploadedToR2 = true) {
  if (uploadedToR2 && CDN_BASE_URL) {
    return `${CDN_BASE_URL}/${key}`;
  }
  return `https://${AWS_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Extract the S3/R2 key from a URL (handles both CDN and direct S3 URLs)
 */
function extractKey(url) {
  if (!url) return null;
  if (CDN_BASE_URL && url.startsWith(CDN_BASE_URL)) {
    return url.slice(CDN_BASE_URL.length + 1);
  }
  const s3Match = url.split('.amazonaws.com/')[1];
  return s3Match || null;
}

/**
 * Core upload logic with fallback.
 * Attempts R2 first. If it fails (or isn't configured), falls back to AWS S3.
 */
async function executeUploadWithFallback(key, getBodyStream, mimetype) {
  let uploadedToR2 = false;

  if (r2Client) {
    try {
      await new Upload({
        client: r2Client,
        params: {
          Bucket: R2_BUCKET,
          Key: key,
          Body: getBodyStream(), // We use a function because streams can't be reused if they fail
          ContentType: mimetype,
          CacheControl: 'max-age=31536000',
        },
        partSize: 10 * 1024 * 1024,
        queueSize: Math.max(1, require('os').cpus().length - 1),
        leavePartsOnError: false,
      }).done();
      uploadedToR2 = true;
      return buildUrl(key, true);
    } catch (err) {
      console.error(`[S3] R2 upload failed for ${key}. Falling back to AWS S3. Error: ${err.message}`);
      // Fall through to AWS S3 attempt
    }
  }

  // Fallback to AWS S3
  await new Upload({
    client: awsClient,
    params: {
      Bucket: AWS_BUCKET,
      Key: key,
      Body: getBodyStream(),
      ContentType: mimetype,
      CacheControl: 'max-age=31536000',
    },
    partSize: 10 * 1024 * 1024,
    queueSize: Math.max(1, require('os').cpus().length - 1),
    leavePartsOnError: false,
  }).done();

  return buildUrl(key, false);
}

/**
 * Uploads a file (or buffer) to S3/R2 and returns the public URL
 */
async function uploadToS3(fileData, mimetype, folder = 'images') {
  if (!fileData) return null;

  const extension = mimetype.split('/')[1] || 'jpeg';
  const key = `${folder}/${crypto.randomUUID()}.${extension}`;

  // Stream generator function so it can be recreated if fallback is triggered
  const getBodyStream = () => typeof fileData === 'string' ? fs.createReadStream(fileData) : fileData;

  return executeUploadWithFallback(key, getBodyStream, mimetype);
}

/**
 * Uploads an optimised WebP image + thumbnail.
 */
async function uploadOptimizedImage(filePath, folder = 'posts') {
  if (!filePath) return { url: null, thumbnailUrl: null };

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    const url = await uploadToS3(filePath, 'image/jpeg', folder);
    return { url, thumbnailUrl: null };
  }

  const id = crypto.randomUUID();

  // Full-size WebP
  const fullBuffer = await sharp(filePath)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  
  const fullKey = `${folder}/${id}.webp`;
  const fullUrl = await executeUploadWithFallback(fullKey, () => fullBuffer, 'image/webp');

  // Thumbnail
  const thumbBuffer = await sharp(filePath)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const thumbKey = `${folder}/${id}_thumb.webp`;
  const thumbUrl = await executeUploadWithFallback(thumbKey, () => thumbBuffer, 'image/webp');

  return {
    url: fullUrl,
    thumbnailUrl: thumbUrl,
  };
}

/**
 * Deletes an object. Tries R2 first, then AWS S3.
 */
async function deleteFromS3(url) {
  const key = extractKey(url);
  if (!key) return;

  if (r2Client) {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      console.error(`[S3] R2 delete failed. Attempting AWS S3 fallback.`);
    }
  }

  try {
    await awsClient.send(new DeleteObjectCommand({ Bucket: AWS_BUCKET, Key: key }));
  } catch (err) {
    // Ignore deletion errors on fallback
  }
}

module.exports = { uploadToS3, uploadOptimizedImage, deleteFromS3, buildUrl };
