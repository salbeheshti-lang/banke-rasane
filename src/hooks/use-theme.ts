'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  function applyTheme(t: Theme) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.className = t === 'dark' ? 'theme-dark' : '';
    }
  }

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('bankresaneh_theme') : null;
      if (saved === 'dark' || saved === 'light') {
        applyTheme(saved);
        Promise.resolve().then(() => setThemeState(saved));
      } else {
        applyTheme('dark');
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
    var t = localStorage.getItem('bankresaneh_theme') || 'dark';
    if (t === 'light') {
      document.documentElement.className = '';
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.className = 'theme-dark';
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
})();
`;
