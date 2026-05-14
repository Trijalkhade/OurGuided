import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';
import { getDeviceId } from '../utils/device';

const AuthContext = createContext(null);

// Detect prerender
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const API = axios.create({ baseURL: '/api', withCredentials: true });
// No interceptor needed — cookie is sent automatically by the browser

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  /* Connect socket — cookie is sent automatically via withCredentials */
  const connectSocket = () => {
    if (isPrerender || socketRef.current) return;
    const s = socketIO('/', { withCredentials: true, transports: ['websocket', 'polling'] });
    s.on('connect', () => console.log('Socket connected'));
    s.on('connect_error', (err) => console.warn('Socket auth error:', err.message));
    socketRef.current = s;
    setSocket(s);
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  };

  /* Validate session on mount — cookie is sent automatically */
  useEffect(() => {
    if (isPrerender) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const { data } = await API.get('/auth/me');
        if (!cancelled) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
          connectSocket();
        }
      } catch {
        localStorage.removeItem('user');
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    validate();
    return () => { cancelled = true; };
  }, []);

  /* Cleanup socket on unmount */
  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    connectSocket();
    return data;
  };

  const register = async (userData) => {
    const deviceId = getDeviceId();
    const { data } = await API.post('/auth/register', { ...userData, device_id: deviceId });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    connectSocket();
    return data;
  };

  const logout = async () => {
    disconnectSocket();
    try { await API.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, socket }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { API };
