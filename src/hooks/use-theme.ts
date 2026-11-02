'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

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
        setThemeState(saved);
        applyTheme(saved);
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
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') document.documentElement.className = 'theme-dark';
  } catch(e) {}
})();
`;
