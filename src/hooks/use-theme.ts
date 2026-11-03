'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  // Default to 'light' (the emerald gradient theme we finalized today).
  const [theme, setThemeState] = useState<Theme>('light');

  function applyTheme(t: Theme) {
    if (typeof document !== 'undefined') {
      // Light = no class on <html> (uses :root defaults)
      // Dark  = 'theme-dark' class on <html>
      document.documentElement.className = t === 'dark' ? 'theme-dark' : '';
      document.documentElement.setAttribute('data-theme', t);
    }
  }

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('bankresaneh_theme') : null;
      if (saved === 'dark' || saved === 'light') {
        applyTheme(saved);
        Promise.resolve().then(() => setThemeState(saved));
      } else {
        applyTheme('light');
      }
    } catch {}
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem('bankresaneh_theme', t); } catch {}
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return { theme, setTheme, toggleTheme };
}

export const themeNoFlashScript = `
(function() {
  try {
    var t = localStorage.getItem('bankresaneh_theme') || 'light';
    if (t === 'dark') {
      document.documentElement.className = 'theme-dark';
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.className = '';
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch(e) {}
})();
`;
