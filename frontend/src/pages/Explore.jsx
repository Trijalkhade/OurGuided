import React, { useState, useEffect, useRef } from 'react';
import { API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import toast from 'react-hot-toast';
import { SkelExplore, SkelFeed } from '../components/Skeleton.jsx';
import * as cache from '../utils/cache';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const Explore = () => {
  // ── Refs (ALL before any early return) ──────────────────────────────────────
  const stateRef         = useRef();
  const pendingScrollRef = useRef(null);

  // Check for return visit
  const isReturning = useRef(
    sessionStorage.getItem('returning_from_post') === 'true'
  ).current;

  // Try to restore categories from cache
  const cachedCats = useRef(cache.get('explore:categories')).current;
  const cachedRec  = useRef(cache.get('explore:recommended')).current;
  const cachedInterests = useRef(cache.get('explore:interests')).current;
  const cachedTab  = useRef(isReturning ? sessionStorage.getItem('explore_activeTab') : null).current;
  const cachedSelected = useRef(isReturning ? sessionStorage.getItem('explore_selected') : null).current;

  // For category tab on return, try to get cached category posts
  const cachedCatPosts = useRef(
    cachedSelected ? cache.get(`explore:category:${cachedSelected}`) : null
  ).current;

  const hasCategories = cachedCats !== null;
  const hasPosts = cachedTab === 'category' && cachedCatPosts
    ? true
    : cachedRec !== null;

  // ── State (ALL before any early return) ─────────────────────────────────────
  const [categories,      setCategories]      = useState(hasCategories ? cachedCats.data : []);
  const [selected,        setSelected]        = useState(cachedSelected || null);
  const [posts,           setPosts]           = useState(
    cachedTab === 'category' && cachedCatPosts
      ? cachedCatPosts.data
      : cachedRec ? (cachedRec.data.posts || cachedRec.data) : []
  );
  const [interests,       setInterests]       = useState(cachedInterests ? cachedInterests.data : []);
  const [loadingCats,     setLoadingCats]     = useState(!hasCategories);
  const [loadingPosts,    setLoadingPosts]    = useState(false);
  const [errorCats,       setErrorCats]       = useState(false);
  const [errorPosts,      setErrorPosts]      = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [activeTab,       setActiveTab]       = useState(cachedTab || 'recommended');

  stateRef.current = { categories, selected, posts, interests, activeTab };

  // ── Functions (defined before effects that call them) ────────────────────────
  const load = async (silent = false) => {
    if (!silent) { setLoadingCats(true); setErrorCats(false); }
    try {
      const [catRes, recRes] = await Promise.all([
        API.get('/categories'),
        API.get('/categories/recommended'),
      ]);
      setCategories(catRes.data);
      cache.set('explore:categories', catRes.data, 'explore_categories');

      const recPosts = recRes.data.posts || [];
      const recInterests = (recRes.data.interests || []).map(n => {
        const cat = catRes.data.find(c => c.name === n);
        return cat ? cat.category_id : null;
      }).filter(Boolean);

      setPosts(recPosts);
      setInterests(recInterests);
      cache.set('explore:recommended', recRes.data, 'explore_recommended');
      cache.set('explore:interests', recInterests, 'explore_recommended');
    } catch {
      if (!silent) { setErrorCats(true); toast.error('Failed to load explore'); }
    } finally {
      setLoadingCats(false);
    }
  };

  const loadCategory = async (catName, silent = false) => {
    setSelected(catName);
    setActiveTab('category');
    if (!silent) { setLoadingPosts(true); setErrorPosts(false); }

    // Show cached category posts instantly if available
    const catHit = cache.get(`explore:category:${catName}`);
    if (catHit && !silent) {
      setPosts(catHit.data);
      setLoadingPosts(false);
    }

    try {
      const { data } = await API.get(`/posts/feed?category=${encodeURIComponent(catName)}`);
      setPosts(data);
      cache.set(`explore:category:${catName}`, data, 'explore_category');
    } catch {
      if (!silent) { setErrorPosts(true); toast.error('Failed to load category'); }
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadRecommended = async (silent = false) => {
    setSelected(null);
    setActiveTab('recommended');
    if (!silent) { setLoadingPosts(true); setErrorPosts(false); }
    try {
      const { data } = await API.get('/categories/recommended');
      setPosts(data.posts || []);
      cache.set('explore:recommended', data, 'explore_recommended');
    } catch {
      if (!silent) { setErrorPosts(true); toast.error('Failed to load recommendations'); }
    } finally {
      setLoadingPosts(false);
    }
  };

  const toggleInterest = (catId) => {
    setInterests(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  const saveInterests = async () => {
    setSavingInterests(true);
    try {
      await API.post('/categories/interests', { category_ids: interests });
      toast.success('Interests updated! Recommendations refreshed.');
      cache.invalidate('explore:recommended');
      await loadRecommended();
    } catch { toast.error('Failed to save interests'); }
    finally { setSavingInterests(false); }
  };

  // ── Effects (ALL before any early return) ───────────────────────────────────

  // Mount: restore from cache or fresh load
  useEffect(() => {
    if (isReturning) {
      sessionStorage.removeItem('returning_from_post');
      const savedScroll = sessionStorage.getItem('explore_scroll');
      if (savedScroll) pendingScrollRef.current = parseInt(savedScroll, 10);
      // Silently revalidate
      if (hasCategories) load(true);
      return;
    }
    // Fresh visit — if we have cached categories, show them instantly
    if (hasCategories && hasPosts) {
      setLoadingCats(false);
      // Silently revalidate
      load(true);
      return;
    }
    load();
  }, []); // eslint-disable-line

  // Scroll restoration: fires AFTER posts are rendered into the DOM.
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
      sessionStorage.setItem('explore_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save active tab and selected category for return visit
      const s = stateRef.current;
      sessionStorage.setItem('explore_activeTab', s.activeTab);
      if (s.selected) sessionStorage.setItem('explore_selected', s.selected);
      else sessionStorage.removeItem('explore_selected');
    };
  }, []);

  // ── Early returns (AFTER all hooks — Rules of Hooks satisfied) ───────────────
  if (isPrerender) {
    return (
      <div>
        <h1>Explore What Actually Matters on OurGuided</h1>
        <p>Real talk, life hacks, loopholes, experiments, and honest opinions — shared by real people, for real people.</p>
      </div>
    );
  }

  if (loadingCats) return <SkelExplore />;

  if (errorCats) return (
    <div className="explore-page">
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <h3>Failed to load Explore</h3>
        <p>Something went wrong while fetching categories.</p>
        <button className="btn btn-primary" onClick={() => load()} style={{ width: 'auto', marginTop: '1rem' }}>
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="explore-page">
      <div className="page-header">
        <h2>Explore</h2>
        <p>Browse what people are talking about — pick what matters to you</p>
      </div>

      {/* Category Grid */}
      <div className="category-grid">
        {categories.map(cat => (
          <button
            key={cat.category_id}
            className={`category-card ${selected === cat.name ? 'active' : ''}`}
            onClick={() => loadCategory(cat.name)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.name}</span>
            <span className="cat-count">{cat.post_count} posts · {cat.quiz_count} quizzes</span>
          </button>
        ))}
      </div>

      {/* Interest Selector */}
      <div className="interest-card">
        <div className="interest-card-header">
          <div>
            <h3>What do you care about?</h3>
            <p>Pick what matters to you — your feed will follow</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveInterests} disabled={savingInterests}>
            {savingInterests ? 'Saving…' : 'Save Interests'}
          </button>
        </div>
        <div className="interest-chips">
          {categories.map(cat => (
            <button
              key={cat.category_id}
              className={`interest-chip ${interests.includes(cat.category_id) ? 'selected' : ''}`}
              onClick={() => toggleInterest(cat.category_id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'recommended' ? 'active' : ''}`} onClick={() => loadRecommended()}>
          ✨ Recommended
        </button>
        {selected && (
          <button className={`tab ${activeTab === 'category' ? 'active' : ''}`}>
            {(categories.find(c => c.name === selected) || {}).icon} {selected}
          </button>
        )}
      </div>

      {/* Posts */}
      {loadingPosts ? (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <SkelFeed />
        </div>
      ) : errorPosts ? (
        <div className="empty-state">
          <h3>Failed to load category</h3>
          <p>Please try again.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing here yet</h3>
          <p>Be the first to say something real in this space.</p>
        </div>
      ) : (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {posts.map(post => <PostCard key={post.post_id} post={post} />)}
        </div>
      )}
    </div>
  );
};

export default Explore;
