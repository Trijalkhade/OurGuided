import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';
import { getDeviceId } from '../utils/device';

const AuthContext = createContext(null);

// Detect prerender
const isPrerender = typeof navigator !== "undefined" && navigator.userAgent === "ReactSnap";

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use(config => {
  if (isPrerender) return config;
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  /* Connect socket when we have a token */
  const connectSocket = (token) => {
    if (isPrerender || socketRef.current) return;
    const s = socketIO('/', { auth: { token }, transports: ['websocket', 'polling'] });
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

  /* Validate token on mount */
  useEffect(() => {
    if (isPrerender) {
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
          connectSocket(token);
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

  /* Cleanup socket on unmount */
  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    connectSocket(data.token);
    return data;
  };

  const register = async (userData) => {
    const deviceId = getDeviceId();
    const { data } = await API.post('/auth/register', { ...userData, device_id: deviceId });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    connectSocket(data.token);
    return data;
  };

  const logout = async () => {
    disconnectSocket();
    localStorage.removeItem('token');
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
