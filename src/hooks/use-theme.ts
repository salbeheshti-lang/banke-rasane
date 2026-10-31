'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bankresaneh_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // Respect OS preference on first visit
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('theme-dark');
  } else {
    root.classList.remove('theme-dark');
  }
  // Update the color-scheme so native form controls match
  root.style.colorScheme = theme;
}

/**
 * Theme hook — manages light/dark mode, persists to localStorage,
 * and applies the `.theme-dark` class on <html> (which drives all CSS
 * variable overrides in globals.css).
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialise from localStorage on mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  const setMode = useCallback((mode: Theme) => {
    setTheme(mode);
    applyTheme(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, []);

  return { theme, toggle, setMode, mounted };
}

/**
 * Inline script injected into <head> so the theme is applied BEFORE
 * first paint — prevents a flash of the wrong theme on reload.
 * Drop this into layout.tsx via dangerouslySetInnerHTML.
 */
export const themeNoFlashScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (!t) {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    if (t === 'dark') {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;
