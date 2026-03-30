import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionStartedRef     = useRef(false);

  /* Auto-start usage session once after login/restore */
  const startUsageSession = async () => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    try { await API.post('/study/start'); }
    catch { sessionStartedRef.current = false; }
  };

  /* Stop usage session before clearing auth */
  const stopUsageSession = async () => {
    try { await API.post('/study/stop'); } catch { /* no active session – ignore */ }
    sessionStartedRef.current = false;
  };

  /* Flush session on tab/window close using sendBeacon */
  useEffect(() => {
    const handleUnload = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
      navigator.sendBeacon('http://localhost:5000/api/study/stop', blob);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  /* Validate token on mount and start tracking */
  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await API.get('/auth/me');
        if (!cancelled) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
          startUsageSession(); // real timestamp starts here
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    validate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    sessionStartedRef.current = false; // allow a fresh start
    await startUsageSession();
    return data;
  };

  const register = async (userData) => {
    const { data } = await API.post('/auth/register', userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    sessionStartedRef.current = false;
    await startUsageSession();
    return data;
  };

  const logout = async () => {
    await stopUsageSession(); // record time before clearing token
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { API };
