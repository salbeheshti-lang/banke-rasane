// ============================================
// i18n — Translation system for BankRasaneh
// ============================================

export type Lang = 'fa' | 'en';

export const STRINGS: Record<string, { fa: string; en: string }> = {
  // Login
  login_title: { fa: 'ورود به برنامه', en: 'Login' },
  login_username: { fa: 'نام کاربری', en: 'Username' },
  login_password: { fa: 'رمز عبور', en: 'Password' },
  login_show_password: { fa: 'نمایش رمز', en: 'Show password' },
  login_loading: { fa: 'در حال ورود...', en: 'Logging in...' },
  login_error_network: { fa: 'خطای شبکه', en: 'Network error' },
  login_error_invalid: { fa: 'نام کاربری یا رمز عبور اشتباه است', en: 'Invalid username or password' },
  login_subtitle: { fa: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی', en: 'BankRasaneh — TV Talk Show Archive' },
  login_version: { fa: 'نسخه', en: 'Version' },

  // Header
  header_menu: { fa: 'باز کردن منو', en: 'Open menu' },
  header_connected: { fa: 'متصل', en: 'Connected' },

  // Drawer nav
  nav_dashboard: { fa: 'آرشیو', en: 'Archive' },
  nav_dashboard_desc: { fa: 'صفحهٔ اصلی و ژانرها', en: 'Home and genres' },
  nav_programs: { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  nav_programs_desc: { fa: 'لیست کامل برنامه‌ها', en: 'Full program list' },
  nav_add: { fa: 'افزودن برنامه', en: 'Add Program' },
  nav_add_desc: { fa: 'افزودن یا ویرایش برنامه', en: 'Add or edit program' },
  nav_reports: { fa: 'گزارش‌ها', en: 'Reports' },
  nav_reports_desc: { fa: 'آمار و خروجی', en: 'Statistics and export' },
  nav_genres: { fa: 'ژانرها', en: 'Genres' },
  nav_settings: { fa: '⚙ تنظیمات', en: '⚙ Settings' },
  nav_logout: { fa: 'خروج از حساب', en: 'Logout' },
  nav_close: { fa: 'بستن منو', en: 'Close menu' },
  nav_role_admin: { fa: 'مدیر سیستم', en: 'Admin' },
  nav_role_editor: { fa: 'ویراستار', en: 'Editor' },
  nav_role_viewer: { fa: 'بیننده', en: 'Viewer' },

  // Dashboard
  dashboard_title: { fa: 'توزیع برنامه‌ها بر اساس ژانر', en: 'Program Distribution by Genre' },
  dashboard_eyebrow: { fa: 'آرشیو تخصصی برنامه‌های تلویزیونی', en: 'Specialized TV Program Archive' },
  dashboard_brand: { fa: 'بانک رسانه', en: 'BankRasaneh' },
  dashboard_subtitle: { fa: 'برنامه در', en: 'programs in' },
  dashboard_genres: { fa: 'ژانر', en: 'genres' },
  dashboard_genres_section: { fa: 'ژانرها', en: 'Genres' },
  dashboard_add_genre: { fa: '+ افزودن ژانر', en: '+ Add Genre' },
  dashboard_add_program: { fa: '+ افزودن برنامه', en: '+ Add Program' },
  dashboard_donut_total: { fa: 'برنامهٔ کل', en: 'Total programs' },
  dashboard_donut_recent: { fa: 'برنامهٔ اخیر', en: 'recent programs' },
  dashboard_mini_published: { fa: 'منتشر شده', en: 'Published' },
  dashboard_mini_with_images: { fa: 'با تصویر', en: 'With images' },
  dashboard_mini_genres: { fa: 'ژانر', en: 'Genres' },
  dashboard_top_genres: { fa: 'پربرنامه‌ترین ژانرها', en: 'Top Genres' },

  // Showcase carousel
  showcase_title_auto: { fa: 'برنامه‌های پر بازدید', en: 'Popular Programs' },
  showcase_title_pinned: { fa: 'برگزیده‌های مدیر', en: 'Admin Picks' },
  showcase_subtitle: { fa: 'برای مشاهدهٔ جزئیات کلیک کنید', en: 'Click to view details' },
  showcase_config: { fa: 'انتخاب برنامه‌ها', en: 'Select Programs' },
  showcase_prev: { fa: 'قبلی', en: 'Previous' },
  showcase_next: { fa: 'بعدی', en: 'Next' },

  // Analytics
  analytics_config_title: { fa: 'انتخاب ژانرهای آمار', en: 'Select Analytics Genres' },
  analytics_config_desc: { fa: 'ژانرهایی که می‌خواهید در نمودار آمار نمایش داده شوند را انتخاب کنید', en: 'Select genres to display in analytics chart' },
  analytics_config_auto: { fa: 'خالی = ۵ ژانر برتر خودکار', en: 'Empty = auto top 5' },
  analytics_select_genres: { fa: 'انتخاب ژانرها', en: 'Select Genres' },

  // Programs view
  programs_search_placeholder: { fa: 'جستجو', en: 'Search' },
  programs_all: { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  programs_view_grid: { fa: 'نمایش شبکه‌ای', en: 'Grid view' },
  programs_view_list: { fa: 'نمایش لیستی', en: 'List view' },
  programs_islamic: { fa: '🌍 اسلامی', en: '🌍 Islamic' },
  programs_multi_select: { fa: 'انتخاب چندتایی', en: 'Multi-select' },
  programs_selected: { fa: 'انتخاب', en: 'selected' },
  programs_source_pdf: { fa: '📄 منبع: فایل PDF', en: '📄 Source: PDF file' },
  programs_source_desc: { fa: 'اطلاعات از سایت‌های رسمی برنامه‌ها و صفحات اختصاصی آن‌ها جمع‌آوری شده است', en: 'Information collected from official program websites and their dedicated pages' },

  // Modals
  modal_close: { fa: 'بستن', en: 'Close' },
  modal_save: { fa: 'ذخیره', en: 'Save' },
  modal_cancel: { fa: 'انصراف', en: 'Cancel' },
  modal_reset: { fa: 'بازنشانی', en: 'Reset' },

  // Buttons
  btn_add_program: { fa: '+ افزودن برنامه', en: '+ Add Program' },

  // Show detail
  detail_viewers: { fa: 'تماشاگر', en: 'Viewers' },
  detail_category: { fa: 'دسته', en: 'Category' },
  detail_country: { fa: 'کشور', en: 'Country' },
  detail_tags: { fa: 'برچسب‌ها', en: 'Tags' },

  // Reports
  reports_title: { fa: 'گزارش‌ها', en: 'Reports' },
  reports_subtitle: { fa: 'آمار و گزارش‌های بانک رسانه', en: 'BankRasaneh statistics and reports' },
};

export function t(key: string, lang: Lang = 'fa', args?: (string | number)[]): string {
  let s = STRINGS[key]?.[lang] ?? key;
  if (args) {
    args.forEach((a, i) => {
      s = s.replace(`{${i}}`, String(a));
    });
  }
  return s;
}

// ============================================
// React Context for language state
// ============================================
'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type TFunc = (key: string, args?: (string | number)[]) => string;

export interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
}

export const LangContext = createContext<LangContextValue>({
  lang: 'fa',
  setLang: () => {},
  t: (k) => k,
});

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fa');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (saved === 'en' || saved === 'fa') setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    localStorage.setItem('lang', lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const tFunc = useCallback((key: string, args?: (string | number)[]) => t(key, lang, args), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t: tFunc }}>
      {children}
    </LangContext.Provider>
  );
}
