import React, { useState, useRef, useEffect } from 'react';

/**
 * OptimizedImage — Premium image component with WebP, responsive srcSet, and LQIP blur.
 *
 * Uses the image-manifest.json generated at build time by optimize-images.mjs.
 * Falls back gracefully to the original image if no optimized version exists.
 *
 * Props:
 *   src          — Original image path (e.g. "/hero-bg.jpg")
 *   alt          — Alt text (required for a11y)
 *   className    — CSS class for the <img>
 *   loading      — "eager" | "lazy" (default: "lazy")
 *   fetchPriority — "high" | "low" | "auto" (default: "auto")
 *   sizes        — Responsive sizes attribute (e.g. "100vw")
 *   onLoad       — Callback when the full image loads
 *   style        — Inline styles for the container
 *   wrapperClass — CSS class for the outer wrapper div
 */

// Manifest is loaded once at module level from the build output
let _manifest = null;
let _manifestLoaded = false;

function getManifest() {
  if (_manifestLoaded) return _manifest;
  _manifestLoaded = true;
  try {
    // Vite bundles JSON imports, but this is a public asset — fetch lazily
    // For SSR/prerender safety, we try a synchronous approach via a global
    if (typeof window !== 'undefined' && window.__IMAGE_MANIFEST__) {
      _manifest = window.__IMAGE_MANIFEST__;
    }
  } catch {
    _manifest = null;
  }
  return _manifest;
}

// Dynamically load the manifest on first render
let _manifestPromise = null;

function loadManifest() {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = fetch('/image-manifest.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => { _manifest = data; _manifestLoaded = true; return data; })
    .catch(() => { _manifestLoaded = true; return null; });
  return _manifestPromise;
}

const OptimizedImage = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  sizes = '100vw',
  onLoad,
  style,
  wrapperClass = '',
  ...rest
}) => {
  const [manifest, setManifest] = useState(getManifest);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // Load manifest if not already loaded
  useEffect(() => {
    if (!manifest) {
      loadManifest().then(data => {
        if (data) setManifest(data);
      });
    }
  }, [manifest]);

  // Check if already loaded (cached images fire load before effect)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = (e) => {
    setLoaded(true);
    if (onLoad) onLoad(e);
  };

  // Look up the filename (strip leading slash)
  const filename = src?.replace(/^\//, '');
  const entry = manifest?.[filename];

  if (!entry) {
    // No optimized version — render original with basic lazy loading
    return (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onLoad={handleLoad}
        style={style}
        {...rest}
      />
    );
  }

  const lqipStyle = entry.lqip ? {
    backgroundImage: `url(${entry.lqip})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : {};

  return (
    <div
      className={`optimized-img-wrapper ${wrapperClass}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* LQIP blur background — visible until full image loads */}
      {entry.lqip && !loaded && (
        <div
          className="optimized-img-lqip"
          style={{
            ...lqipStyle,
            position: 'absolute',
            inset: 0,
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            zIndex: 1,
            transition: 'opacity 0.4s ease-out',
            opacity: loaded ? 0 : 1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Optimized picture element with WebP sources */}
      <picture style={{ display: 'contents' }}>
        <source
          type="image/webp"
          srcSet={entry.srcSet}
          sizes={sizes}
        />
        <img
          ref={imgRef}
          src={entry.defaultWebp || src}
          alt={alt}
          className={className}
          loading={loading}
          fetchpriority={fetchPriority}
          onLoad={handleLoad}
          style={{
            position: 'relative',
            zIndex: 2,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease-out',
          }}
          {...rest}
        />
      </picture>
    </div>
  );
};

export default OptimizedImage;
