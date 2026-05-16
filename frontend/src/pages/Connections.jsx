import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useFeedback from '../utils/useFeedback';
import { SkelConnections } from '../components/Skeleton.jsx';
import AvatarWithFallback from '../components/Avatar.jsx';

const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";
const Connections = () => {
  const [connections, setConnections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('connections');
  const [loading, setLoading] = useState(true);
  const { onTap, onSuccess, onError, onAcceptConnection, onDeleteSuccess } = useFeedback();

  // 🚀 SEO CONTENT FOR GOOGLE
  if (isPrerender) {
    return (
      <div>
        <h1>Connect with Learners</h1>
        <p>Build connections with people learning and sharing real-world skills.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchConnections();

    const onUpdated = () => fetchConnections();
    window.addEventListener('connectionsUpdated', onUpdated);
    return () => window.removeEventListener('connectionsUpdated', onUpdated);
  }, []);

  const fetchConnections = async () => {
    try {
      const [connRes, reqRes] = await Promise.all([
        API.get('/connections/my-connections'),
        API.get('/connections/requests')
      ]);
      setConnections(connRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (connectionId) => {
    onTap();
    try {
      const res = await API.post(`/connections/accept/${connectionId}`);
      onAcceptConnection(); // Beep + chime on accept
      toast.success('Connection accepted');

      // If backend returned the new connection and user info, update UI immediately
      const { connection, user } = res.data || {};
      if (connection && user) {
        const newConn = {
          connection_id: connection.connection_id,
          connected_user_id: user.user_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          photo: user.photo,
          bio: user.bio
        };
        setConnections(prev => [newConn, ...prev]);
        setRequests(prev => prev.filter(r => r.connection_id !== connectionId));
        setActiveTab('connections');
        // notify other components/pages to refresh their connections list
        window.dispatchEvent(new Event('connectionsUpdated'));
        return;
      }

      // fallback: refetch lists
      fetchConnections();
      window.dispatchEvent(new Event('connectionsUpdated'));
    } catch (err) {
      onError();
      const errorMsg = err.response?.data?.message || 'Failed to accept request';
      console.error('Accept connection error:', err);
      toast.error(`Error: ${errorMsg}`);
    }
  };

  const handleReject = async (connectionId) => {
    onTap();
    try {
      await API.delete(`/connections/reject/${connectionId}`);
      onDeleteSuccess(); // Scrape sound for reject
      toast.success('Request rejected');
      fetchConnections();
      window.dispatchEvent(new Event('connectionsUpdated'));
    } catch (err) {
      onError();
      toast.error('Failed to reject request');
    }
  };

  const handleRemove = async (userId) => {
    if (window.confirm('Remove this connection?')) {
      onTap();
      try {
        await API.delete(`/connections/remove/${userId}`);
        onDeleteSuccess(); // Scrape sound for remove
        toast.success('Connection removed');
        fetchConnections();
        window.dispatchEvent(new Event('connectionsUpdated'));
      } catch (err) {
        onError();
        toast.error('Failed to remove connection');
      }
    }
  };

  if (loading) return <SkelConnections />;

  return (
    <div className="feed-container">
      <div className="page-header">
        <h2>Connections</h2>
        <p>Manage your network and connections</p>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          Connections ({connections.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({requests.length})
        </button>
      </div>

      {activeTab === 'connections' && (
        <div className="connections-list">
          {connections.length === 0 ? (
            <div className="empty-state">
              <h3>No connections yet</h3>
              <p>Start connecting with other users to build your network</p>
            </div>
          ) : (
            connections.map(conn => (
              <div key={conn.connection_id} className="connection-card">
                <Link to={`/profile/${conn.connected_user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none', color: 'inherit' }}>
                  <AvatarWithFallback 
                    photo={conn.photo} 
                    username={conn.first_name || conn.username} 
                    style={{ width: 50, height: 50, fontSize: '1.2rem', flexShrink: 0 }} 
                  />
                  <div className="connection-info">
                    <h4>{conn.first_name} {conn.last_name}</h4>
                    <p className="username">@{conn.username}</p>
                    <p className="bio">{conn.bio}</p>
                  </div>
                </Link>
                <button
                  className="btn-danger"
                  onClick={() => handleRemove(conn.connected_user_id)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="requests-list">
          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>No pending requests</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.connection_id} className="request-card">
                <Link to={`/profile/${req.connection_id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none', color: 'inherit' }}>
                  <AvatarWithFallback 
                    photo={req.photo} 
                    username={req.first_name || req.username} 
                    style={{ width: 50, height: 50, fontSize: '1.2rem', flexShrink: 0 }} 
                  />
                  <div className="connection-info">
                    <h4>{req.first_name} {req.last_name}</h4>
                    <p className="username">@{req.username}</p>
                  </div>
                </Link>
                <div className="request-actions">
                  <button className="btn-primary" onClick={() => handleAccept(req.connection_id)}>Accept</button>
                  <button className="btn-danger"  onClick={() => handleReject(req.connection_id)}>Decline</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Connections;
