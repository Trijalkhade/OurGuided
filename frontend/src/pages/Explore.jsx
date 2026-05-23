import React, { useState, useEffect, useRef } from 'react';
import { API } from '../context/AuthContext';
import PostCard from '../components/PostCard.jsx';
import toast from 'react-hot-toast';
import { SkelExplore, SkelFeed } from '../components/Skeleton.jsx';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

// ── Module-level in-memory cache (no sessionStorage quota risk) ───────────────
let exploreCache = null;

const Explore = () => {
  // ── Refs (ALL before any early return) ──────────────────────────────────────
  const stateRef         = useRef();
  const pendingScrollRef = useRef(null);

  // Determine return-visit once at mount.
  const isReturnVisit = useRef(
    sessionStorage.getItem('returning_from_post') === 'true' && exploreCache !== null
  ).current;

  // ── State (ALL before any early return) ─────────────────────────────────────
  const [categories,      setCategories]      = useState(isReturnVisit ? exploreCache.categories : []);
  const [selected,        setSelected]        = useState(isReturnVisit ? exploreCache.selected   : null);
  const [posts,           setPosts]           = useState(isReturnVisit ? exploreCache.posts      : []);
  const [interests,       setInterests]       = useState(isReturnVisit ? exploreCache.interests  : []);
  const [loadingCats,     setLoadingCats]     = useState(!isReturnVisit);
  const [loadingPosts,    setLoadingPosts]    = useState(false);
  const [errorCats,       setErrorCats]       = useState(false);
  const [errorPosts,      setErrorPosts]      = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [activeTab,       setActiveTab]       = useState(isReturnVisit ? exploreCache.activeTab : 'recommended');

  stateRef.current = { categories, selected, posts, interests, activeTab };

  // ── Functions (defined before effects that call them) ────────────────────────
  const load = async () => {
    setLoadingCats(true);
    setErrorCats(false);
    try {
      const [catRes, recRes] = await Promise.all([
        API.get('/categories'),
        API.get('/categories/recommended'),
      ]);
      setCategories(catRes.data);
      setPosts(recRes.data.posts || []);
      setInterests((recRes.data.interests || []).map(n => {
        const cat = catRes.data.find(c => c.name === n);
        return cat ? cat.category_id : null;
      }).filter(Boolean));
    } catch {
      setErrorCats(true);
      toast.error('Failed to load explore');
    } finally {
      setLoadingCats(false);
    }
  };

  const loadCategory = async (catName) => {
    setSelected(catName);
    setActiveTab('category');
    setLoadingPosts(true);
    setErrorPosts(false);
    try {
      const { data } = await API.get(`/posts/feed?category=${encodeURIComponent(catName)}`);
      setPosts(data);
    } catch {
      setErrorPosts(true);
      toast.error('Failed to load category');
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadRecommended = async () => {
    setSelected(null);
    setActiveTab('recommended');
    setLoadingPosts(true);
    setErrorPosts(false);
    try {
      const { data } = await API.get('/categories/recommended');
      setPosts(data.posts || []);
    } catch {
      setErrorPosts(true);
      toast.error('Failed to load recommendations');
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
      await loadRecommended();
    } catch { toast.error('Failed to save interests'); }
    finally { setSavingInterests(false); }
  };

  // ── Effects (ALL before any early return) ───────────────────────────────────

  // Mount: restore from cache or fresh load
  useEffect(() => {
    if (isReturnVisit) {
      sessionStorage.removeItem('returning_from_post');
      const savedScroll = sessionStorage.getItem('explore_scroll');
      if (savedScroll) pendingScrollRef.current = parseInt(savedScroll, 10);
      return; // Posts already in state from cache; [posts] effect will scroll
    }
    exploreCache = null; // clear stale cache on fresh visit
    load();
  }, []); // eslint-disable-line

  // Scroll restoration: fires AFTER posts are rendered into the DOM.
  // Double-rAF ensures the browser has finished layout and paint.
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

  // Continuously track scroll position + save to in-memory cache on unmount
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('explore_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save to in-memory module cache (no sessionStorage quota risk)
      exploreCache = stateRef.current;
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
        <button className="btn btn-primary" onClick={load} style={{ width: 'auto', marginTop: '1rem' }}>
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
        <button className={`tab ${activeTab === 'recommended' ? 'active' : ''}`} onClick={loadRecommended}>
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
