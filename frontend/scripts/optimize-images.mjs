#!/usr/bin/env node
/**
 * optimize-images.mjs
 * 
 * Build-time image optimizer for OurGuided.
 * Converts large JPEG/PNG hero images in public/ to WebP with responsive srcsets
 * and generates tiny LQIP (Low Quality Image Placeholder) base64 strings.
 * 
 * Outputs: public/image-manifest.json with mapping from original → optimized versions.
 * 
 * Usage: node scripts/optimize-images.mjs
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'image-manifest.json');

// Images to optimize and their configs
const IMAGES = [
  // Hero images — critical for LCP, generate full responsive set
  { src: 'hero-bg.jpg',       sizes: [480, 960, 1440, 1920], quality: 80, lqip: true },
  { src: 'manifesto-bg.jpg',  sizes: [480, 960, 1440, 1920], quality: 80, lqip: true },
  { src: 'environment.jpg',   sizes: [480, 960, 1440, 1920], quality: 80, lqip: true },
  { src: 'home_img.png',      sizes: [480, 960, 1440, 1920], quality: 80, lqip: true },
  // Floating button — only needs small size
  { src: 'song_button.png',   sizes: [180, 360],             quality: 78, lqip: false },
  // OG image — keep reasonable
  { src: 'og-image.png',      sizes: [1200],                 quality: 80, lqip: false },
];

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function generateLQIP(inputPath) {
  const buffer = await sharp(inputPath)
    .resize({ width: 20 })
    .blur(2)
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

async function optimizeImage(config) {
  const inputPath = path.join(PUBLIC_DIR, config.src);
  
  if (!(await fileExists(inputPath))) {
    console.log(`  ⚠ Skipping ${config.src} (not found)`);
    return null;
  }

  const baseName = path.parse(config.src).name;
  const originalStats = await fs.stat(inputPath);
  const originalSizeKB = (originalStats.size / 1024).toFixed(0);
  
  console.log(`  📸 ${config.src} (${originalSizeKB} KB)`);

  const entry = {
    original: `/${config.src}`,
    webp: {},
    lqip: null,
  };

  // Generate WebP at each size
  for (const width of config.sizes) {
    const outName = `${baseName}-${width}w.webp`;
    const outPath = path.join(PUBLIC_DIR, outName);

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: config.quality })
      .toFile(outPath);

    const stats = await fs.stat(outPath);
    const sizeKB = (stats.size / 1024).toFixed(0);
    console.log(`    → ${outName} (${sizeKB} KB)`);

    entry.webp[width] = `/${outName}`;
  }

  // Generate LQIP blur placeholder
  if (config.lqip) {
    entry.lqip = await generateLQIP(inputPath);
    console.log(`    → LQIP placeholder (${entry.lqip.length} chars)`);
  }

  // Build srcSet string for convenience
  entry.srcSet = config.sizes
    .map(w => `/${baseName}-${w}w.webp ${w}w`)
    .join(', ');

  // Default src (largest size)
  entry.defaultWebp = entry.webp[config.sizes[config.sizes.length - 1]];

  return entry;
}

async function main() {
  console.log('\n🖼  OurGuided Image Optimizer\n');
  console.log(`  Source: ${PUBLIC_DIR}`);
  console.log(`  Output: ${MANIFEST_PATH}\n`);

  const manifest = {};

  for (const config of IMAGES) {
    const entry = await optimizeImage(config);
    if (entry) {
      manifest[config.src] = entry;
    }
  }

  // Write manifest
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest written: ${MANIFEST_PATH}`);
  console.log(`   ${Object.keys(manifest).length} images optimized.\n`);
}

main().catch(err => {
  console.error('❌ Image optimization failed:', err);
  process.exit(1);
});
