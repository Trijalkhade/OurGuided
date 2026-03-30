import React, { useEffect, useCallback, useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * ImageModal – fullscreen lightbox with carousel, keyboard nav, dots.
 * Props:
 *   images     : string[]   array of image src URLs
 *   startIndex : number     which image to open (default 0)
 *   onClose    : () => void
 */
const ImageModal = ({ images = [], startIndex = 0, onClose }) => {
  const [current, setCurrent] = useState(Math.max(0, Math.min(startIndex, images.length - 1)));
  const total   = images.length;
  const hasPrev = current > 0;
  const hasNext = current < total - 1;

  const goPrev = useCallback(() => { if (hasPrev) setCurrent(i => i - 1); }, [hasPrev]);
  const goNext = useCallback(() => { if (hasNext) setCurrent(i => i + 1); }, [hasNext]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  /* Prevent body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!images.length) return null;

  return (
    <div
      className="lightbox-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close */}
      <button className="lightbox-close" onClick={onClose} aria-label="Close image viewer">
        <FiX size={18} />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button className="lightbox-nav prev" onClick={goPrev} disabled={!hasPrev} aria-label="Previous image">
          <FiChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div className="lightbox-inner">
        <img
          key={current}
          src={images[current]}
          alt={`Image ${current + 1} of ${total}`}
          className="lightbox-img"
          draggable={false}
        />
      </div>

      {/* Next */}
      {total > 1 && (
        <button className="lightbox-nav next" onClick={goNext} disabled={!hasNext} aria-label="Next image">
          <FiChevronRight size={22} />
        </button>
      )}

      {/* Dots (≤10 images) */}
      {total > 1 && total <= 10 && (
        <div className="lightbox-dots" role="tablist" aria-label="Image navigation">
          {images.map((_, i) => (
            <button
              key={i}
              className={`lightbox-dot${i === current ? ' active' : ''}`}
              onClick={() => setCurrent(i)}
              role="tab"
              aria-selected={i === current}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {total > 1 && (
        <div className="lightbox-counter" aria-live="polite">
          {current + 1} / {total}
        </div>
      )}
    </div>
  );
};

export default ImageModal;