const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const crypto = require('crypto');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT_URL, // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET = process.env.AWS_S3_BUCKET;

// CDN base URL — when set, all returned URLs use CloudFront/CDN instead of direct S3
// e.g. https://d1234abcdef.cloudfront.net or https://cdn.ourguided.tech
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/+$/, '');

/**
 * Build the public URL for an S3 key.
 * Prefers CDN_BASE_URL if configured, otherwise falls back to direct S3.
 */
function buildUrl(key) {
  if (CDN_BASE_URL) {
    return `${CDN_BASE_URL}/${key}`;
  }
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Extract the S3 key from a URL (handles both CDN and direct S3 URLs)
 */
function extractKey(url) {
  if (!url) return null;
  // CDN URL: https://cdn.example.com/posts/abc.jpg → posts/abc.jpg
  if (CDN_BASE_URL && url.startsWith(CDN_BASE_URL)) {
    return url.slice(CDN_BASE_URL.length + 1);
  }
  // Direct S3 URL: https://bucket.s3.region.amazonaws.com/key
  const s3Match = url.split('.amazonaws.com/')[1];
  return s3Match || null;
}

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

  return buildUrl(key);
}

/**
 * Uploads an optimised WebP image + thumbnail to S3.
 * Returns { url, thumbnailUrl } or { url: null, thumbnailUrl: null } on failure.
 *
 * @param {string} filePath  - Local path to the uploaded image
 * @param {string} folder    - S3 folder prefix (e.g. 'posts', 'posts/extra')
 */
async function uploadOptimizedImage(filePath, folder = 'posts') {
  if (!filePath) return { url: null, thumbnailUrl: null };

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    // sharp not installed — fall back to raw upload
    const url = await uploadToS3(filePath, 'image/jpeg', folder);
    return { url, thumbnailUrl: null };
  }

  const id = crypto.randomUUID();

  // Full-size WebP (max 1920px wide, quality 82)
  const fullBuffer = await sharp(filePath)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const fullKey = `${folder}/${id}.webp`;
  await new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: fullKey,
      Body: fullBuffer,
      ContentType: 'image/webp',
      CacheControl: 'max-age=31536000',
    },
    leavePartsOnError: false,
  }).done();

  // Thumbnail (480px wide, quality 72)
  const thumbBuffer = await sharp(filePath)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const thumbKey = `${folder}/${id}_thumb.webp`;
  await new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/webp',
      CacheControl: 'max-age=31536000',
    },
    leavePartsOnError: false,
  }).done();

  return {
    url: buildUrl(fullKey),
    thumbnailUrl: buildUrl(thumbKey),
  };
}

/**
 * Deletes an object from S3 given its URL (supports both CDN and direct S3 URLs)
 */
async function deleteFromS3(url) {
  const key = extractKey(url);
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadToS3, uploadOptimizedImage, deleteFromS3, buildUrl };
