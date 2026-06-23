import React, { useEffect, useCallback, useRef } from 'react';
import { useGrowth } from '../context/GrowthContext';
import useCountUp from '../utils/useCountUp';
import { FiX, FiArrowUp, FiShield } from 'react-icons/fi';
import { soundEffect } from '../utils/soundEffect';
import { hapticEngine } from '../utils/hapticEngine';

/**
 * GrowthCelebrationModal — Full-screen celebration when growth is awarded.
 * Shows animated line growth, height counter, and reference object info.
 * Uses CSS animations (no Framer Motion).
 */
const GrowthCelebrationModal = () => {
  const { isModalOpen, lastAwardData, closeModal, heightCm, currentRef, nextRef, progressPct } = useGrowth();
  const modalRef = useRef(null);
  const hasPlayedSound = useRef(false);

  const formatHeight = (cm) => {
    if (cm >= 100) return `${(cm / 100).toFixed(1)}m`;
    return `${cm.toFixed(0)}cm`;
  };

  // Animated height counter
  const prevHeight = lastAwardData ? lastAwardData.new_height_cm - lastAwardData.gained_cm : heightCm;
  const targetHeight = lastAwardData ? lastAwardData.new_height_cm : heightCm;
  const animatedHeight = useCountUp(targetHeight, {
    from: prevHeight,
    duration: 800,
    decimals: 1,
    enabled: isModalOpen,
  });

  // Sound + haptic on open
  useEffect(() => {
    if (isModalOpen && !hasPlayedSound.current) {
      hasPlayedSound.current = true;
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (!prefersReduced) {
        hapticEngine.modalOpen();
        // Delayed success sound after line animation completes
        const timer = setTimeout(() => {
          if (lastAwardData?.crossed_new_ref) {
            soundEffect.celebration();
            hapticEngine.celebration();
          } else {
            soundEffect.success();
            hapticEngine.success();
          }
        }, 600);
        return () => clearTimeout(timer);
      }
    }
    if (!isModalOpen) {
      hasPlayedSound.current = false;
    }
  }, [isModalOpen, lastAwardData]);

  // Focus trap + Escape key
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isModalOpen, closeModal]);

  // Auto-close after 5s idle
  useEffect(() => {
    if (!isModalOpen) return;
    const timer = setTimeout(closeModal, 5000);
    return () => clearTimeout(timer);
  }, [isModalOpen, closeModal]);

  if (!isModalOpen || !lastAwardData) return null;

  const { gained_cm, crossed_new_ref, streak_protected } = lastAwardData;
  const displayRef = lastAwardData.current_ref || currentRef;
  const displayNextRef = lastAwardData.next_ref || nextRef;
  const displayProgress = lastAwardData.progress_pct ?? progressPct;

  // Calculate progress bar fill for animation
  const prevProgressPct = displayNextRef && displayRef
    ? Math.max(0, displayProgress - (gained_cm / (displayNextRef.height_cm - displayRef.height_cm)) * 100)
    : 0;

  return (
    <div
      className="gj-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Growth celebration"
    >
      <div className="gj-modal-card" ref={modalRef}>
        {/* Close button */}
        <button className="gj-modal-close" onClick={closeModal} aria-label="Close">
          <FiX size={18} />
        </button>

        {/* Growth visualization */}
        <div className="gj-modal-visual">
          {/* Animated growth line */}
          <div className="gj-modal-line-container">
            <div className="gj-modal-line-track">
              <div className="gj-modal-line-fill gj-animate-grow" />
              <div className="gj-modal-line-glow gj-animate-grow" />
            </div>
          </div>

          {/* Height counter */}
          <div className="gj-modal-counter" aria-live="polite">
            <div className="gj-modal-height-value">
              {formatHeight(animatedHeight)}
            </div>
            <div className="gj-modal-height-gained gj-animate-fade-in">
              <FiArrowUp size={12} />
              +{gained_cm}cm today
            </div>
          </div>
        </div>

        {/* Shield used notification */}
        {streak_protected && (
          <div className="gj-modal-shield-notice gj-animate-fade-in">
            <FiShield size={14} />
            <span>Streak Shield used — your streak is safe!</span>
          </div>
        )}

        {/* Reference object card */}
        {crossed_new_ref && displayRef && (
          <div className="gj-modal-milestone gj-animate-fade-in-delayed">
            <div className="gj-modal-milestone-label">🎉 New Milestone!</div>
            <div className="gj-modal-milestone-name">
              Taller than: {displayRef.label}
            </div>
            <div className="gj-modal-milestone-height">
              {formatHeight(displayRef.height_cm)}
            </div>
          </div>
        )}

        {/* Progress to next */}
        {displayNextRef && (
          <div className="gj-modal-next gj-animate-fade-in-delayed">
            <div className="gj-modal-next-label">Next: {displayNextRef.label}</div>
            <div className="gj-modal-next-bar">
              <div
                className="gj-modal-next-fill"
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              />
            </div>
            <div className="gj-modal-next-distance">
              {formatHeight(Math.max(0, displayNextRef.height_cm - targetHeight))} remaining
            </div>
          </div>
        )}

        {/* Continue button */}
        <button className="gj-modal-continue" onClick={closeModal}>
          Continue
        </button>
      </div>
    </div>
  );
};

export default GrowthCelebrationModal;
