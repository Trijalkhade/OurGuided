import { useRef, useEffect, useCallback } from 'react';
import { API } from '../context/AuthContext';

/**
 * useEngagementTracker — Passive engagement tracking for posts.
 *
 * Tracks:
 *   • Watch time (seconds a post is in viewport)
 *   • Impressions (was the post shown?)
 *   • Scroll depth % (how far user read long text)
 *   • Video completion % (how much of video was watched)
 *
 * Sends batched updates every BATCH_INTERVAL_MS and on page unload.
 *
 * Usage:
 *   const { registerPost, registerVideo, unregisterPost } = useEngagementTracker();
 *   // Call registerPost(postId, element) when a PostCard mounts
 *   // Call registerVideo(postId, videoElement) when a video element renders
 *   // Call unregisterPost(postId) when a PostCard unmounts
 */

const BATCH_INTERVAL_MS = 10000; // 10 seconds

/** Derive time-of-day bucket from current hour */
function getTimeBucket() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export default function useEngagementTracker() {
  // ── Accumulated data (mutable refs to avoid re-renders) ──
  const watchTimesRef      = useRef(new Map()); // postId → accumulated seconds
  const impressionsRef     = useRef(new Set()); // postIds that became visible
  const scrollDepthsRef    = useRef(new Map()); // postId → max depth %
  const videoCompletionsRef = useRef(new Map()); // postId → max completion %
  const lastFlushRef       = useRef(Date.now());

  // Track which posts are currently visible + their entry timestamps
  const visibleSinceRef = useRef(new Map()); // postId → timestamp when became visible
  const postElementsRef = useRef(new Map()); // postId → DOM element
  const videoElementsRef = useRef(new Map()); // postId → video element
  const observerRef     = useRef(null);
  const timerRef        = useRef(null);
  const isMountedRef    = useRef(true);

  // ── Flush: send accumulated data to backend ──
  const flush = useCallback(() => {
    // Finalize watch times for currently visible posts
    const now = Date.now();
    for (const [postId, since] of visibleSinceRef.current.entries()) {
      const elapsed = Math.round((now - since) / 1000);
      if (elapsed > 0) {
        const prev = watchTimesRef.current.get(postId) || 0;
        watchTimesRef.current.set(postId, prev + elapsed);
        visibleSinceRef.current.set(postId, now); // reset timer
      }
    }

    // Build payload
    const impressions = [];
    const clientHour = new Date().getHours();
    for (const postId of impressionsRef.current) {
      impressions.push({ postId, clientHour });
    }

    const watchTimes = [];
    for (const [postId, seconds] of watchTimesRef.current) {
      if (seconds > 0) watchTimes.push({ postId, seconds });
    }

    const scrollDepths = [];
    for (const [postId, depthPct] of scrollDepthsRef.current) {
      if (depthPct > 0) scrollDepths.push({ postId, depthPct });
    }

    const videoCompletions = [];
    for (const [postId, completionPct] of videoCompletionsRef.current) {
      if (completionPct > 0) videoCompletions.push({ postId, completionPct });
    }

    // Only send if there's data
    if (impressions.length === 0 && watchTimes.length === 0 &&
        scrollDepths.length === 0 && videoCompletions.length === 0) {
      return;
    }

    const payload = { impressions, watchTimes, scrollDepths, videoCompletions };

    // Fire-and-forget (use sendBeacon for unload, fetch for normal flush)
    if (!isMountedRef.current && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/engagement/batch', blob);
    } else {
      API.post('/engagement/batch', payload).catch(() => {
        // Silently fail — engagement data is best-effort
      });
    }

    // Clear accumulated data after flush
    watchTimesRef.current.clear();
    impressionsRef.current.clear();
    scrollDepthsRef.current.clear();
    videoCompletionsRef.current.clear();
    lastFlushRef.current = Date.now();
  }, []);

  // ── IntersectionObserver callback ──
  const handleIntersection = useCallback((entries) => {
    const now = Date.now();
    for (const entry of entries) {
      const postId = entry.target.dataset.postId;
      if (!postId) continue;

      if (entry.isIntersecting) {
        // Post entered viewport
        if (!visibleSinceRef.current.has(postId)) {
          visibleSinceRef.current.set(postId, now);
        }
        impressionsRef.current.add(postId);
      } else {
        // Post left viewport — accumulate watch time
        const since = visibleSinceRef.current.get(postId);
        if (since) {
          const elapsed = Math.round((now - since) / 1000);
          const prev = watchTimesRef.current.get(postId) || 0;
          watchTimesRef.current.set(postId, prev + elapsed);
          visibleSinceRef.current.delete(postId);
        }
      }
    }
  }, []);

  // ── Scroll depth tracking ──
  const handleScroll = useCallback(() => {
    for (const [postId, el] of postElementsRef.current.entries()) {
      // Only track posts with substantial text content (> 200 chars)
      const contentEl = el.querySelector('.post-content');
      if (!contentEl) continue;
      const text = contentEl.textContent || '';
      if (text.length < 200) continue;

      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate how much of the post the user has scrolled through
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const totalHeight = rect.height;
        const scrolledPast = Math.max(0, viewportHeight - rect.top);
        const depthPct = Math.min(100, Math.round((scrolledPast / totalHeight) * 100));

        const prev = scrollDepthsRef.current.get(postId) || 0;
        if (depthPct > prev) {
          scrollDepthsRef.current.set(postId, depthPct);
        }
      }
    }
  }, []);

  // ── Video completion tracking ──
  const handleVideoTimeUpdate = useCallback((postId, videoEl) => {
    if (!videoEl || !videoEl.duration || videoEl.duration === Infinity) return;
    const pct = Math.round((videoEl.currentTime / videoEl.duration) * 100);
    const prev = videoCompletionsRef.current.get(postId) || 0;
    if (pct > prev) {
      videoCompletionsRef.current.set(postId, pct);
    }
  }, []);

  // ── Setup observer + timers ──
  useEffect(() => {
    isMountedRef.current = true;

    // Create IntersectionObserver (threshold: 50% visible)
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: 0.5
    });

    // Batch flush timer
    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    // Scroll listener for depth tracking (throttled)
    let scrollTicking = false;
    const scrollHandler = () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
          handleScroll();
          scrollTicking = false;
        });
      }
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });

    // Flush on page unload
    const unloadHandler = () => {
      isMountedRef.current = false;
      flush();
    };
    window.addEventListener('beforeunload', unloadHandler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });

    return () => {
      isMountedRef.current = false;
      clearInterval(timerRef.current);
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('beforeunload', unloadHandler);

      // Disconnect observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Final flush on unmount
      flush();
    };
  }, [flush, handleIntersection, handleScroll]);

  // ── Public API ──

  /** Register a post card element for tracking */
  const registerPost = useCallback((postId, element) => {
    if (!postId || !element) return;
    element.dataset.postId = postId;
    postElementsRef.current.set(postId, element);
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  /** Register a video element for completion tracking */
  const registerVideo = useCallback((postId, videoEl) => {
    if (!postId || !videoEl) return;
    videoElementsRef.current.set(postId, videoEl);
    const handler = () => handleVideoTimeUpdate(postId, videoEl);
    videoEl.addEventListener('timeupdate', handler);
    // Store handler ref for cleanup
    videoEl._engagementHandler = handler;
  }, [handleVideoTimeUpdate]);

  /** Unregister a post (on unmount) */
  const unregisterPost = useCallback((postId) => {
    if (!postId) return;

    // Stop observing
    const el = postElementsRef.current.get(postId);
    if (el && observerRef.current) {
      observerRef.current.unobserve(el);
    }
    postElementsRef.current.delete(postId);

    // Finalize watch time
    const since = visibleSinceRef.current.get(postId);
    if (since) {
      const elapsed = Math.round((Date.now() - since) / 1000);
      const prev = watchTimesRef.current.get(postId) || 0;
      watchTimesRef.current.set(postId, prev + elapsed);
      visibleSinceRef.current.delete(postId);
    }

    // Remove video listener
    const videoEl = videoElementsRef.current.get(postId);
    if (videoEl && videoEl._engagementHandler) {
      videoEl.removeEventListener('timeupdate', videoEl._engagementHandler);
      delete videoEl._engagementHandler;
    }
    videoElementsRef.current.delete(postId);
  }, []);

  return { registerPost, registerVideo, unregisterPost, flush };
}
