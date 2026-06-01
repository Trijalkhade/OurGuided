import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthGateContext = createContext(null);

export const AuthGateProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState('');

  const requireAuth = useCallback((label = 'continue') => {
    setActionLabel(label);
    setIsOpen(true);
  }, []);

  const closeGate = useCallback(() => {
    setIsOpen(false);
    setActionLabel('');
  }, []);

  return (
    <AuthGateContext.Provider value={{ isOpen, actionLabel, requireAuth, closeGate }}>
      {children}
    </AuthGateContext.Provider>
  );
};

export const useAuthGate = () => {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used within AuthGateProvider');
  return ctx;
};
