import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — Animates a number from `from` to `to` over `duration` ms.
 * Uses requestAnimationFrame for smooth 60fps interpolation.
 * Returns the current animated value.
 */
export default function useCountUp(to, { from = 0, duration = 800, decimals = 1, enabled = true } = {}) {
  const [value, setValue] = useState(enabled ? from : to);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setValue(to);
      return;
    }

    // Check reduced motion preference
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }

    const startValue = from;
    const diff = to - startValue;
    if (diff === 0) {
      setValue(to);
      return;
    }

    startRef.current = null;

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;

      setValue(parseFloat(current.toFixed(decimals)));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    // Small delay so the animation starts after mount paint
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [to, from, duration, decimals, enabled]);

  return value;
}
