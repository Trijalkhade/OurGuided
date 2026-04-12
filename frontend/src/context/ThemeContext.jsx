import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  /**
   * Initialize theme on mount
   * 1. Check localStorage for saved theme
   * 2. If not found, check system preference (prefers-color-scheme)
   * 3. Default to light
   */
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');

    let preferredTheme = 'light';

    if (savedTheme) {
      preferredTheme = savedTheme;
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      preferredTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(preferredTheme);
    applyTheme(preferredTheme);
  }, []);

  /**
   * Apply theme to the DOM and save to localStorage
   */
  const applyTheme = (themeName) => {
    const html = document.documentElement;
    if (themeName === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', themeName);
  };

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to use theme context
 */
export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
