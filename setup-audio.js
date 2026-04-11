#!/usr/bin/env node

/**
 * Setup script to ensure delete_sound.mp4 is in place
 * Run: node setup-audio.js
 */

const path = require('path');
const fs = require('fs');

const audioDir = path.join(__dirname, 'frontend', 'public', 'audio');
const audioFile = path.join(audioDir, 'delete_sound.mp4');

// Ensure directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`✓ Created audio directory: ${audioDir}`);
}

// Check if file exists
if (fs.existsSync(audioFile)) {
  const stats = fs.statSync(audioFile);
  console.log(`✓ delete_sound.mp4 already exists at: ${audioFile} (${(stats.size / 1024).toFixed(1)}KB)`);
  process.exit(0);
}

console.log(`
⚠️  delete_sound.mp4 not found!

Please place the delete_sound.mp4 file at:
${audioFile}

Steps:
1. Locate your delete_sound.mp4 audio file
2. Copy it to: frontend/public/audio/delete_sound.mp4
3. Run: npm run build

The app will work with a synthesized fallback sound if the file is missing.
`);
