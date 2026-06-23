import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGrowth } from '../context/GrowthContext';
import { API } from '../context/AuthContext';
import { FiX, FiShield } from 'react-icons/fi';

/**
 * GrowthRulerPanel
 * ────────────────
 * Right-side fixed button that opens a visual height-ruler popup.
 *
 * Design:
 * - Vertical ruler line starting from a black dot (origin)
 * - Height markings along the ruler at regular intervals
 * - The CURRENT reference object image is shown beside the ruler,
 *   sized proportionally so the full ruler fits the panel height
 * - No past or future references are revealed
 */
const GrowthRulerPanel = () => {
  const {
    heightCm, currentRef, nextRef, progressPct,
    distanceRemainingCm, shieldCount, maxShields,
    streakDays, loading
  } = useGrowth();

  const [isOpen, setIsOpen] = useState(false);
  const [refImg, setRefImg] = useState(null);
  const panelRef = useRef(null);

  // Try loading the current reference SVG
  useEffect(() => {
    if (!currentRef) return;
    // Build the asset filename from the label
    const slug = currentRef.label.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
    const img = new Image();
    img.onload = () => setRefImg(`/assets/growth/${slug}.svg`);
    img.onerror = () => setRefImg(null);
    img.src = `/assets/growth/${slug}.svg`;
  }, [currentRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Close on click outside panel
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) setIsOpen(false);
  }, []);

  if (loading) return null;

  const formatHeight = (cm) => {
    if (cm >= 100000) return `${(cm / 100000).toFixed(1)}km`;
    if (cm >= 100) return `${(cm / 100).toFixed(1)}m`;
    return `${Math.round(cm)}cm`;
  };

  // ── Ruler math ─────────────────────────────────────────────────
  // The ruler shows from 0 to the current reference's height (or next ref if exists).
  // This ensures the reference image fills the panel at proportional scale.
  const refHeight = currentRef ? parseFloat(currentRef.height_cm) : 100;
  // Pick a "max" for the ruler: the reference object height, or user height + some buffer
  const rulerMax = Math.max(refHeight, heightCm * 1.15);

  // Generate tick marks for the ruler
  const generateTicks = (maxCm) => {
    const ticks = [];
    // Pick a nice interval based on scale
    let interval;
    if (maxCm <= 50) interval = 5;
    else if (maxCm <= 200) interval = 20;
    else if (maxCm <= 1000) interval = 100;
    else if (maxCm <= 10000) interval = 1000;
    else if (maxCm <= 100000) interval = 10000;
    else interval = 100000;

    for (let v = 0; v <= maxCm; v += interval) {
      const pct = (v / maxCm) * 100;
      const isMajor = v % (interval * 5) === 0 || v === 0;
      ticks.push({ value: v, pct, isMajor, label: formatHeight(v) });
    }
    return ticks;
  };

  const ticks = generateTicks(rulerMax);
  const userPct = Math.min((heightCm / rulerMax) * 100, 100);
  const refPct = (refHeight / rulerMax) * 100;

  return (
    <>
      {/* ── RIGHT-SIDE BUTTON (fixed) ──────────────────────────── */}
      <button
        className="gj-ruler-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Open Growth Journey"
        title="Growth Journey"
      >
        <img
          src="/assets/growth/ruler-button.png"
          alt="Growth ruler"
          className="gj-ruler-btn-img"
          draggable={false}
        />
      </button>

      {/* ── POPUP OVERLAY ──────────────────────────────────────── */}
      {isOpen && (
        <div
          className="gj-ruler-overlay"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label="Growth Journey"
        >
          <div className="gj-ruler-panel" ref={panelRef}>
            {/* Header */}
            <div className="gj-ruler-header">
              <div className="gj-ruler-title-group">
                <h3 className="gj-ruler-title">Growth Journey</h3>
                <div className="gj-ruler-height-display">{formatHeight(heightCm)}</div>
              </div>
              <div className="gj-ruler-stats">
                <span className="gj-ruler-stat">
                  🔥 {streakDays} day{streakDays !== 1 ? 's' : ''}
                </span>
                <span className="gj-ruler-stat">
                  <FiShield size={12} />
                  {shieldCount}/{maxShields}
                </span>
              </div>
              <button
                className="gj-ruler-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* ── VISUAL RULER AREA ────────────────────────────── */}
            <div className="gj-ruler-body">
              {/* Reference object image — positioned at the ref's height */}
              {currentRef && (
                <div
                  className="gj-ruler-ref-zone"
                  style={{ bottom: `${refPct}%` }}
                >
                  <div className="gj-ruler-ref-img-wrap">
                    {refImg ? (
                      <img
                        src={refImg}
                        alt={currentRef.label}
                        className="gj-ruler-ref-img"
                        draggable={false}
                      />
                    ) : (
                      <div className="gj-ruler-ref-placeholder">
                        <span className="gj-ruler-ref-emoji">
                          {currentRef.label.includes('Human') ? '🧍' :
                           currentRef.label.includes('Hand') ? '✋' :
                           currentRef.label.includes('Paper') || currentRef.label.includes('A4') ? '📄' :
                           currentRef.label.includes('Toddler') ? '👶' :
                           currentRef.label.includes('Giraffe') ? '🦒' :
                           currentRef.label.includes('Oak') || currentRef.label.includes('Tree') ? '🌳' :
                           currentRef.label.includes('Basketball') ? '🏀' :
                           currentRef.label.includes('Statue') ? '🗽' :
                           currentRef.label.includes('Eiffel') ? '🗼' :
                           currentRef.label.includes('Burj') ? '🏗️' :
                           currentRef.label.includes('Everest') ? '🏔️' : '📏'}
                        </span>
                      </div>
                    )}
                    <div className="gj-ruler-ref-label">{currentRef.label}</div>
                    <div className="gj-ruler-ref-height">{formatHeight(refHeight)}</div>
                  </div>

                  {/* Horizontal dashed line from ref to ruler */}
                  <div className="gj-ruler-ref-line" />
                </div>
              )}

              {/* The ruler itself */}
              <div className="gj-ruler-track">
                {/* Origin dot */}
                <div className="gj-ruler-origin" />

                {/* Tick marks */}
                {ticks.map((tick) => (
                  <div
                    key={tick.value}
                    className={`gj-ruler-tick${tick.isMajor ? ' major' : ''}`}
                    style={{ bottom: `${tick.pct}%` }}
                  >
                    <div className="gj-ruler-tick-line" />
                    {tick.isMajor && (
                      <span className="gj-ruler-tick-label">{tick.label}</span>
                    )}
                  </div>
                ))}

                {/* User's current height marker */}
                <div
                  className="gj-ruler-user-marker"
                  style={{ bottom: `${userPct}%` }}
                >
                  <div className="gj-ruler-user-dot" />
                  <div className="gj-ruler-user-label">
                    {formatHeight(heightCm)}
                  </div>
                </div>

                {/* Filled portion of the ruler */}
                <div
                  className="gj-ruler-fill"
                  style={{ height: `${userPct}%` }}
                />
              </div>
            </div>

            {/* Footer with next target info (subtle, no reference name) */}
            {nextRef && (
              <div className="gj-ruler-footer">
                <div className="gj-ruler-footer-bar">
                  <div
                    className="gj-ruler-footer-fill"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
                <div className="gj-ruler-footer-text">
                  {formatHeight(distanceRemainingCm)} to next milestone
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GrowthRulerPanel;
