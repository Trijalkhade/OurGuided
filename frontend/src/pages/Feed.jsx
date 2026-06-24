import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, API } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import useFeedback from '../utils/useFeedback';
import useEngagementTracker from '../utils/useEngagementTracker';
import { SkelFeed } from '../components/Skeleton.jsx';
import { FiImage, FiTag, FiSend, FiEyeOff, FiChevronDown, FiZap, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as cache from '../utils/cache';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const CATEGORIES = [
  'Real Talk', 'Experiments & Ideas', 'Loopholes & Fixes', 'Life Hacks',
  'Youth & Education', 'Health & Body', 'Earth & Hands', 'Economy & Power',
];

/* ── CreatePost ──────────────────────────────────────────────────────────────── */
const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();
  const { onTap, onSuccess, onError, onCreateSuccess } = useFeedback();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [category, setCategory] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);

  const initials = (user && user.username ? user.username[0] : '?') && (user.username[0] || '?').toUpperCase();

  const handleSubmit = async () => {
    if (!content.trim() && imageFiles.length === 0 && !videoUrl.trim() && !videoFile)
      return toast.error('Add some media or text to post');
    onTap();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('tags', tags);
      fd.append('is_anonymous', isAnon ? 'true' : 'false');
      if (category) fd.append('category', category);
      if (imageFiles.length > 0) {
        fd.append('image', imageFiles[0]);
        for (let i = 1; i < imageFiles.length; i++) fd.append('images', imageFiles[i]);
      }
      if (videoFile) fd.append('video', videoFile);
      if (videoUrl.trim()) fd.append('video', videoUrl.trim());
      await API.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContent(''); setTags(''); setImageFiles([]);
      setVideoUrl(''); setVideoFile(null); setCategory(''); setIsAnon(false); setShowExtra(false);
      onCreateSuccess();
      toast.success('Post created!');
      // Invalidate all feed caches so fresh data is fetched
      cache.invalidatePrefix('feed');
      onPostCreated && onPostCreated();
    } catch (err) {
      onError();
      toast.error((err.response && err.response.data && err.response.data.message) || 'Failed to create post');
    }
    finally { setLoading(false); }
  };

  return (
    <div className="create-post">
      <div className="create-post-top">
        <div className="avatar" style={{ flexShrink: 0 }}>
          {user && user.photo ? <img src={user.photo} alt={user.username} /> : initials}
        </div>
        <textarea className="post-input"
          placeholder="What's on your mind? Share a real thought, a life hack, a truth, or call something out…"
          value={content} onChange={e => setContent(e.target.value)} rows={3} />
      </div>

      {showExtra && (
        <div style={{ marginTop: '.72rem', display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <FiTag size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input placeholder="Tags (comma separated)…" value={tags} onChange={e => setTags(e.target.value)}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }} />
          </div>
          <>
            <input
              list="feed-category-options"
              placeholder="Category (e.g. Real Talk)"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }}
            />
            <datalist id="feed-category-options">
              {CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </>
          <div>
            <label style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '.3rem' }}>Images (up to 6)</label>
            <input type="file" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files || []).slice(0, 6))} />
            {imageFiles.length > 0 && <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.25rem' }}>{imageFiles.length} image{imageFiles.length > 1 ? 's' : ''} selected</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
            <label style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '.3rem' }}>Video (MP4)</label>
            <input type="file" accept="video/mp4,video/x-m4v,video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            {videoFile && <div style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.25rem' }}>Video selected: {videoFile.name}</div>}
          </div>
          <input placeholder="Or Video URL (YouTube)…" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '.42rem .72rem', fontSize: '.85rem', color: 'var(--text)', outline: 'none' }} />
        </div>
      )}

      <div className="create-post-actions">
        <div className="post-media-btns">
          <button className="media-btn" onClick={() => setShowExtra(v => !v)}>
            <FiImage size={13} /> Media &amp; Options
            <FiChevronDown size={12} style={{ transform: showExtra ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </button>
          <button className={`media-btn ${isAnon ? 'selected' : ''}`} onClick={() => setIsAnon(v => !v)}>
            <FiEyeOff size={13} /> {isAnon ? 'Anonymous ON' : 'Anonymous'}
          </button>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '.55rem 1.2rem' }}
          onClick={handleSubmit} disabled={loading}>
          <FiSend size={13} /> {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
};

/* ── Feed ────────────────────────────────────────────────────────────────────── */

// Helper to build cache key for feed state
const feedCacheKey = (cat, rec) => `feed:${cat || ''}:${rec ? 'rec' : 'latest'}`;

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ── Refs (ALL before any early return) ──────────────────────────────────────
  const stateRef          = useRef();
  const pendingScrollRef  = useRef(null);
  const isInitialMount    = useRef(true);
  const videoRef          = useRef(null);

  // Check for return visit + try cache
  const isReturning = useRef(
    sessionStorage.getItem('returning_from_post') === 'true'
  ).current;

  // Try to restore from cache
  const cachedEntry = useRef(null);
  if (isReturning) {
    // Look for any feed cache entry — try to find one that matches
    const savedCat = sessionStorage.getItem('feed_catFilter') || '';
    const savedRec = sessionStorage.getItem('feed_useRec') !== 'false';
    const key = feedCacheKey(savedCat, savedRec);
    const hit = cache.get(key);
    if (hit) cachedEntry.current = { ...hit.data, catFilter: savedCat, useRec: savedRec };
  }

  const hasCachedData = cachedEntry.current !== null;

  // ── State (ALL before any early return) ─────────────────────────────────────
  const [posts,     setPosts]     = useState(hasCachedData ? cachedEntry.current.posts     : []);
  const [page,      setPage]      = useState(hasCachedData ? cachedEntry.current.page      : 1);
  const [catFilter, setCatFilter] = useState(hasCachedData ? cachedEntry.current.catFilter : '');
  const [hasMore,   setHasMore]   = useState(hasCachedData ? cachedEntry.current.hasMore   : true);
  const [useRec,    setUseRec]    = useState(hasCachedData ? cachedEntry.current.useRec    : true);
  const [fetching,  setFetching]  = useState(!hasCachedData);
  const [error,     setError]     = useState(false);

  // ── Nika Video Player state ─────────────────────────────────────────────────
  const [showNikaVideo, setShowNikaVideo] = useState(false);
  const [nikaClosing,   setNikaClosing]   = useState(false);
  const nikaOverlayRef = useRef(null);

  const openNikaVideo = useCallback(() => {
    setShowNikaVideo(true);
    setNikaClosing(false);
    // Hide feedback widget + other fixed UI
    document.body.classList.add('nika-video-active');
    // Enter browser fullscreen after overlay mounts
    requestAnimationFrame(() => {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs) rfs.call(el).catch(() => {});
    });
  }, []);

  const closeNikaVideo = useCallback(() => {
    setNikaClosing(true);
    // Pause video immediately
    if (videoRef.current) {
      videoRef.current.pause();
    }
    // Exit browser fullscreen
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (efs && document.fullscreenElement) efs.call(document).catch(() => {});
    // Remove body class
    document.body.classList.remove('nika-video-active');
    // Wait for fade-out animation to finish before unmounting
    setTimeout(() => {
      setShowNikaVideo(false);
      setNikaClosing(false);
    }, 280);
  }, []);

  // Close video if user exits fullscreen via browser mechanism (e.g. Esc long-press)
  useEffect(() => {
    if (!showNikaVideo) return;
    const onFsChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && showNikaVideo && !nikaClosing) {
        closeNikaVideo();
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [showNikaVideo, nikaClosing, closeNikaVideo]);

  stateRef.current = { posts, page, catFilter, hasMore, useRec };

  // ── fetchPosts (defined before effects that call it) ────────────────────────
  const fetchPosts = async (p = 1, cat = catFilter, rec = useRec, silent = false) => {
    if (!silent) setFetching(true);
    setError(false);
    try {
      let data;
      if (rec && !cat) {
        const res = await API.get(`/recommendations/feed?page=${p}`);
        data = res.data.posts;
        setHasMore(res.data.has_more);
        setPosts(prev => p === 1 ? data : [...prev, ...data]);
      } else {
        const params = new URLSearchParams({ page: p });
        if (cat) params.set('category', cat);
        const res = await API.get(`/posts/feed?${params}`);
        data = res.data;
        setHasMore(data.length === 10);
        setPosts(prev => p === 1 ? data : [...prev, ...data]);
      }
      // Update cache after successful fetch
      const key = feedCacheKey(cat, rec);
      cache.set(key, { posts: p === 1 ? data : stateRef.current.posts, page: p, catFilter: cat, hasMore: stateRef.current.hasMore, useRec: rec }, 'feed');
    } catch (err) {
      console.error(err);
      setError(true);
      if (!silent) toast.error('Failed to load feed');
    } finally {
      setFetching(false);
    }
  };

  // ── Effects (ALL before any early return) ───────────────────────────────────

  // Auth redirect
  useEffect(() => {
    if (!loading && !user && !isPrerender) navigate('/login');
  }, [user, loading, navigate]);

  // Mount: restore from cache or do a fresh fetch
  useEffect(() => {
    if (isReturning && hasCachedData) {
      sessionStorage.removeItem('returning_from_post');
      const savedScroll = sessionStorage.getItem('feed_scroll');
      if (savedScroll) pendingScrollRef.current = parseInt(savedScroll, 10);
      // Silently revalidate in the background
      fetchPosts(stateRef.current.page, stateRef.current.catFilter, stateRef.current.useRec, true);
      return;
    }
    // Fresh visit — check if we have cache from prefetch
    const key = feedCacheKey(catFilter, useRec);
    const prefetched = cache.get(key);
    if (prefetched && !prefetched.stale) {
      setPosts(prefetched.data.posts || []);
      setPage(prefetched.data.page || 1);
      setHasMore(prefetched.data.hasMore ?? true);
      setFetching(false);
      // Still revalidate silently
      fetchPosts(1, catFilter, useRec, true);
      return;
    }
    fetchPosts(1, catFilter, useRec);
  }, []); // eslint-disable-line

  // Filter/mode changes (skip on initial mount — handled above)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    // Check cache for the new filter
    const key = feedCacheKey(catFilter, useRec);
    const hit = cache.get(key);
    if (hit) {
      setPosts(hit.data.posts || []);
      setHasMore(hit.data.hasMore ?? true);
      setFetching(false);
      // Revalidate silently
      fetchPosts(1, catFilter, useRec, true);
    } else {
      fetchPosts(1, catFilter, useRec);
    }
  }, [catFilter, useRec]); // eslint-disable-line

  // Scroll restoration: fires AFTER posts are rendered into the DOM.
  // Double-rAF ensures the browser has finished layout and paint before scrolling.
  useEffect(() => {
    if (pendingScrollRef.current !== null && posts.length > 0) {
      const target = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: target, behavior: 'instant' });
        });
      });
    }
  }, [posts]);

  // Continuously track scroll position + save to cache on unmount
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('feed_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save current state to cache
      const s = stateRef.current;
      const key = feedCacheKey(s.catFilter, s.useRec);
      cache.set(key, s, 'feed');
      // Also save filter state for return-visit key lookup
      sessionStorage.setItem('feed_catFilter', s.catFilter);
      sessionStorage.setItem('feed_useRec', String(s.useRec));
    };
  }, []);

  // ── Early returns (AFTER all hooks — Rules of Hooks satisfied) ───────────────
  if (isPrerender) {
    return (
      <div>
        <h1>OurGuided — Where Real People Share Real Things</h1>
        <p>No jargon, no courses, no fake professionalism. Just honest knowledge, opinions, life hacks, and truths — shared freely by students, professionals, and everyday people.</p>
      </div>
    );
  }

  if (!user) return null;

  // ── Engagement tracker ──────────────────────────────────────────────────────
  const { registerPost, registerVideo, unregisterPost } = useEngagementTracker();

  // Track locally hidden (reported) posts
  const [hiddenPostIds, setHiddenPostIds] = useState(new Set());
  const handleReport = useCallback((postId) => {
    setHiddenPostIds(prev => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  // Filter out hidden posts
  const visiblePosts = posts.filter(p => !hiddenPostIds.has(p.post_id));

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDelete = (postId) => setPosts(prev => prev.filter(p => p.post_id !== postId));

  return (
    <div className="feed-container">

      <CreatePost onPostCreated={() => { setPage(1); fetchPosts(1, catFilter, useRec); }} />

      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          className={`media-btn ${useRec && !catFilter ? 'selected' : ''}`}
          onClick={() => { setCatFilter(''); setUseRec(true); }}
          title="Personalised recommendations"
        >
          <FiZap size={13} /> For You
        </button>
        <button
          className={`media-btn ${!useRec && !catFilter ? 'selected' : ''}`}
          onClick={() => { setCatFilter(''); setUseRec(false); }}
          title="Chronological feed"
        >
          Latest
        </button>
      </div>

      {/* Category filter strip */}
      <div className="feed-filter-strip">
        {CATEGORIES.slice(0, 6).map(c => (
          <button key={c}
            className={`media-btn ${catFilter === c ? 'selected' : ''}`}
            onClick={() => { setCatFilter(catFilter === c ? '' : c); setUseRec(false); }}>
            {c}
          </button>
        ))}
      </div>

      {fetching && posts.length === 0 ? (
        <SkelFeed />
      ) : error && posts.length === 0 ? (
        <div className="empty-state">
          <FiZap size={24} style={{ color: 'var(--danger)', marginBottom: '0.5rem' }} />
          <h3>Connection issues</h3>
          <p>We couldn't reach the server. Please check your connection.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchPosts(1, catFilter, useRec)} style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        <>
          {visiblePosts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onDelete={handleDelete}
              onReport={handleReport}
              postRef={registerPost}
              videoRef={registerVideo}
            />
          ))}
          {hasMore && (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => { const next = page + 1; setPage(next); fetchPosts(next, catFilter, useRec); }}
              disabled={fetching}
            >
              {fetching ? 'Loading more…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {/* ── Nika AMV — floating image button ── */}
      <div
        className="nika-video-btn"
        onClick={openNikaVideo}
        title="Song of Liberation — The Awakening of Nika"
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNikaVideo(); } }}
      >
        <img src="/song_button.png" alt="Song of Liberation" draggable={false} />
      </div>

      {/* ── Fullscreen video overlay ── */}
      {showNikaVideo && (
        <div className={`nika-video-overlay${nikaClosing ? ' closing' : ''}`}>
          <button
            className="nika-video-close"
            onClick={closeNikaVideo}
            title="Close video"
            aria-label="Close video"
          >
            <FiX size={20} />
          </button>
          <video
            ref={videoRef}
            src="https://ourguided-media.s3.us-east-1.amazonaws.com/songs/song_of_liberation.webm"
            autoPlay
            playsInline
            preload="auto"
          />
        </div>
      )}
    </div>
  );
};

export default Feed;
