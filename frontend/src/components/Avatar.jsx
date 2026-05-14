import React, { useState } from 'react';

export function getInitial(username) {
  if (!username || typeof username !== 'string' || username.length === 0) return '?';
  return username[0].toUpperCase();
}

export function buildFullName(first, middle, last, username) {
  const name = `${first || ''} ${middle ? middle + ' ' : ''}${last || ''}`.trim();
  return name || username || 'Unknown';
}

export default function AvatarWithFallback({ photo, username, style, className = "avatar" }) {
  const [error, setError] = useState(false);
  return (
    <div className={className} style={style}>
      {photo && !error ? (
        <img src={photo} alt={username || 'User'} onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        getInitial(username)
      )}
    </div>
  );
}
