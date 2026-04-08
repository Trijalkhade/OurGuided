import React from 'react';

/* ── Base shimmer block ─────────────────────────────────────────── */
export const Skel = ({ w = '100%', h = 16, r = 8, style = {} }) => (
  <div
    className="skeleton"
    style={{ width: w, height: h, borderRadius: r, ...style }}
  />
);

/* ── Avatar circle ──────────────────────────────────────────────── */
export const SkelAvatar = ({ size = 40 }) => (
  <div
    className="skeleton"
    style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
  />
);

/* ── Post card skeleton ─────────────────────────────────────────── */
export const SkelPostCard = () => (
  <div className="post-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.72rem' }}>
      <SkelAvatar size={40} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skel w="35%" h={13} />
        <Skel w="20%" h={11} />
      </div>
    </div>
    <Skel h={13} />
    <Skel h={13} w="90%" />
    <Skel h={13} w="75%" />
    <Skel h={180} r={12} />
    <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
      <Skel w={64} h={28} r={8} />
      <Skel w={64} h={28} r={8} />
    </div>
  </div>
);

/* ── Feed skeleton (3 post cards) ──────────────────────────────── */
export const SkelFeed = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    {[0, 1, 2].map(i => <SkelPostCard key={i} />)}
  </div>
);

/* ── Profile header skeleton ────────────────────────────────────── */
export const SkelProfile = () => (
  <div className="profile-container">
    <div className="profile-header-card">
      <div className="skeleton" style={{ height: 80, borderRadius: '14px 14px 0 0' }} />
      <div className="profile-top" style={{ paddingTop: '1rem' }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0, marginTop: -40 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skel w="40%" h={20} />
          <Skel w="25%" h={13} />
          <Skel w="70%" h={13} />
        </div>
        <Skel w={72} h={32} r={8} />
      </div>
      <div className="profile-stats" style={{ marginTop: '1rem' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stat" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <Skel w={32} h={20} r={6} />
            <Skel w={44} h={11} r={6} />
          </div>
        ))}
      </div>
    </div>
    <div className="tabs" style={{ margin: '1.25rem 0 1rem' }}>
      {[0, 1, 2].map(i => <Skel key={i} w={80} h={34} r={8} style={{ display: 'inline-block' }} />)}
    </div>
    <SkelPostCard />
    <div style={{ marginTop: '1rem' }}><SkelPostCard /></div>
  </div>
);

/* ── Connection card skeleton ───────────────────────────────────── */
export const SkelConnectionCard = () => (
  <div className="connection-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <SkelAvatar size={50} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Skel w="50%" h={14} />
      <Skel w="30%" h={11} />
      <Skel w="80%" h={11} />
    </div>
    <Skel w={72} h={30} r={8} />
  </div>
);

/* ── Connections page skeleton ──────────────────────────────────── */
export const SkelConnections = () => (
  <div className="feed-container">
    <div className="page-header">
      <Skel w="30%" h={24} />
      <Skel w="50%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="tabs" style={{ marginBottom: '1rem' }}>
      <Skel w={130} h={34} r={8} />
      <Skel w={100} h={34} r={8} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[0, 1, 2, 3, 4].map(i => <SkelConnectionCard key={i} />)}
    </div>
  </div>
);

/* ── Leaderboard row skeleton ───────────────────────────────────── */
export const SkelLbRow = () => (
  <div className="lb-row" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
    <Skel w={28} h={22} r={6} />
    <SkelAvatar size={42} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skel w="45%" h={14} />
      <Skel w="28%" h={11} />
    </div>
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <Skel w={36} h={18} r={5} />
        <Skel w={24} h={10} r={4} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <Skel w={28} h={18} r={5} />
        <Skel w={30} h={10} r={4} />
      </div>
    </div>
  </div>
);

/* ── Leaderboard skeleton ───────────────────────────────────────── */
export const SkelLeaderboard = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="40%" h={24} />
      <Skel w="55%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <SkelLbRow key={i} />)}
    </div>
  </div>
);

/* ── Notification row skeleton ──────────────────────────────────── */
export const SkelNotifRow = () => (
  <div className="notif-row read" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
    <div className="notif-dot" style={{ background: 'var(--border)', flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skel w="55%" h={13} />
      <Skel w="80%" h={11} />
      <Skel w="25%" h={10} />
    </div>
  </div>
);

/* ── Notifications skeleton ─────────────────────────────────────── */
export const SkelNotifications = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="50%" h={24} />
      <Skel w="60%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="tabs" style={{ marginBottom: '1rem' }}>
      <Skel w={90} h={34} r={8} />
      <Skel w={80} h={34} r={8} />
    </div>
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[0, 1, 2, 3, 4].map(i => <SkelNotifRow key={i} />)}
    </div>
  </div>
);

/* ── Playlist card skeleton ─────────────────────────────────────── */
export const SkelPlaylistCard = () => (
  <div className="playlist-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Skel w="50%" h={15} />
      <Skel w="75%" h={11} />
      <Skel w="25%" h={10} />
    </div>
    <Skel w={28} h={28} r={6} />
  </div>
);

/* ── Playlists skeleton ─────────────────────────────────────────── */
export const SkelPlaylists = () => (
  <div className="feed-container">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skel w={120} h={24} />
        <Skel w={200} h={13} />
      </div>
      <Skel w={100} h={32} r={8} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[0, 1, 2, 3].map(i => <SkelPlaylistCard key={i} />)}
    </div>
  </div>
);

/* ── Moderation card skeleton ───────────────────────────────────── */
export const SkelModCard = () => (
  <div className="mod-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <SkelAvatar size={36} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skel w="35%" h={13} />
        <Skel w="50%" h={11} />
      </div>
    </div>
    <Skel h={13} />
    <Skel h={13} w="85%" />
    <Skel h={160} r={10} />
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <Skel h={34} r={8} />
      <Skel h={34} r={8} />
    </div>
  </div>
);

/* ── Moderation queue skeleton ──────────────────────────────────── */
export const SkelModeration = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="45%" h={24} />
      <Skel w="40%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[0, 1, 2].map(i => <SkelModCard key={i} />)}
    </div>
  </div>
);

/* ── PostDetail skeleton ────────────────────────────────────────── */
export const SkelPostDetail = () => (
  <div className="feed-container">
    <div className="post-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.72rem' }}>
        <SkelAvatar size={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skel w="30%" h={13} />
          <Skel w="20%" h={11} />
        </div>
      </div>
      <Skel h={13} />
      <Skel h={13} w="90%" />
      <Skel h={13} w="80%" />
      <Skel h={13} w="60%" />
      <Skel h={260} r={12} />
      <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
        <Skel w={64} h={28} r={8} />
        <Skel w={64} h={28} r={8} />
      </div>
    </div>
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Skel w="20%" h={16} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.72rem' }}>
          <SkelAvatar size={36} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skel w="30%" h={12} />
            <Skel h={12} />
            <Skel w="70%" h={12} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Explore page skeleton ──────────────────────────────────────── */
export const SkelExplore = () => (
  <div className="explore-page">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="30%" h={24} />
      <Skel w="60%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="category-grid" style={{ marginBottom: '1.5rem' }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />
      ))}
    </div>
    <div className="interest-card" style={{ marginBottom: '1.5rem' }}>
      <Skel h={16} w="30%" style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {[0, 1, 2, 3, 4, 5].map(i => <Skel key={i} w={90} h={30} r={20} />)}
      </div>
    </div>
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[0, 1].map(i => <SkelPostCard key={i} />)}
    </div>
  </div>
);

/* ── Quizzes skeleton ───────────────────────────────────────────── */
export const SkelQuizCard = () => (
  <div className="quiz-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skel w="55%" h={16} />
      <Skel w={60} h={22} r={12} />
    </div>
    <Skel h={12} w="80%" />
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Skel w={70} h={22} r={20} />
      <Skel w={80} h={22} r={20} />
    </div>
    <Skel h={34} r={8} />
  </div>
);

export const SkelQuizzes = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="30%" h={24} />
      <Skel w="55%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="tabs" style={{ marginBottom: '1rem' }}>
      {[0, 1, 2].map(i => <Skel key={i} w={90} h={34} r={8} />)}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {[0, 1, 2, 3].map(i => <SkelQuizCard key={i} />)}
    </div>
  </div>
);

/* ── Study page skeleton ────────────────────────────────────────── */
export const SkelStudy = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="35%" h={24} />
      <Skel w="50%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
      <Skel w="40%" h={16} />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Skel w={160} h={160} r="50%" />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Skel h={40} r={8} />
        <Skel h={40} r={8} />
      </div>
    </div>
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Skel w="30%" h={16} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skel w="40%" h={13} />
          <Skel w="20%" h={13} />
        </div>
      ))}
    </div>
  </div>
);

/* ── Watchlist skeleton ─────────────────────────────────────────── */
export const SkelWatchlist = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="30%" h={24} />
      <Skel w="45%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[0, 1, 2].map(i => <SkelPostCard key={i} />)}
    </div>
  </div>
);

/* ── EditProfile skeleton ───────────────────────────────────────── */
export const SkelEditProfile = () => (
  <div className="feed-container">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <Skel w="35%" h={24} />
      <Skel w="55%" h={13} style={{ marginTop: 6 }} />
    </div>
    <div className="tabs" style={{ marginBottom: '1.25rem' }}>
      {[0, 1, 2, 3].map(i => <Skel key={i} w={80} h={34} r={8} />)}
    </div>
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skel w="25%" h={11} />
          <Skel h={42} r={10} />
        </div>
      ))}
      <Skel h={38} r={10} />
    </div>
  </div>
);
