'use client';

/**
 * LangContext — provides the current language and a t() function to all
 * child components without prop-drilling.
 *
 * Usage at the top of the tree:
 *   <LangProvider>
 *     <App />
 *   </LangProvider>
 *
 * Usage inside any component:
 *   const { t, lang, setLang, toggleLang, dir } = useLang();
 *   <button onClick={toggleLang}>{lang === 'fa' ? 'EN' : 'فا'}</button>
 *   <h1>{t('login.submit')}</h1>
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Lang, translate, dirFor, htmlLang } from './i18n';

const STORAGE_KEY = 'bankresaneh_lang';

interface LangContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  // Default to Farsi (the app's primary language).
  // Use lazy initializer so localStorage is read once on the client
  // without needing a setState-in-effect (which triggers cascading renders).
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'fa';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'fa' || saved === 'en') return saved;
    } catch {}
    return 'fa';
  });

  // Apply lang/dir to <html> whenever lang changes.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', htmlLang(lang));
    document.documentElement.setAttribute('dir', dirFor(lang));
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'fa' ? 'en' : 'fa';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  const value: LangContextValue = {
    lang,
    dir: dirFor(lang),
    t,
    setLang,
    toggleLang,
  };

  return (
    <LangContext.Provider value={value}>
      {children}
    </LangContext.Provider>
  );
}

/** Hook to access the language context. Must be used inside <LangProvider>. */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error('useLang must be used inside <LangProvider>');
  }
  return ctx;
}

/**
 * No-flash script — runs before React hydrates to set <html lang/dir>
 * from localStorage so the page renders in the right direction immediately.
 * Inject this in layout.tsx <head> via dangerouslySetInnerHTML.
 */
export const langNoFlashScript = `
(function() {
  try {
    var l = localStorage.getItem('${STORAGE_KEY}') || 'fa';
    var dir = l === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', l);
    document.documentElement.setAttribute('dir', dir);
  } catch(e) {}
})();
`;
