'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  const applyTheme = (t: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.className = t === 'dark' ? 'theme-dark' : '';
    }
  };


  useEffect(() => {
    let frame = 0;
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('bankresaneh_theme') : null;
      const initialTheme: Theme = saved === 'dark' || saved === 'light' ? saved : 'light';
      applyTheme(initialTheme);
      frame = window.requestAnimationFrame(() => setThemeState(initialTheme));
    } catch {
      applyTheme('light');
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
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
