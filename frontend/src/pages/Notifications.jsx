import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import { FiBell, FiMail, FiMessageSquare, FiShield, FiStar, FiZap, FiBook, FiTrash2, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Toggle = ({ checked, onChange }) => (
  <button className={`toggle ${checked ? 'on' : 'off'}`} onClick={() => onChange(!checked)}
    role="switch" aria-checked={checked} />
);

const Notifications = () => {
  const [settings, setSettings]         = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [activeTab, setActiveTab]       = useState('settings');

  const fetchNotifications = async (p = 1, append = false) => {
    try {
      const { data } = await API.get(`/notifications?page=${p}`);
      const list = data.notifications || [];
      setNotifications(prev => append ? [...prev, ...list] : list);
      setTotal(data.total || 0);
      setHasMore(data.has_more || false);
    } catch { toast.error('Failed to load notifications'); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes] = await Promise.all([API.get('/notifications/settings')]);
        setSettings(sRes.data);
        await fetchNotifications(1);
      } catch { toast.error('Failed to load'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    await fetchNotifications(next, true);
  };

  const markAllRead = async () => {
    try {
      await API.post('/notifications/mark-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const deleteOne = async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      setTotal(prev => prev - 1);
    } catch { toast.error('Failed to delete'); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await API.put('/notifications/settings', settings);
      toast.success('Settings saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  if (loading) return <div className="feed-container"><div className="loading-screen" style={{ height: '50vh' }}><div className="spinner" /></div></div>;

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2>Notifications & Privacy</h2>
        <p>Control how and when you receive updates</p>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
        <button className={`tab ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
          Inbox {unread > 0 && <span className="notif-badge">{unread}</span>}
        </button>
      </div>

      {activeTab === 'settings' && settings && (
        <>
          {/* Delivery Channels */}
          <div className="info-card">
            <h3>Delivery Channels</h3>
            <div className="settings-rows">
              <div className="settings-row">
                <div className="settings-row-info">
                  <FiMail />
                  <div><strong>Email Notifications</strong><p>Learning reminders and updates by email</p></div>
                </div>
                <Toggle checked={!!settings.notify_email} onChange={v => set('notify_email', v)} />
              </div>

              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="settings-row-info">
                    <FiMessageSquare />
                    <div><strong>WhatsApp Notifications</strong><p>Streak reminders via WhatsApp</p></div>
                  </div>
                  <Toggle checked={!!settings.notify_whatsapp} onChange={v => set('notify_whatsapp', v)} />
                </div>
                {settings.notify_whatsapp && (
                  <div className="form-group" style={{ marginBottom: 0, width: '100%', paddingLeft: '1.75rem' }}>
                    <label>WhatsApp Number (with country code)</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={settings.whatsapp_number || ''}
                      onChange={e => set('whatsapp_number', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div className="info-card">
            <h3>Notification Types</h3>
            <div className="settings-rows">
              {[
                { key: 'notify_new_skills', icon: <FiBook />, title: 'New Skills & Content', desc: 'Alert when new learning content is posted' },
                { key: 'notify_quizzes',    icon: <FiStar />, title: 'Quiz Releases',        desc: 'Alert when new quizzes are published' },
                { key: 'notify_streaks',    icon: <FiZap />,  title: 'Streak Reminders',     desc: 'Remind me to maintain my learning streak' },
              ].map(({ key, icon, title, desc }) => (
                <div key={key} className="settings-row">
                  <div className="settings-row-info">
                    {icon}
                    <div><strong>{title}</strong><p>{desc}</p></div>
                  </div>
                  <Toggle checked={!!settings[key]} onChange={v => set(key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="info-card">
            <h3>Privacy</h3>
            <div className="settings-rows">
              <div className="settings-row">
                <div className="settings-row-info">
                  <FiShield />
                  <div><strong>Private Account</strong><p>Only connections can see your full profile</p></div>
                </div>
                <Toggle checked={!!settings.is_private} onChange={v => set('is_private', v)} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </>
      )}

      {activeTab === 'inbox' && (
        <div>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text3)', alignSelf: 'center', fontFamily: 'Space Mono, monospace' }}>{total} total</span>
              <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark all read</button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="empty-state">
              <FiBell size={36} style={{ opacity: 0.25, marginBottom: '1rem' }} />
              <h3>No notifications</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.map(n => (
                  <div key={n.notification_id} className={`notif-row ${n.is_read ? 'read' : 'unread'}`}>
                    <div className="notif-dot" />
                    <div className="notif-content">
                      <strong>{n.title}</strong>
                      {n.message && <p>{n.message}</p>}
                      <span className="notif-time">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <button
                      onClick={() => deleteOne(n.notification_id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
                      title="Delete"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {hasMore && (
                <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={loadMore}>
                  <FiChevronDown size={14} /> Load more
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;