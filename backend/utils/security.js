/**
 * Validates if a buffer starts with known image magic numbers (JPEG, PNG, WebP)
 * to prevent polyglot file attacks (e.g., SVG/HTML disguised as a JPG).
 */
function isBufferSafeImage(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const hex = buffer.toString('hex', 0, 12).toUpperCase();

  // JPEG: FF D8 FF
  if (hex.startsWith('FFD8FF')) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504E470D0A1A0A')) return true;

  // WebP: RIFF .... WEBP
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return true;

  return false;
}

module.exports = { isBufferSafeImage };
