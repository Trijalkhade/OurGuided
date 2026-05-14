const multer = require("multer");

const path = require('path');
const fs = require('fs');

const tmpDir = path.join(__dirname, '../tmp/');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tmpDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1000 * 1024 * 1024 // 1GB for very large videos
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/mpeg'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP images and MP4 videos are allowed.'), false);
    }
  }
});

module.exports = upload;
