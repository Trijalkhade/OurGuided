import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// ✅ Detect prerender (VERY IMPORTANT)
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use(config => {
  if (isPrerender) return config; // 🚀 skip auth in prerender
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
    if (isPrerender) return; // 🚀 skip during prerender
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    try { await API.post('/study/start'); }
    catch { sessionStartedRef.current = false; }
  };

  /* Stop usage session before clearing auth */
  const stopUsageSession = async () => {
    if (isPrerender) return;
    try { await API.post('/study/stop'); } catch {}
    sessionStartedRef.current = false;
  };

  /* Flush session on tab/window close */
  useEffect(() => {
    if (isPrerender) return;

    const handleUnload = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
      navigator.sendBeacon('http://localhost:5000/api/study/stop', blob);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  /* Validate token on mount */
  useEffect(() => {
    if (isPrerender) {
      // 🚀 Skip auth completely during prerender
      setLoading(false);
      return;
    }

    let cancelled = false;

    const validate = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await API.get('/auth/me');
        if (!cancelled) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
          startUsageSession();
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
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    sessionStartedRef.current = false;
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
    await stopUsageSession();
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
