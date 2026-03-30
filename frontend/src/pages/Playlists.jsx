import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiX, FiLock, FiGlobe } from 'react-icons/fi';
import PostCard from '../components/PostCard.jsx';
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
/* ── Create Playlist Modal ── */
const CreateModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', description: '', is_public: true });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setLoading(true);
    try {
      await API.post('/playlists', form);
      toast.success('Playlist created!');
      onCreated();
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>New Playlist</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
        </div>
        <div className="form-group">
          <label>Title *</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Money Management" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} rows={2} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What's this playlist about?" />
        </div>
        <div className="form-group">
          <label>Visibility</label>
          <select value={form.is_public ? 'public' : 'private'} onChange={e => setForm({ ...form, is_public: e.target.value === 'public' })}>
            <option value="public">Public — anyone can view</option>
            <option value="private">Private — only you</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creating…' : 'Create Playlist'}
        </button>
      </div>
    </div>
  );
};

/* ── Playlist Detail View ── */
const PlaylistDetail = ({ playlist, onBack, onUpdated }) => {
  const [posts, setPosts] = useState(playlist.items || []);

  const removePost = async (postId) => {
    try {
      await API.delete(`/playlists/${playlist.playlist_id}/remove/${postId}`);
      setPosts(prev => prev.filter(p => p.post_id !== postId));
      toast.success('Removed from playlist');
      onUpdated();
    } catch { toast.error('Failed to remove'); }
  };

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>← Back</button>
      <div className="info-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.3rem' }}>{playlist.title}</h2>
            {playlist.description && <p style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>{playlist.description}</p>}
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text3)' }}>
            {playlist.is_public ? <><FiGlobe size={12} /> Public</> : <><FiLock size={12} /> Private</>}
          </span>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>
          {posts.length} post{posts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
          <p>Save any post to this playlist using the ⋯ menu on a post card.</p>
        </div>
      ) : (
        posts.map(p => (
          <div key={p.post_id} style={{ position: 'relative' }}>
            <PostCard post={p} onDelete={() => removePost(p.post_id)} />
          </div>
        ))
      )}
    </div>
  );
};

/* ── Main Playlists Page ── */
const Playlists = () => {
  const [playlists, setPlaylists]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [active, setActive]         = useState(null); // selected playlist detail

  const fetchPlaylists = async () => {
    try {
      const { data } = await API.get('/playlists');
      setPlaylists(data);
    } catch { toast.error('Failed to load playlists'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPlaylists(); }, []);

  const openPlaylist = async (pl) => {
    try {
      const { data } = await API.get(`/playlists/${pl.playlist_id}`);
      setActive(data);
    } catch { toast.error('Failed to open playlist'); }
  };

  const deletePlaylist = async (id) => {
    if (!window.confirm('Delete this playlist?')) return;
    try {
      await API.delete(`/playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.playlist_id !== id));
      toast.success('Playlist deleted');
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return (
    <div className="feed-container">
      <div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div>
    </div>
  );

  if (active) return (
    <div className="feed-container">
      <PlaylistDetail
        playlist={active}
        onBack={() => setActive(null)}
        onUpdated={fetchPlaylists}
      />
    </div>
  );

  return (
    <div className="feed-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2>Playlists</h2>
          <p>Organise posts into learning sequences</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <FiPlus /> New Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-state">
          <h3>No playlists yet</h3>
          <p>Create a playlist to organise posts into a learning path.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto' }} onClick={() => setShowCreate(true)}>
            <FiPlus /> Create your first playlist
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {playlists.map(pl => (
            <div key={pl.playlist_id} className="playlist-card" onClick={() => openPlaylist(pl)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{pl.title}</h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                    {pl.is_public ? <FiGlobe size={11} /> : <FiLock size={11} />}
                  </span>
                </div>
                {pl.description && <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '0.3rem' }}>{pl.description}</p>}
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>
                  {pl.item_count} post{pl.item_count !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); deletePlaylist(pl.playlist_id); }}
                title="Delete playlist"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchPlaylists} />}
    </div>
  );
};

export default Playlists;
