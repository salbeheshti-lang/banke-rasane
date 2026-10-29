'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { type Lang, t as translate, STRINGS, LangProvider, useLang, LangContext, LangContextValue, TFunc } from '@/lib/i18n';
import { api, setApiBase, getApiBase, User } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

// Video editor loaded dynamically (FFmpeg.wasm needs browser)
const VideoEditor = dynamic(() => import('@/components/VideoEditor'), { ssr: false });

// ============================================
// TYPES
// ============================================
interface TalkShow {
  num: number;
  name: string;
  category: string;
  source: string;
  size: string;
  viewers: string;
  style: string;
  effects: string;
  layout: string;
  elements: string;
  materials: string;
  colors: string;
  lighting: string;
  summary: string;
  descriptionFa: string;
  youtube: string;
  imdb: string;
  wikipedia: string;
  socialPost: string;
  country?: string;
  tags?: string[];
  images?: string[];
  videos?: string[];
}

// A "section-specific tag" — derives a small badge label from a TalkShow field
// (only when the field has a meaningful value). Each Genre chooses which tags to show.
type TagSpec = { id: string; label: (s: TalkShow) => string | null };

interface Genre {
  id: string;
  key: string;
  nameFa: string;
  name: string;          // English name (also serves as `nameEn`)
  nameEn?: string;       // Optional explicit English name (defaults to `name`)
  color: string;
  description: string;   // Persian description
  descriptionEn?: string; // Optional English description
  filterFn: (s: TalkShow) => boolean;
  // Section-specific tags shown on cards in this genre's view
  tags?: TagSpec[];
  // Preset tags offered as quick-add buttons in AddEditView when this genre is preset
  presetTags?: string[];
  // Which TalkShow fields the ProgramsView search bar should match against
  searchFields?: (keyof TalkShow)[];
  // True for user-created genres (stored in localStorage)
  isCustom?: boolean;
}

// Returns the localized name of a genre based on the current language.
// Falls back to `name` (English) if `nameEn` is not set, and to `nameFa` for Farsi.
function genreName(g: Genre, lang: Lang): string {
  if (lang === 'en') return g.nameEn || g.name || g.nameFa;
  return g.nameFa || g.name;
}

// Returns the localized description of a genre (English version optional).
function genreDescription(g: Genre, lang: Lang): string {
  if (lang === 'en') return g.descriptionEn || g.description;
  return g.description;
}

// Small inline component that pulls a translated string from the LangContext.
// Useful when a component can't call useLang() at the top of its body
// (e.g. inside a JSX prop that needs translation).
function LangText({ k, args, style, className }: { k: string; args?: (string | number)[]; style?: React.CSSProperties; className?: string }) {
  const { t } = useLang();
  return <span style={style} className={className}>{t(k, args)}</span>;
}

// Reusable tag specifications — each Genre picks a subset for its `tags` array.
const TAG_LIBRARY: Record<string, TagSpec> = {
  style: { id: 'style', label: s => s.style || null },
  size: { id: 'size', label: s => s.size || null },
  viewers: { id: 'viewers', label: s => (s.viewers === 'با تماشاگر' ? 'با تماشاگر' : null) },
  layout: { id: 'layout', label: s => s.layout || null },
  effects: { id: 'effects', label: s => s.effects || null },
  elements: { id: 'elements', label: s => s.elements || null },
  materials: { id: 'materials', label: s => s.materials || null },
  colors: { id: 'colors', label: s => s.colors || null },
  lighting: { id: 'lighting', label: s => s.lighting || null },
};

// Default tag set for the "decor" view (or any genre without its own tags).
const DEFAULT_GENRE_TAGS: TagSpec[] = [TAG_LIBRARY.style, TAG_LIBRARY.size, TAG_LIBRARY.viewers];

// Real genres from Excel - 17 categories + technical decor view + 3 extras (PSA, deep observation, ads)
const GENRES: Genre[] = [
  {
    id: 'decor', key: 'decor', nameFa: 'دکور برنامه‌ها', name: 'Decor Analysis',
    color: '#55AEB7', description: 'همهٔ ۵۶۰ برنامه با تحلیل دکور و صحنه', filterFn: () => true,
    tags: DEFAULT_GENRE_TAGS,
    presetTags: ['مدرن', 'مینیمال', 'چوب', 'تکنولوژی', 'گرم', 'لوکس', 'تاریک', 'روشن'],
    searchFields: ['name', 'summary', 'materials', 'colors'],
  },
  {
    id: 'interview', key: 'interview', nameFa: 'تاک‌شوی مصاحبه‌محور', name: 'Interview',
    color: '#FF514C', description: '۱۰۲ برنامه', filterFn: s => s.category.includes('مصاحبه'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.viewers],
    presetTags: ['مصاحبه اختصاصی', 'مهمان ویژه', 'تکنولوژی', 'استودیو', 'مدرن', 'گریل'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'comedy', key: 'comedy', nameFa: 'تاک‌شوی طنز و کمدی', name: 'Comedy',
    color: '#FF168B', description: '۸۹ برنامه', filterFn: s => s.category.includes('طنز'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['طنز', 'استندآپ', 'شخصیت‌محور', 'استودیوی رنگارنگ', 'پویا'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'news', key: 'news', nameFa: 'تاک‌شوی سیاسی و خبری', name: 'News/Politics',
    color: '#00D9D5', description: '۶۸ برنامه', filterFn: s => s.category.includes('خبری') || s.category.includes('سیاسی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['خبری', 'تحلیل سیاسی', 'مهمان سیاسی', 'رسمی', 'مدرن'],
    searchFields: ['name', 'summary', 'descriptionFa', 'category'],
  },
  {
    id: 'lifestyle', key: 'lifestyle', nameFa: 'تاک‌شوی تخصصی و سبک زندگی', name: 'Lifestyle',
    color: '#9957FF', description: '۵۴ برنامه', filterFn: s => s.category.includes('تخصصی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['سبک زندگی', 'آشپزی', 'سلامت', 'مد', 'منزل', 'طبیعت'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'cultural', key: 'cultural', nameFa: 'تاک‌شوی فرهنگی، هنری', name: 'Cultural',
    color: '#20E6AD', description: '۵۲ برنامه', filterFn: s => s.category.includes('فرهنگی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['فرهنگی', 'هنری', 'سنتی', 'تاریخی', 'موسیقی'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'celebrity', key: 'celebrity', nameFa: 'تاک‌شوی گروهی سلبریتی‌ها', name: 'Celebrity',
    color: '#FF4F93', description: '۴۲ برنامه', filterFn: s => s.category.includes('سلبریتی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.size],
    presetTags: ['سلبریتی', 'گروهی', 'مهمان‌محور', 'سرگرمی', 'لوکس'],
    searchFields: ['name', 'summary', 'style', 'size'],
  },
  {
    id: 'panel', key: 'panel', nameFa: 'تاک‌شوی پنلی و میزگرد', name: 'Panel',
    color: '#008D9C', description: '۲۳ برنامه', filterFn: s => s.category.includes('پنلی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.size],
    presetTags: ['پنل', 'میزگرد', 'چندمهمانه', 'بحث', 'تخصصی'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'morning', key: 'morning', nameFa: 'تاک‌شوی روزانه/صبحگاهی', name: 'Morning Show',
    color: '#FFD34E', description: '۲۰ برنامه', filterFn: s => s.category.includes('صبحگاهی'),
    tags: [TAG_LIBRARY.size, TAG_LIBRARY.viewers],
    presetTags: ['صبحگاهی', 'روزانه', 'پویا', 'با تماشاگر', 'موسیقی زنده'],
    searchFields: ['name', 'summary', 'category', 'viewers'],
  },
  {
    id: 'reality', key: 'reality', nameFa: 'ریلیتی شو / مسابقه', name: 'Reality/Competition',
    color: '#FF594E', description: '۱۹ برنامه', filterFn: s => s.category.includes('مسابقه') || s.category.includes('رئالیتی'),
    tags: [TAG_LIBRARY.effects, TAG_LIBRARY.style],
    presetTags: ['مسابقه', 'رئالیتی', 'داورمحور', 'پیروز', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'night', key: 'night', nameFa: 'تاک‌شوی شبانه', name: 'Late Night',
    color: '#A66BFF', description: '۱۵ برنامه', filterFn: s => s.category.includes('شبانه'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['شبانه', 'تاریک', 'کمدی', 'مصاحبه کوتاه', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'lighting'],
  },
  {
    id: 'entertainment', key: 'entertainment', nameFa: 'صنعت سرگرمی / پشت‌صحنه', name: 'Entertainment',
    color: '#E72C42', description: '۱۳ برنامه', filterFn: s => s.category.includes('سرگرمی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['سرگرمی', 'پشت‌صحنه', 'گوینده', 'مدرن', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'location', key: 'location', nameFa: 'موقعیت‌محور / خارج از استودیو', name: 'On-Location',
    color: '#079C79', description: '۱۲ برنامه', filterFn: s => s.category.includes('موقعیت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['موقعیت‌محور', 'بیرون از استودیو', 'میدانی', 'طبیعت', 'شهری'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'digital', key: 'digital', nameFa: 'تاک‌شوی دیجیتال / اینترنتی', name: 'Digital',
    color: '#00E6A0', description: '۱۰ برنامه', filterFn: s => s.category.includes('دیجیتال'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['دیجیتال', 'اینترنتی', 'استریم', 'تعاملی', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'relationships', key: 'relationships', nameFa: 'تاک‌شوی روابط و تعارض', name: 'Relationships',
    color: '#E60075', description: '۸ برنامه', filterFn: s => s.category.includes('روابط'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['روابط', 'تعارض', 'خانوادگی', 'گفتگومحور', 'صمیمی'],
    searchFields: ['name', 'summary', 'style', 'layout'],
  },
  {
    id: 'radio', key: 'radio', nameFa: 'تاک‌شوی رادیویی / صوتی', name: 'Radio/Audio',
    color: '#B8C9C8', description: '۶ برنامه', filterFn: s => s.category.includes('رادیویی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.effects],
    presetTags: ['رادیویی', 'صوتی', 'گفتگو', 'مدرن', 'استودیویی'],
    searchFields: ['name', 'summary', 'layout', 'effects'],
  },
  {
    id: 'human', key: 'human', nameFa: 'تاک‌شوی انسانی و داستان‌محور', name: 'Human Stories',
    color: '#075267', description: '۵ برنامه', filterFn: s => s.category.includes('انسانی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['انسانی', 'داستان‌محور', 'مصاحبه عمیق', 'صمیمی', 'مستندگونه'],
    searchFields: ['name', 'summary', 'style', 'materials'],
  },
  {
    id: 'psa', key: 'psa', nameFa: 'پیام خدمت عمومی (PSA)', name: 'Public Service Announcement (PSA)',
    color: '#00E6A0', description: 'پیام‌های آگاهی‌بخش و خدمت عمومی',
    filterFn: s => s.category.includes('PSA') || s.category.includes('پیام خدمت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['خدمت عمومی', 'آگاهی‌بخش', 'آموزشی', 'اجتماعی', 'کوتاه'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'deepobs', key: 'deepobs', nameFa: 'پایش تحلیلی', name: 'Deep Observation',
    color: '#7040DF', description: 'تحلیل و رصد عمیق برنامه‌ها',
    filterFn: s => s.category.includes('پایش تحلیلی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting, TAG_LIBRARY.materials],
    presetTags: ['تحلیلی', 'رصد عمیق', 'بررسی تخصصی', 'مقایسه‌ای', 'تفصیلی'],
    searchFields: ['name', 'summary', 'descriptionFa', 'materials'],
  },
  {
    id: 'funeral', key: 'funeral', nameFa: 'سوگواری و خاکسپاری', name: 'Funeral Coverage',
    color: '#8EADAE', description: 'پوشش خبری مراسم خاکسپاری و سوگواری شخصیت‌ها',
    filterFn: s => s.category.includes('خاکسپاری') || s.category.includes('سوگواری'),
    tags: [],
    presetTags: ['رسمی', 'مذهبی', 'دولتی', 'مردمی', 'سنتی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'war', key: 'war', nameFa: 'برنامه‌های جنگ و بحران', name: 'War & Conflict',
    color: '#741D39', description: 'برنامه‌های تلویزیونی با موضوع جنگ و منازعات',
    filterFn: s => s.category.includes('جنگ') || s.category.includes('بحران'),
    tags: [],
    presetTags: ['مستند جنگ', 'تحلیل نظامی', 'خبری', 'بیانیه'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'debate', key: 'debate', nameFa: 'مناظرات انتخاباتی', name: 'Electoral Debates',
    color: '#00A6B5', description: 'مناظرات و بحث‌های انتخاباتی',
    filterFn: s => s.category.includes('مناظره') || s.category.includes('انتخابات'),
    tags: [],
    presetTags: ['ریاست جمهوری', 'پارلمانی', 'محلی', 'حزبی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'ads', key: 'ads', nameFa: 'آگهی‌های تبلیغاتی', name: 'Advertisements',
    color: '#E8BBA5', description: 'تبلیغات و آگهی‌های تجاری',
    filterFn: s => s.category.includes('آگهی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.colors],
    presetTags: ['تبلیغاتی', 'تجاری', 'برندمحور', 'جذاب', 'کوتاه'],
    searchFields: ['name', 'summary', 'category', 'colors'],
  },
  {
    id: 'film-review', key: 'film-review', nameFa: 'نقد و بررسی فیلم', name: 'Film Review',
    color: '#FF4F93', description: 'برنامه‌های نقد و بررسی فیلم و تلویزیون',
    filterFn: s => s.category.includes('نقد و بررسی فیلم'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['نقد فیلم', 'سینما', 'تحلیل', 'مصاحبه', 'فرهنگ عامه'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'family', key: 'family', nameFa: 'خانواده و افزایش جمعیت', name: 'Family & Population',
    color: '#00E6A0', description: 'برنامه‌های تلویزیونی حوزه خانواده و فرزندآوری',
    filterFn: s => s.category.includes('خانواده و افزایش جمعیت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['خانواده', 'فرزندآوری', 'واقعیت‌نما', 'سبک زندگی', 'جمعیت'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'ramadan', key: 'ramadan', nameFa: 'برنامه‌های ماه مبارک رمضان', name: 'Ramadan Programs',
    color: '#FFD34E', description: 'برنامه‌های ماه مبارک رمضان در کشورهای اسلامی',
    filterFn: s => s.category.includes('ماه مبارک رمضان'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['رمضان', 'مذهبی', 'قرآنی', 'افطار', 'سحری'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'live-camera', key: 'live-camera', nameFa: 'پخش زنده', name: 'Live Broadcast',
    color: '#00D9D5', description: 'پخش زنده از سراسر جهان',
    filterFn: s => s.category.includes('پخش زنده دوربین'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['دوربین زنده', 'گردشگری', 'شهر', 'طبیعت', 'استریم'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'constitution', key: 'constitution', nameFa: 'قانون اساسی', name: 'Constitutional Law',
    color: '#008D9C', description: 'برنامه‌های مرتبط با قانون اساسی',
    filterFn: s => s.category.includes('قانون اساسی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['قانون', 'اساسی', 'حقوقی', 'مدنی', 'مذهبی'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'police', key: 'police', nameFa: 'برنامه‌های پلیسی', name: 'Police Shows',
    color: '#075267', description: 'برنامه‌های تلویزیونی با موضوع پلیس و امنیت',
    filterFn: s => s.category.includes('پلیسی') || s.category.includes('پلیس'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['پلیسی', 'جنایی', 'امنیتی', 'تحقیقات', 'مامور'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'fifth-column', key: 'fifth-column', nameFa: 'ستون پنجم', name: 'Fifth Column',
    color: '#741D39', description: 'آثار تلویزیونی با موضوع ستون پنجم',
    filterFn: s => s.category.includes('ستون پنجم'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['ستون پنجم', 'جاسوسی', 'ضداطلاعاتی', 'امنیت ملی', 'نفوذ'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'tree-planting', key: 'tree-planting', nameFa: 'کاشت درخت', name: 'Tree Planting',
    color: '#20E6AD', description: 'برنامه‌های مرتبط با کاشت درخت و محیط زیست',
    filterFn: s => s.category.includes('Tree Planting') || s.category.includes('کاشت درخت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['محیط زیست', 'کاشت درخت', 'طبیعت', 'سبز', 'حفاظت'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'sarfjooyi', key: 'sarfjooyi', nameFa: 'صرفه‌جویی در مصرف انرژی', name: 'Energy Saving',
    color: '#FFD34E', description: 'برنامه‌های مرتبط با صرفه‌جویی در مصرف انرژی',
    filterFn: s => s.category.includes('صرفه‌جویی') || s.category.includes('انرژی') || s.category.includes('Energy'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['صرفه‌جویی', 'انرژی', 'محیط زیست', 'برق', 'آب'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'school-opening', key: 'school-opening', nameFa: 'مدرسه و دانش‌آموز', name: 'School & Student',
    color: '#FFD34E', description: 'برنامه‌های مرتبط با مدرسه، دانش‌آموز و بازگشایی مدارس',
    filterFn: s => s.category.includes('مدرسه') || s.category.includes('School') || s.category.includes('بازگشایی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.size],
    presetTags: ['مدارس', 'آموزش', 'دانش‌آموز', 'بازگشایی', 'تحصیل'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'travel-road', key: 'travel-road', nameFa: 'برنامه‌های سفر و جاده', name: 'Travel & Road Shows',
    color: '#55AEB7', description: 'برنامه‌های سفرنامه‌ای و جاده‌ای',
    filterFn: s => s.category.includes('travel road') || s.category.includes('سفر و جاده'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['سفر', 'جاده', 'گردشگری', 'مردم‌شناسی', 'موقعیت‌محور'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'investment', key: 'investment', nameFa: 'سرمایه‌گذاری در تولید', name: 'Production Investment',
    color: '#9957FF', description: 'برنامه‌های مرتبط با سرمایه‌گذاری در تولید',
    filterFn: s => s.category.includes('سرمایه‌گذاری') || s.category.includes('Investment'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['سرمایه‌گذاری', 'تولید', 'اقتصاد', 'صنعت', 'کارآفرینی'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'christmas', key: 'christmas', nameFa: 'ویژه‌برنامه‌های کریسمس', name: 'Christmas Specials',
    color: '#E8BBA5', description: 'ویژه‌برنامه‌های کریسمس در کشورهای مختلف',
    filterFn: s => s.category.includes('کریسمس') || s.category.includes('Christmas'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.colors],
    presetTags: ['کریسمس', 'جشن', 'آیین', 'کشورهای مختلف', 'ویژه'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
];

// Map of genre IDs that have a downloadable source PDF file (used by the
// ProgramsView download button + the dashboard "PDF sources" mini-stat).
const GENRE_PDF_MAP: Record<string, string> = {
  'film-review': '/pdfs/naghd-film.pdf',
  'family': '/pdfs/khanevadeh.pdf',
  'ramadan': '/pdfs/ramazan.pdf',
  'live-camera': '/pdfs/pakhsh-zende.pdf',
  'ads': '/pdfs/ehdaye-ozoo.pdf',
  'police': '/pdfs/polisi.pdf',
  'constitution': '/pdfs/ghanun-asasi.pdf',
  'investment': '/pdfs/sarmaye-gozari.pdf',
  'christmas': '/pdfs/krismas.pdf',
  'school-opening': '/pdfs/madrese.pdf',
  'travel-road': '/pdfs/safar-jadeh.pdf',
  'fifth-column': '/pdfs/setun-panjom.pdf',
  'tree-planting': '/pdfs/kasht-darakht.pdf',
  'sarfjooyi': '/pdfs/sarfjooyi.pdf',
};

// ============================================
// ISLAMIC COUNTRIES FILTER
// ~40 Persian country names — used to detect a show's country from its text.
// ============================================
const ISLAMIC_COUNTRIES: string[] = [
  'ایران', 'افغانستان', 'پاکستان', 'ترکیه', 'عربستان', 'عراق', 'سوریه', 'مصر',
  'یمن', 'عمان', 'قطر', 'کویت', 'بحرین', 'امارات', 'اردن', 'لبنان',
  'فلسطین', 'سودان', 'لیبی', 'تونس', 'الجزایر', 'مراکش', 'موریتانی', 'سومالی',
  'مالزی', 'اندونزی', 'برونئی', 'بنگلادش', 'مالدیو', 'کومور', 'ازبکستان', 'تاجیکستان',
  'ترکمنستان', 'قرقیزستان', 'قزاقستان', 'آذربایجان', 'مالی', 'نیجر', 'چاد', 'سنگال',
];

// Returns the list of Islamic countries mentioned in a show's text (description, summary, country).
function detectCountries(show: TalkShow): string[] {
  const text = `${show.descriptionFa || ''} ${show.summary || ''} ${show.country || ''}`;
  const found: string[] = [];
  for (const c of ISLAMIC_COUNTRIES) {
    // Word-boundary-style match: country must not be part of a longer Persian word.
    // We use a regex that requires non-letter / start / end on either side.
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\u0600-\\u06FFa-zA-Z])${escaped}([^\\u0600-\\u06FFa-zA-Z]|$)`);
    if (re.test(text)) found.push(c);
  }
  return Array.from(new Set(found));
}

// ============================================
// RELATED PROGRAMS
// Score: same category +5, same layout +3, shared elements (Jaccard up to +3),
//        same style +2, same effects +2, same country +2, same size +1, same viewers +1
// ============================================
function findRelated(show: TalkShow, allShows: TalkShow[], limit = 6): TalkShow[] {
  const showElements = (show.elements || '').split(/[,،\s]+/).filter(Boolean);
  const candidates = allShows.filter(s => s.num !== show.num);
  const scored = candidates.map(s => {
    let score = 0;
    if (s.category === show.category) score += 5;
    if (s.layout === show.layout) score += 3;
    const sElements = (s.elements || '').split(/[,،\s]+/).filter(Boolean);
    if (showElements.length > 0 && sElements.length > 0) {
      const intersection = showElements.filter(e => sElements.includes(e)).length;
      const union = new Set([...showElements, ...sElements]).size || 1;
      score += Math.round((intersection / union) * 3);
    }
    if (s.style === show.style) score += 2;
    if (s.effects === show.effects) score += 2;
    if (s.country && show.country && s.country === show.country) score += 2;
    if (s.size === show.size) score += 1;
    if (s.viewers === show.viewers) score += 1;
    return { show: s, score };
  });
  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.show);
}

// ============================================
// CUSTOM GENRES — persisted in localStorage so user-added genres survive refresh
// ============================================
const CUSTOM_GENRES_KEY = 'bankresaneh_custom_genres_v1';

type StoredGenre = {
  id: string;
  nameFa: string;
  name?: string;
  color: string;
  description: string;
};

function loadCustomGenres(): Genre[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_GENRES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((g: any) => g && typeof g === 'object' && typeof g.id === 'string' && typeof g.nameFa === 'string' && typeof g.color === 'string')
      .map((g: StoredGenre) => ({
        id: g.id,
        key: g.id,
        nameFa: g.nameFa,
        name: g.name || g.nameFa,
        color: g.color,
        description: g.description || '',
        // Match shows whose category contains the genre's Persian name
        filterFn: (s: TalkShow) => s.category.includes(g.nameFa) || (g.name ? s.category.includes(g.name) : false),
        isCustom: true,
        tags: DEFAULT_GENRE_TAGS,
        presetTags: [],
        searchFields: ['name', 'summary', 'category', 'descriptionFa'] as (keyof TalkShow)[],
      }));
  } catch {
    return [];
  }
}

function saveCustomGenres(genres: Genre[]) {
  if (typeof window === 'undefined') return;
  try {
    const arr: StoredGenre[] = genres.map(g => ({
      id: g.id, nameFa: g.nameFa, name: g.name, color: g.color, description: g.description,
    }));
    window.localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}

// Render the section-specific tags (from genre.tags or DEFAULT_GENRE_TAGS) as small badges.
function renderGenreTags(show: TalkShow, genre?: Genre | null): { id: string; label: string }[] {
  const specs = (genre && genre.tags) ? genre.tags : DEFAULT_GENRE_TAGS;
  const out: { id: string; label: string }[] = [];
  for (const spec of specs) {
    const label = spec.label(show);
    if (label) out.push({ id: spec.id, label });
  }
  return out;
}

function toFa(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '-';
  return n.toLocaleString('fa-IR');
}

// Adjust a hex color brightness (-100 to +100)
function adjustColor(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get show's real image if available, otherwise generate thumbnail from decor properties
function getShowThumbnail(show: TalkShow): { gradient: string; pattern: string; accent: string; image: string | null } {
  // Check if show has real images from PDF
  if (show.images && show.images.length > 0) {
    const thumb = generateThumbnailColors(show);
    return { ...thumb, image: show.images[0] };
  }
  return { ...generateThumbnailColors(show), image: null };
}

function generateThumbnailColors(show: TalkShow): { gradient: string; pattern: string; accent: string } {
  // Extract colors from show's color field
  const colorStr = show.colors || '';
  let primary = '#10b981';
  let secondary = '#0d7c4a';

  if (colorStr.includes('red') || colorStr.includes('قرمز')) primary = '#dc2626';
  else if (colorStr.includes('blue') || colorStr.includes('آبی')) primary = '#2563eb';
  else if (colorStr.includes('purple') || colorStr.includes('بنفش')) primary = '#7c3aed';
  else if (colorStr.includes('pink') || colorStr.includes('صورتی')) primary = '#db2777';
  else if (colorStr.includes('orange') || colorStr.includes('نارنجی')) primary = '#ea580c';
  else if (colorStr.includes('yellow') || colorStr.includes('زرد')) primary = '#f59e0b';
  else if (colorStr.includes('green') || colorStr.includes('سبز')) primary = '#10b981';
  else if (colorStr.includes('gold') || colorStr.includes('طلایی')) primary = '#b45309';
  else if (colorStr.includes('white') || colorStr.includes('سفید')) primary = '#5a6b4a';

  if (colorStr.includes('wood') || colorStr.includes('چوب')) secondary = '#92400e';
  else if (colorStr.includes('dark') || colorStr.includes('تاریک')) secondary = '#1a2e1a';
  else if (colorStr.includes('black') || colorStr.includes('مشکی')) secondary = '#0a0a0a';
  else secondary = primary + '88';

  const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
  const pattern = `radial-gradient(circle at 30% 40%, ${primary}40 0%, transparent 50%), radial-gradient(circle at 70% 60%, ${secondary}40 0%, transparent 50%)`;

  return { gradient, pattern, accent: primary };
}

// ============================================
// VIDEO HELPERS — platform detection + YouTube thumbnail extraction
// ============================================
function getYoutubeThumbnail(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
  }
  return null;
}

function getVideoPlatformInfo(url: string): { name: string; icon: string; color: string } {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return { name: 'یوتیوب', icon: '▶', color: '#dc2626' };
  if (url.includes('aparat.com')) return { name: 'آپارات', icon: '🎬', color: '#ed1c24' };
  if (url.includes('vimeo.com')) return { name: 'Vimeo', icon: '🎥', color: '#19b7ea' };
  if (url.includes('dailymotion.com')) return { name: 'Dailymotion', icon: '📺', color: '#0066dc' };
  if (url.includes('t.me') || url.includes('telegram')) return { name: 'تلگرام', icon: '✈', color: '#0088cc' };
  if (url.includes('instagram.com')) return { name: 'اینستاگرام', icon: '📷', color: '#e1306c' };
  return { name: 'ویدیو', icon: '🎬', color: '#8a8a7a' };
}

// ============================================
// SHOW IMAGE GALLERY — displays all images for a show in modal
// ============================================
function ShowImageGallery({ images, showName }: { images: string[]; showName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>
        🖼 تصاویر برنامه
        <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
          ({images.length.toLocaleString('fa-IR')} تصویر)
        </span>
      </h4>

      {/* Main image */}
      <div
        className="rounded-xl overflow-hidden mb-3 relative cursor-pointer"
        style={{ aspectRatio: '16/9', background: 'rgba(232, 228, 216, 0.5)', border: '1px solid rgba(13, 124, 74, 0.3)' }}
        onClick={() => images[activeIdx] && setLightbox(images[activeIdx])}
      >
        <img
          src={images[activeIdx]}
          alt={`${showName} - تصویر ${(activeIdx + 1).toLocaleString('fa-IR')}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx((activeIdx - 1 + images.length) % images.length); }}
              className="absolute top-1/2 right-2 -translate-y-1/2 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx((activeIdx + 1) % images.length); }}
              className="absolute top-1/2 left-2 -translate-y-1/2 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
            >
              {(activeIdx + 1).toLocaleString('fa-IR')} / {images.length.toLocaleString('fa-IR')}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className="rounded-lg overflow-hidden flex-shrink-0 transition-all"
              style={{
                width: '64px',
                height: '48px',
                border: idx === activeIdx ? '3px solid #10b981' : '2px solid rgba(13, 124, 74, 0.3)',
                opacity: idx === activeIdx ? 1 : 0.6,
              }}
            >
              <img
                src={img}
                alt={`تصویر ${(idx + 1).toLocaleString('fa-IR')}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — full size view */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 left-4 p-3 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
            onClick={() => setLightbox(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightbox}
            alt={showName}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
// ============================================
// LOCAL PERSISTENCE — user edits are saved in localStorage so they survive a refresh.
// ============================================
type Overrides = {
  added: TalkShow[];                       // shows created by the user
  edited: Record<number, TalkShow>;        // edits to shows from the base JSON
  deleted: number[];                       // base shows hidden by the user
};

const OVERRIDES_KEY = 'bankresaneh_overrides_v1';

function loadOverrides(): Overrides {
  if (typeof window === 'undefined') return { added: [], edited: {}, deleted: [] };
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return { added: [], edited: {}, deleted: [] };
    const o = JSON.parse(raw);
    return {
      added: Array.isArray(o.added) ? o.added : [],
      edited: o.edited && typeof o.edited === 'object' ? o.edited : {},
      deleted: Array.isArray(o.deleted) ? o.deleted : [],
    };
  } catch {
    return { added: [], edited: {}, deleted: [] };
  }
}

function saveOverrides(o: Overrides) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
  } catch {
    // Storage full or unavailable — silently ignore (edits stay in-memory only).
  }
}

// Merge base shows with the user's overrides: drop deleted ones, replace edited ones, prepend added ones.
function applyOverrides(base: TalkShow[], o: Overrides): TalkShow[] {
  const deleted = new Set(o.deleted);
  const out: TalkShow[] = [];
  for (const s of base) {
    if (deleted.has(s.num)) continue;
    out.push(o.edited[s.num] || s);
  }
  return [...o.added, ...out];
}

export default function Home() {
  return (
    <LangProvider>
      <HomeContent />
    </LangProvider>
  );
}

function HomeContent() {
  const { t, lang, setLang } = useLang();
  const [currentView, setCurrentView] = useState<'dashboard' | 'programs' | 'genre' | 'reports' | 'add'>('dashboard');
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [talkShows, setTalkShows] = useState<TalkShow[]>([]);
  // Base data (raw from JSON, never mutated) used to recompute the merged list.
  const [baseShows, setBaseShows] = useState<TalkShow[]>([]);
  // User changes persisted to localStorage so add/edit/delete survive a refresh.
  const [overrides, setOverrides] = useState<Overrides>({ added: [], edited: {}, deleted: [] });
  const [uploadedShows, setUploadedShows] = useState<number[]>([]);
  const [selectedShow, setSelectedShow] = useState<TalkShow | null>(null);
  const [editingShow, setEditingShow] = useState<TalkShow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publishShows, setPublishShows] = useState<TalkShow[] | null>(null);
  const [showBotConfig, setShowBotConfig] = useState(false);
  const [exportPreview, setExportPreview] = useState<{ shows: TalkShow[]; format: 'pdf' | 'excel' } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Ticker configuration modal (admin only) — choose which programs appear in the popular bar
  const [showTickerConfig, setShowTickerConfig] = useState(false);
  const [showAnalyticsConfig, setShowAnalyticsConfig] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const toggleLang = () => setLang(lang === 'fa' ? 'en' : 'fa');
  // Navigation history so every view can navigate back to the previous one
  const [viewStack, setViewStack] = useState<Array<{ view: typeof currentView; genre: Genre | null }>>([]);
  // Real authenticated user (null = logged out → show login screen)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Settings modal (admin only)
  const [showSettings, setShowSettings] = useState(false);
  // Profile sheet — compact contact-card style overlay (iPhone-contact-like)
  const [showProfile, setShowProfile] = useState(false);
  // User-created custom genres (persisted to localStorage) — merged with GENRES.
  const [customGenres, setCustomGenres] = useState<Genre[]>([]);
  // When the user clicks "+ افزودن برنامه" from inside a genre view, that genre's
  // Persian name is preset here so AddEditView's category field starts with it.
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined);
  // When AddEditView opens with a preset genre, its preset tags are offered as quick-adds.
  const [presetGenre, setPresetGenre] = useState<Genre | null>(null);

  // The full list of genres = default GENRES + user customGenres.
  const genres: Genre[] = useMemo(() => [...GENRES, ...customGenres], [customGenres]);

  // Role helpers — viewer is read-only (no add/edit/delete), admin can manage users + settings.
  const role = currentUser?.role || null;
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    // Load persisted overrides first, then merge them with the base JSON data.
    const saved = loadOverrides();
    setOverrides(saved);
    // Restore custom genres saved in a previous session.
    setCustomGenres(loadCustomGenres());
    fetch('/talk-shows-data.json')
      .then(r => r.json())
      .then((data: TalkShow[]) => {
        setBaseShows(data);
        setTalkShows(applyOverrides(data, saved));
      })
      .catch(e => console.error('Failed to load data:', e));
  }, []);

  // On mount: check if a token exists in localStorage, validate via /api/auth/me.
  // If valid → set currentUser (skip login). If invalid → clear token, show login.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bankresaneh_token') : null;
    if (!stored) {
      setAuthLoading(false);
      return;
    }
    api.getCurrentUser()
      .then((user) => setCurrentUser(user))
      .catch(() => {
        localStorage.removeItem('bankresaneh_token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Recompute the merged list whenever overrides change (e.g. after an edit).
  useEffect(() => {
    if (baseShows.length > 0) {
      setTalkShows(applyOverrides(baseShows, overrides));
    }
  }, [baseShows, overrides]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Persist a new set of overrides to state + localStorage in one place.
  const commitOverrides = (next: Overrides) => {
    setOverrides(next);
    saveOverrides(next);
  };

  // Add a brand-new show, or update an existing one (created/edited by the user).
  const handleSaveShow = (show: TalkShow, isEdit: boolean) => {
    if (isEdit) {
      const inAdded = overrides.added.find(s => s.num === show.num);
      const next: Overrides = inAdded
        ? { ...overrides, added: overrides.added.map(s => s.num === show.num ? show : s) }
        : { ...overrides, edited: { ...overrides.edited, [show.num]: show } };
      commitOverrides(next);
      showToast(`برنامه «${show.name}» بروزرسانی شد`);
    } else {
      commitOverrides({ ...overrides, added: [show, ...overrides.added] });
      showToast(`برنامه «${show.name}» اضافه شد`);
    }
  };

  // Delete a show (hides it from the list; user-added ones are removed outright).
  const handleDeleteShow = (num: number) => {
    const inAdded = overrides.added.find(s => s.num === num);
    const next: Overrides = inAdded
      ? { ...overrides, added: overrides.added.filter(s => s.num !== num) }
      : { ...overrides, deleted: Array.from(new Set([...overrides.deleted, num])) };
    commitOverrides(next);
    showToast('برنامه حذف شد');
  };

  // Push the current view onto the history stack, then go to `to`.
  const navigate = (to: typeof currentView, genre: Genre | null = null) => {
    setViewStack(prev => [...prev, { view: currentView, genre: selectedGenre }]);
    setCurrentView(to);
    setSelectedGenre(genre);
    setDrawerOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pop the history stack and restore the previous view (used by the back button).
  const goBack = () => {
    setViewStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setCurrentView(last.view);
      setSelectedGenre(last.genre);
      setDrawerOpen(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return prev.slice(0, -1);
    });
  };

  const canGoBack = viewStack.length > 0;

  const handleNavigate = (v: 'dashboard' | 'programs' | 'reports' | 'add') => {
    navigate(v, null);
  };

  const handleGenreSelect = (g: Genre) => {
    navigate('genre', g);
  };

  // User clicked "+ افزودن برنامه" from inside a genre view → preset the category
  // so AddEditView opens with this genre's Persian name already chosen.
  const handleAddFromGenre = (g: Genre) => {
    setPresetCategory(g.nameFa);
    setPresetGenre(g);
    setEditingShow(null);
    setViewStack(prev => [...prev, { view: currentView, genre: selectedGenre }]);
    setCurrentView('add');
    setSelectedGenre(null);
    setDrawerOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add a brand-new custom Genre to state + localStorage.
  const handleAddGenre = (g: Genre) => {
    const next = [...customGenres, g];
    setCustomGenres(next);
    saveCustomGenres(next);
    showToast(`ژانر «${g.nameFa}» اضافه شد`);
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    setCurrentUser(null);
    setDrawerOpen(false);
    // Reset navigation back to dashboard on logout.
    setCurrentView('dashboard');
    setSelectedGenre(null);
    setViewStack([]);
    setPresetCategory(undefined);
    setPresetGenre(null);
  };

  const handleLoginSuccess = (user: User) => {
    setAuthLoading(true);
    setCurrentUser(user);
    // Reload shows from API (or local JSON) after login
    fetch('/talk-shows-data.json')
      .then(r => r.json())
      .then(data => {
        setBaseShows(data);
        setTalkShows(applyOverrides(data, loadOverrides()));
      })
      .catch(e => console.error('Failed to load data:', e))
      .finally(() => setAuthLoading(false));
  };

  if (authLoading) {
    return (
      <div className="login-screen min-h-screen relative flex flex-col items-center justify-center">
        <div className="login-ambient-light green-1"></div>
        <div className="login-ambient-light green-2"></div>
        <div className="login-ambient-light green-3"></div>
        <div className="relative z-20 flex flex-col items-center" style={{ gap: '16px' }}>
          <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#34d399' }}></div>
          <span style={{ color: 'rgba(134, 239, 172, 0.85)', fontSize: '14px' }}>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="app-content min-h-screen">
      <TopAppBar
        onMenuClick={() => setDrawerOpen(true)}
        isMobile={isMobile}
        currentView={currentView}
        onBack={goBack}
        canGoBack={canGoBack}
      />

      <DrawerMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentView={currentView}
        onNavigate={handleNavigate}
        onGenreSelect={handleGenreSelect}
        onLogout={handleLogout}
        onOpenSettings={() => { setShowSettings(true); setDrawerOpen(false); }}
        onOpenProfile={() => { setShowProfile(true); setDrawerOpen(false); }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        canEdit={canEdit}
        talkShows={talkShows}
        genres={genres}
      />

      <main key={currentView} className={`main-with-mesh animate-view-enter ${isMobile ? 'px-2 pt-20 pb-28' : 'p-6 pt-20'}`}>
        {currentView === 'dashboard' && <Dashboard onGenreClick={(g) => navigate('genre', g)} talkShows={talkShows} uploadedCount={uploadedShows.length} onAdd={() => { setPresetCategory(undefined); setPresetGenre(null); setEditingShow(null); navigate('add'); }} canEdit={canEdit} isAdmin={isAdmin} genres={genres} onAddGenre={handleAddGenre} onShowClick={setSelectedShow} onConfigureTicker={isAdmin ? () => setShowTickerConfig(true) : undefined} onConfigureAnalytics={isAdmin ? () => setShowAnalyticsConfig(true) : undefined} />}
        {currentView === 'programs' && <ProgramsView talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} />}
        {currentView === 'genre' && selectedGenre && <ProgramsView genre={selectedGenre} talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} onAdd={() => handleAddFromGenre(selectedGenre)} onGenreSelect={(g) => navigate('genre', g)} allGenres={genres} />}
        {currentView === 'reports' && <ReportsView talkShows={talkShows} uploadedShows={uploadedShows} showToast={showToast} onExport={(shows, format) => setExportPreview({ shows, format })} />}
        {currentView === 'add' && canEdit && <AddEditView talkShows={talkShows} onSave={handleSaveShow} editingShow={editingShow} setEditingShow={setEditingShow} onDone={() => { setEditingShow(null); setSelectedGenre(null); setPresetCategory(undefined); setPresetGenre(null); setCurrentView('programs'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }} showToast={showToast} presetCategory={presetCategory} presetGenre={presetGenre} genres={genres} canEdit={canEdit} />}
        {currentView === 'add' && !canEdit && (
          <div className="premium-glass p-8 text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#dc2626' }}>دسترسی غیرمجاز</h2>
            <p style={{ color: '#5a6b4a' }}>شما اجازهٔ افزودن یا ویرایش برنامه‌ها را ندارید. برای دسترسی کامل با حساب مدیر یا ویراستار وارد شوید.</p>
          </div>
        )}
      </main>

      {isMobile && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={handleNavigate}
          onGenreSelect={handleGenreSelect}
          onLogout={handleLogout}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenProfile={() => setShowProfile(true)}
          canEdit={canEdit}
          talkShows={talkShows}
          genres={genres}
        />
      )}

      {/* Show details modal — pass talkShows so the modal can compute related programs */}
      {selectedShow && (
        <ShowDetailsModal
          show={selectedShow}
          allShows={talkShows}
          onClose={() => setSelectedShow(null)}
          onEdit={(s) => { setSelectedShow(null); setEditingShow(s); setPresetGenre(null); setPresetCategory(undefined); navigate('add'); }}
          onDelete={handleDeleteShow}
          onPublish={(s) => setPublishShows([s])}
          onExport={(s, fmt) => setExportPreview({ shows: [s], format: fmt })}
          isUploaded={uploadedShows.includes(selectedShow.num)}
          canEdit={canEdit}
          onSwapShow={(s) => setSelectedShow(s)}
        />
      )}

      {/* Publish to social media modal */}
      {publishShows && (
        <PublishModal
          shows={publishShows}
          onClose={() => setPublishShows(null)}
          onConfirm={(platform) => {
            showToast(`${publishShows.length.toLocaleString('fa-IR')} برنامه به ${platform} منتشر شد`);
            setPublishShows(null);
          }}
          onOpenBotConfig={() => setShowBotConfig(true)}
        />
      )}

      {/* Bot config modal (Telegram / Bale token + chat ID) */}
      {showBotConfig && (
        <BotConfigModal
          onClose={() => setShowBotConfig(false)}
          onSaved={() => { setShowBotConfig(false); showToast('تنظیمات ربات ذخیره شد'); }}
        />
      )}

      {/* Settings modal — system tabs only (server/users/password). */}
      {showSettings && currentUser && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          showToast={showToast}
          onLogout={handleLogout}
        />
      )}

      {/* Profile sheet — compact contact-card style overlay (iPhone-contact-like) */}
      {showProfile && currentUser && (
        <ProfileSheet
          currentUser={currentUser}
          onClose={() => setShowProfile(false)}
          showToast={showToast}
          onProfileUpdated={(u) => setCurrentUser(u)}
          onOpenSettings={() => { setShowProfile(false); setShowSettings(true); }}
        />
      )}

      {/* Ticker config modal (admin only) — select which programs appear in the popular bar */}
      {showTickerConfig && isAdmin && (
        <TickerConfigModal
          talkShows={talkShows}
          onClose={() => setShowTickerConfig(false)}
          showToast={showToast}
        />
      )}

      {showAnalyticsConfig && isAdmin && (
        <AnalyticsGenreConfigModal
          genres={genres.filter(g => g.id !== 'decor' && g.id !== 'with-images')}
          talkShows={talkShows}
          onClose={() => setShowAnalyticsConfig(false)}
          showToast={showToast}
        />
      )}

      {showVideoEditor && canEdit && (
        <VideoEditor
          onClose={() => setShowVideoEditor(false)}
          onSave={(blob, thumb, meta) => {
            showToast?.(`ویدیو ذخیره شد (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`);
            setShowVideoEditor(false);
          }}
          showToast={showToast}
        />
      )}

      {/* Export preview modal */}
      {exportPreview && (
        <ExportPreviewModal
          shows={exportPreview.shows}
          format={exportPreview.format}
          onClose={() => setExportPreview(null)}
          onDownload={() => {
            showToast(`گزارش ${exportPreview.format.toUpperCase()} دانلود شد`);
            setExportPreview(null);
          }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(13, 124, 74, 0.95)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(13, 124, 74, 0.4)',
            zIndex: 100,
            fontSize: '14px',
            fontWeight: 600,
            animation: 'fade-in 0.3s ease-out',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================
// LOGIN SCREEN — real auth (username + password)
// ============================================
function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const { t } = useLang();
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setIsReady(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!username.trim() || !password) {
      setError(t('login_error_required'));
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      onLogin(data.user);
    } catch (err: any) {
      setError(err?.message || t('login_error_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen min-h-screen relative flex flex-col items-center justify-center">
      <div className="login-ambient-light green-1"></div>
      <div className="login-ambient-light green-2"></div>
      <div className="login-ambient-light green-3"></div>

      <div
        className={`relative z-20 flex flex-col items-center px-8 transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Logo — gradient light beam sweeps ONLY across the logo pixels.
            The beam is masked to the logo's own shape via mask-image,
            so the "برق" appears only on the icon + "بانک رسانه" text. */}
        <div className="mb-10 flex justify-center">
          <div
            className="logo-shimmer"
            style={{ ['--logo-mask' as string]: 'url(/banke-rasane-logo.png)' }}
          >
            <Image
              src="/banke-rasane-logo.png"
              alt={t('banke_rasane')}
              width={300}
              height={200}
              priority
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '340px', margin: '0 auto' }}>
          {/* Username */}
          <div>
            <label htmlFor="login-username" className="block text-sm font-bold mb-1.5" style={{ color: 'rgba(134, 239, 172, 0.9)' }}>
              {t('login_username')}
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                borderRadius: '10px',
                padding: '9px 14px',
                color: '#1a2e1a',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                textAlign: 'left',
                direction: 'ltr',
                height: '38px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password with show/hide */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-bold mb-1.5" style={{ color: 'rgba(134, 239, 172, 0.9)' }}>
              {t('login_password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  borderRadius: '10px',
                  padding: '9px 42px 9px 14px',
                  color: '#1a2e1a',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  textAlign: 'left',
                  direction: 'ltr',
                  height: '38px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                disabled={loading}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#5a6b4a',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="p-3 rounded-xl text-sm font-medium animate-fade-in"
              style={{
                background: 'rgba(220, 38, 38, 0.18)',
                border: '1px solid rgba(220, 38, 38, 0.5)',
                color: '#fca5a5',
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Submit — green liquid-glass button (same .btn-enter-white class) */}
          <button
            type="submit"
            disabled={loading}
            className="btn-enter-white group"
            style={{ marginTop: '8px' }}
          >
            <span className="relative z-10 flex items-center gap-3 justify-center" style={{ color: '#ffffff' }}>
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#ffffff' }}></div>
                  <span>{t('login_submitting')}</span>
                </>
              ) : (
                <>
                  <span>{t('login_submit')}</span>
                  <svg
                    className="w-5 h-5 rtl-flip group-hover:-translate-x-1.5 transition-transform"
                    fill="none"
                    stroke="#ffffff"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </span>
          </button>
        </form>

        <div className="mt-10 text-center">
          <p style={{ color: 'rgba(134, 239, 172, 0.6)' }} className="text-xs tracking-wider">
            {t('login_version')}
          </p>
          <p style={{ color: 'rgba(134, 239, 172, 0.45)' }} className="text-xs mt-2">
            {t('login_default_label')}: <span dir="ltr">admin</span> / {t('login_password_label')}: <span dir="ltr">admin</span>
          </p>
        </div>
        {/* Language toggle */}
        <div className="mt-6 flex justify-center">
          <LanguageToggle variant="login" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// LANGUAGE TOGGLE — switches UI between Farsi (fa) and English (en).
// Shows "EN" when in Farsi mode (click → English),
// shows "فا" when in English mode (click → Farsi).
// Frosted-glass style that matches the teal header theme.
// ============================================
function LanguageToggle({ variant = 'header' }: { variant?: 'header' | 'login' }) {
  const { lang, setLang } = useLang();
  const isHeader = variant === 'header';
  return (
    <div
      dir="ltr"
      className="flex items-center rounded-full overflow-hidden flex-shrink-0 transition-all"
      style={{
        background: 'rgba(16, 58, 64, 0.55)',
        border: '1px solid rgba(85, 174, 183, 0.40)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        padding: '2px',
        gap: '1px',
        height: isHeader ? '28px' : '32px',
      }}
    >
      {/* فارسی button */}
      <button
        onClick={() => setLang('fa')}
        className="rounded-full font-bold transition-all flex items-center justify-center"
        style={{
          padding: '0 8px',
          fontSize: '11px',
          height: '100%',
          minWidth: '42px',
          background: lang === 'fa'
            ? 'linear-gradient(135deg, #00E5EF 0%, #00A6B5 100%)'
            : 'transparent',
          color: lang === 'fa' ? '#103A40' : 'rgba(244, 255, 255, 0.5)',
          boxShadow: lang === 'fa' ? '0 2px 8px rgba(0, 229, 239, 0.35)' : 'none',
          cursor: 'pointer',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        فارسی
      </button>
      {/* English button */}
      <button
        onClick={() => setLang('en')}
        className="rounded-full font-bold transition-all flex items-center justify-center"
        style={{
          padding: '0 8px',
          fontSize: '11px',
          height: '100%',
          minWidth: '36px',
          background: lang === 'en'
            ? 'linear-gradient(135deg, #00E5EF 0%, #00A6B5 100%)'
            : 'transparent',
          color: lang === 'en' ? '#103A40' : 'rgba(244, 255, 255, 0.5)',
          boxShadow: lang === 'en' ? '0 2px 8px rgba(0, 229, 239, 0.35)' : 'none',
          cursor: 'pointer',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        EN
      </button>
    </div>
  );
}

// ============================================
// THEME TOGGLE — sun/moon pill switch for light/dark mode
// ============================================
function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  if (!mounted) {
    // Render a placeholder to avoid hydration mismatch before the client
    // theme has been read from localStorage.
    return <div style={{ width: '36px', height: '36px' }} aria-hidden />;
  }
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
      title={isDark ? 'حالت روشن' : 'حالت تاریک'}
      dir="ltr"
      className="flex items-center rounded-full overflow-hidden flex-shrink-0 transition-all"
      style={{
        background: 'rgba(16, 58, 64, 0.55)',
        border: '1px solid rgba(85, 174, 183, 0.40)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        padding: '3px',
        height: '36px',
        width: '64px',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Sliding knob */}
      <span
        style={{
          position: 'absolute',
          top: '3px',
          insetInlineStart: isDark ? '3px' : '31px',
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
            : 'linear-gradient(135deg, #00E5EF 0%, #00A6B5 100%)',
          boxShadow: isDark
            ? '0 2px 10px rgba(52, 211, 153, 0.5)'
            : '0 2px 10px rgba(0, 229, 239, 0.45)',
          transition: 'inset-inline-start 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#0a1f14' : '#103A40',
        }}
      >
        {isDark ? (
          // Moon icon
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73A8.15 8.15 0 0 1 9.08 5.49a8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36 10.14 10.14 0 1 0 22 14.05a1 1 0 0 0-.36-1.05z" />
          </svg>
        ) : (
          // Sun icon
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ============================================
// TOP APP BAR — fixed at top, hamburger (3-line) on the right,
// logo + title in the center, visible on BOTH desktop and mobile
// ============================================
function TopAppBar({ onMenuClick, isMobile, currentView, onBack, canGoBack }: {
  onMenuClick: () => void;
  isMobile: boolean;
  currentView: string;
  onBack: () => void;
  canGoBack: boolean;
}) {
  const { t } = useLang();
  const viewTitles: Record<string, string> = {
    dashboard: t('view_dashboard'),
    programs: t('view_programs'),
    genre: t('view_genre'),
    reports: t('view_reports'),
    add: t('view_add'),
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 header-liquid-glass"
      style={{
        background: 'rgba(16, 58, 64, 0.72)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderBottom: '1px solid rgba(85, 174, 183, 0.55)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 18px 45px rgba(8, 40, 45, 0.28)',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          padding: isMobile ? '12px 16px' : '14px 28px',
          minHeight: '64px',
          gap: '12px',
        }}
      >
        {/* Hamburger button — 3 lines — opens the drawer from the right */}
        <button
          onClick={onMenuClick}
          aria-label={t('open_menu')}
          className="flex flex-col justify-center items-center p-2.5 rounded-xl transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.10)',
            border: '1px solid rgba(220, 250, 248, 0.25)',
            color: '#F4FFFF',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18)',
            minWidth: '44px',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.20)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.10)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: logo + title */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0"
          style={{ justifyContent: 'center' }}
        >
          <Image
            src="/banke-rasane-logo.png"
            alt={t('banke_rasane')}
            width={isMobile ? 120 : 180}
            height={isMobile ? 40 : 54}
            priority
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(13, 124, 74, 0.25))',
              flexShrink: 0,
              width: 'auto',
              height: isMobile ? '40px' : '52px',
              maxWidth: isMobile ? '140px' : '200px',
              objectFit: 'contain',
            }}
          />
          {!isMobile && (
            <div
              className="flex flex-col"
              style={{ borderRight: '1px solid rgba(13, 124, 74, 0.15)', paddingRight: '12px' }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '15px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>
                {viewTitles[currentView] || t('banke_rasane')}
              </span>
              <span style={{ color: '#8a8a7a', fontSize: '11px', marginTop: '2px' }}>
                {t('version_short')}
              </span>
            </div>
          )}
        </div>

        {/* Left placeholder: back button (when there is history), else status badge */}
        <div style={{ minWidth: '44px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          <LanguageToggle variant="header" />
          <ThemeToggle />
          {canGoBack ? (
            <button
              onClick={onBack}
              aria-label={t('back_aria')}
              title={t('back_aria')}
              className="flex items-center gap-2 rounded-xl transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(13, 124, 74, 0.25)',
                color: '#0d7c4a',
                padding: isMobile ? '9px 12px' : '9px 16px',
                boxShadow: '0 2px 8px rgba(13, 124, 74, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
                minWidth: '44px',
                minHeight: '44px',
                fontWeight: 700,
                fontSize: '14px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {!isMobile && <span>{t('back')}</span>}
            </button>
          ) : isMobile ? (
            null
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{
                background: 'rgba(13, 124, 74, 0.08)',
                border: '1px solid rgba(13, 124, 74, 0.15)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              ></span>
              <span style={{ color: '#5a6b4a', fontSize: '12px' }}>{t('connected')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframe for pulse — scoped to top bar */}
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
    </header>
  );
}

// ============================================
// DRAWER MENU — slide-out from the right side
// Shared between desktop and mobile, opened by TopAppBar's hamburger
// ============================================
function DrawerMenu({
  open,
  onClose,
  currentView,
  onNavigate,
  onGenreSelect,
  onLogout,
  onOpenSettings,
  onOpenProfile,
  currentUser,
  isAdmin,
  canEdit,
  talkShows,
  genres = GENRES,
}: {
  open: boolean;
  onClose: () => void;
  currentView: string;
  onNavigate: (v: 'dashboard' | 'programs' | 'reports' | 'add') => void;
  onGenreSelect: (g: Genre) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  currentUser: User | null;
  isAdmin: boolean;
  canEdit: boolean;
  talkShows: TalkShow[];
  genres?: Genre[];
}) {
  const [genresExpanded, setGenresExpanded] = useState(true);
  const { t, lang } = useLang();

  const navItems = [
    { key: 'dashboard', label: t('nav_dashboard'), icon: 'home', desc: t('nav_dashboard_desc') },
    { key: 'programs', label: t('nav_programs'), icon: 'grid', desc: t('nav_programs_desc') },
    { key: 'add', label: t('nav_add'), icon: 'plus', desc: t('nav_add_desc'), canEdit: true },
    { key: 'reports', label: t('nav_reports'), icon: 'reports', desc: t('nav_reports_desc') },
  ] as const;

  // Don't render anything if not open — keeps DOM clean
  if (!open) return null;

  const roleLabel: Record<string, string> = {
    admin: t('role_admin'),
    editor: t('role_editor'),
    viewer: t('role_viewer'),
  };

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <aside
        className="fixed top-0 right-0 bottom-0 animate-drawer-slide-in flex flex-col drawer-premium drawer-liquid-glass"
        style={{
          width: 'min(360px, 90vw)',
          background: 'rgba(10, 36, 40, 0.85)',
          backdropFilter: 'blur(22px) saturate(160%)',
          WebkitBackdropFilter: 'blur(22px) saturate(160%)',
          borderLeft: '1px solid rgba(85, 174, 183, 0.55)',
          boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.32), -20px 0 64px rgba(8, 40, 45, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative emerald glow at top */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -60, right: -40,
            width: 240, height: 240,
            background: 'radial-gradient(circle, rgba(85, 174, 183, 0.22) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 80, right: -60,
            width: 220, height: 220,
            background: 'radial-gradient(circle, rgba(23, 108, 120, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Drawer header — teal glass strip matching header + logo + close */}
        <div
          className="p-4 flex items-center justify-between flex-shrink-0 relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(85, 174, 183, 0.18) 0%, rgba(23, 108, 120, 0.10) 100%)',
            borderBottom: '1px solid rgba(85, 174, 183, 0.35)',
          }}
        >
          <Image
            src="/banke-rasane-logo.png"
            alt={t('banke_rasane')}
            width={180}
            height={48}
            priority
            style={{ filter: 'drop-shadow(0 2px 12px rgba(85, 174, 183, 0.4))', width: 'auto', height: '44px', maxWidth: '180px', objectFit: 'contain' }}
          />
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all relative z-20"
            style={{
              color: '#CDEFEF',
              background: 'rgba(85, 174, 183, 0.12)',
              border: '1px solid rgba(85, 174, 183, 0.35)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.18)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(85, 174, 183, 0.12)'; e.currentTarget.style.color = '#CDEFEF'; e.currentTarget.style.borderColor = 'rgba(85, 174, 183, 0.35)'; }}
            title={t('close_menu')}
            aria-label={t('close_menu')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation + genres (scrollable) */}
        <nav
          className="flex-1 overflow-y-auto p-3 relative z-10"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="space-y-1">
            {navItems.filter((item) => !('canEdit' in item) || canEdit).map((item) => {
              const isActive = currentView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key as any)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-right relative"
                  style={isActive ? {
                    background: 'linear-gradient(135deg, rgba(85, 174, 183, 0.25) 0%, rgba(23, 108, 120, 0.15) 100%)',
                    border: '1px solid rgba(85, 174, 183, 0.50)',
                    color: '#00E5EF',
                    boxShadow: '0 4px 18px rgba(85, 174, 183, 0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
                  } : {
                    border: '1px solid transparent',
                    color: '#F4FFFF',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(85, 174, 183, 0.15)';
                      e.currentTarget.style.color = '#00E5EF';
                      e.currentTarget.style.borderColor = 'rgba(85, 174, 183, 0.30)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#F4FFFF';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  {/* Active accent stripe */}
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        right: 0, top: '18%', bottom: '18%',
                        width: 3,
                        borderRadius: 3,
                        background: 'linear-gradient(180deg, #00E5EF, #55AEB7)',
                        boxShadow: '0 0 12px rgba(0, 229, 239, 0.8)',
                      }}
                    />
                  )}
                  <NavIcon name={item.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: 'inherit' }}>{item.label}</div>
                    <div className="text-xs" style={{ color: isActive ? 'rgba(205, 239, 237, 0.85)' : 'rgba(205, 239, 237, 0.55)', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Genres section */}
          <div className="mt-6">
            <button
              onClick={() => setGenresExpanded(!genresExpanded)}
              className="flex items-center justify-between w-full px-3 mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: '#55AEB7' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 6, background: '#00E5EF', boxShadow: '0 0 10px rgba(0, 229, 239, 0.9)' }} />
                {t('genres_section')} ({genres.length})
              </span>
              <svg
                className="w-4 h-4 transition-transform"
                style={{ transform: genresExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {genresExpanded && (
              <div className="space-y-0.5 animate-fade-in-up">
                {genres.map((g) => {
                  const count = talkShows.filter(g.filterFn).length;
                  return (
                    <button
                      key={g.id}
                      onClick={() => onGenreSelect(g)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all group w-full"
                      style={{ color: '#F4FFFF' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${g.color}30`;
                        e.currentTarget.style.color = g.color;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#F4FFFF';
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                        style={{
                          backgroundColor: g.color,
                        }}
                      ></div>
                      <span className="text-sm flex-1 text-right truncate font-medium">{genreName(g, lang)}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: g.color }}
                      >
                        {count.toLocaleString('fa-IR')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* User info + settings + logout footer */}
        <div
          className="p-3 flex-shrink-0 relative z-10"
          style={{ borderTop: '1px solid rgba(85, 174, 183, 0.35)' }}
        >
          {currentUser && (
            <div
              className="mb-2 p-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(85, 174, 183, 0.18) 0%, rgba(23, 108, 120, 0.10) 100%)',
                border: '1px solid rgba(85, 174, 183, 0.30)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #00E5EF 0%, #176C78 100%)',
                    color: '#103A40',
                    border: '1px solid rgba(0, 229, 239, 0.6)',
                    fontWeight: 700,
                    fontSize: '14px',
                    boxShadow: '0 4px 16px rgba(0, 229, 239, 0.35)',
                  }}
                >
                  {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: '#F4FFFF' }} title={currentUser.username}>
                    {currentUser.name || currentUser.username}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                      style={{
                        background: currentUser.role === 'admin' ? 'rgba(220, 38, 38, 0.25)' : currentUser.role === 'editor' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0, 229, 239, 0.25)',
                        color: currentUser.role === 'admin' ? '#fca5a5' : currentUser.role === 'editor' ? '#fcd34d' : '#00E5EF',
                      }}
                    >
                      {roleLabel[currentUser.role] || currentUser.role}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(205, 239, 237, 0.6)' }} dir="ltr">
                      @{currentUser.username}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile button — opens the profile sheet (iPhone-contact-style overlay) */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full mb-1"
            style={{ color: '#F4FFFF' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)';
              e.currentTarget.style.color = '#34d399';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#F4FFFF';
            }}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-bold text-sm">پروفایل من</span>
          </button>

          {/* Settings button — visible to all logged-in users */}
          {(
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full mb-1"
              style={{ color: '#F4FFFF' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(85, 174, 183, 0.18)';
                e.currentTarget.style.color = '#00E5EF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#F4FFFF';
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-bold text-sm">{t('settings')}</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full"
            style={{ color: '#F4FFFF' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.18)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#F4FFFF';
            }}
          >
            <NavIcon name="exit" />
            <span className="font-bold text-sm">{t('logout')}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactElement> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    reports: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    profile: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    exit: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  };
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name] || icons.home}
    </svg>
  );
}

// ============================================
// MOBILE BOTTOM NAV
// (the drawer menu is now shared & owned by the App level —
//  the bottom nav's "menu" button just calls onOpenDrawer)
// ============================================
function MobileBottomNav({
  currentView,
  onNavigate,
  onGenreSelect,
  onLogout,
  onOpenDrawer,
  onOpenProfile,
  canEdit,
  talkShows,
  genres = GENRES,
}: {
  currentView: string;
  onNavigate: (v: 'dashboard' | 'programs' | 'reports' | 'add') => void;
  onGenreSelect: (g: Genre) => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
  onOpenProfile: () => void;
  canEdit: boolean;
  talkShows: TalkShow[];
  genres?: Genre[];
}) {
  const [showGenres, setShowGenres] = useState(false);
  const { t, lang } = useLang();

  return (
    <>
      {showGenres && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowGenres(false)}
        >
          <div
            className="fixed bottom-0 left-0 right-0 p-4 animate-slide-up-nav"
            style={{
              background: 'rgba(10, 36, 40, 0.85)',
              backdropFilter: 'blur(22px) saturate(160%)',
              WebkitBackdropFilter: 'blur(22px) saturate(160%)',
              borderTop: '1px solid rgba(85, 174, 183, 0.55)',
              borderRadius: '24px 24px 0 0',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 -18px 45px rgba(8, 40, 45, 0.28)',
              paddingBottom: '32px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: '#F4FFFF' }}>{t('genres_section')} ({genres.length})</h3>
              <button
                onClick={() => setShowGenres(false)}
                className="p-2 rounded-lg"
                style={{ color: '#CDEFEF', background: 'rgba(85, 174, 183, 0.15)', border: '1px solid rgba(85, 174, 183, 0.35)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {genres.map((g) => {
                const count = talkShows.filter(g.filterFn).length;
                return (
                  <button
                    key={g.id}
                    onClick={() => { onGenreSelect(g); setShowGenres(false); }}
                    className="p-3 rounded-2xl text-right transition-all"
                    style={{
                      background: 'rgba(205, 239, 237, 0.10)',
                      border: '1px solid rgba(220, 250, 248, 0.20)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${g.color}30`,
                          color: g.color,
                          border: `1px solid ${g.color}50`,
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: '#F4FFFF' }}>{genreName(g, lang)}</div>
                        <div className="text-xs font-bold" style={{ color: g.color }}>
                          {count.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('programs_short')}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3">
        <div
          className="flex items-center justify-around no-scrollbar nav-liquid-glass"
          style={{
            background: 'rgba(16, 58, 64, 0.72)',
            backdropFilter: 'blur(22px) saturate(160%)',
            WebkitBackdropFilter: 'blur(22px) saturate(160%)',
            border: '1px solid rgba(85, 174, 183, 0.55)',
            borderRadius: '22px',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 18px 45px rgba(8, 40, 45, 0.28)',
            padding: '8px',
          }}
        >
          <MobileNavBtn label={t('mobile_menu')} icon="menu" active={false} onClick={onOpenDrawer} highlight />
          <MobileNavBtn label={t('mobile_archive')} icon="home" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          <MobileNavBtn label={t('mobile_programs')} icon="grid" active={currentView === 'programs'} onClick={() => onNavigate('programs')} />
          <MobileNavBtn label={t('mobile_genres')} icon="genre" active={showGenres} onClick={() => setShowGenres(!showGenres)} highlight />
          {canEdit && (
            <MobileNavBtn label={t('mobile_add')} icon="plus" active={currentView === 'add'} onClick={() => onNavigate('add')} />
          )}
          <MobileNavBtn label="پروفایل" icon="user" active={false} onClick={onOpenProfile} />
          <MobileNavBtn label={t('mobile_logout')} icon="exit" active={false} onClick={onLogout} />
        </div>
      </nav>
    </>
  );
}

function MobileNavBtn({ label, icon, active, onClick, highlight }: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all"
      style={{
        background: active ? 'rgba(16, 185, 129, 0.20)' : 'transparent',
        border: active ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid transparent',
        minWidth: '44px',
        flex: '1 1 0',
      }}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke={active ? '#34d399' : highlight ? '#6ee7b7' : '#a7f3d0'}
        viewBox="0 0 24 24"
        style={{ filter: active ? 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.5))' : 'none' }}
      >
        {icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
        {icon === 'grid' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
        {icon === 'genre' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
        {icon === 'plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
        {icon === 'exit' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
        {icon === 'menu' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
        {icon === 'user' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
      </svg>
      <span className="text-[10px] font-medium leading-tight" style={{ color: active ? '#10b981' : highlight ? '#0d7c4a' : '#8a8a7a' }}>
        {label}
      </span>
    </button>
  );
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ onGenreClick, talkShows, uploadedCount, onAdd, canEdit, isAdmin, genres = GENRES, onAddGenre, onShowClick, onConfigureTicker, onConfigureAnalytics }: {
  onGenreClick: (g: Genre) => void;
  talkShows: TalkShow[];
  uploadedCount: number;
  onAdd: () => void;
  canEdit: boolean;
  isAdmin?: boolean;
  genres?: Genre[];
  onAddGenre?: (g: Genre) => void;
  onShowClick?: (s: TalkShow) => void;
  onConfigureTicker?: () => void;
  onConfigureAnalytics?: () => void;
}) {
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(3);
  const { t, lang } = useLang();

  // --- Popular shows for the ticker bar ---
  // Read admin-selected program IDs from localStorage; fall back to top-by-viewers
  const [pinnedTickerIds, setPinnedTickerIds] = useState<number[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('tickerPinnedIds');
      if (raw) setPinnedTickerIds(JSON.parse(raw));
    } catch {}
    const handler = () => {
      try {
        const raw = localStorage.getItem('tickerPinnedIds');
        setPinnedTickerIds(raw ? JSON.parse(raw) : []);
      } catch {}
    };
    window.addEventListener('ticker-pinned-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('ticker-pinned-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Pick shows that have images, sorted by viewers metric (parsed from string)
  const parseViewers = (v: string) => {
    const m = (v || '').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  };
  const showsWithImages = talkShows.filter(s => s.images && s.images.length > 0);
  const pinnedShows = pinnedTickerIds.length > 0
    ? pinnedTickerIds
        .map(id => showsWithImages.find(s => s.num === id))
        .filter((s): s is TalkShow => !!s)
    : showsWithImages
        .slice()
        .sort((a, b) => parseViewers(b.viewers) - parseViewers(a.viewers))
        .slice(0, 14);
  const popularShows = pinnedShows.length > 0 ? pinnedShows : showsWithImages.slice(0, 14);
  // Duplicate the list for seamless infinite scroll
  const tickerShows = [...popularShows, ...popularShows];

  // --- Analytics data: top genres by program count + donut segments ---
  // Exclude the catch-all "decor" (all programs) and "with-images" type pseudo-genres
  const realGenres = genres.filter(g => g.id !== 'decor' && g.id !== 'with-images');
  const genreCounts = realGenres
    .map(g => ({ genre: g, count: talkShows.filter(g.filterFn).length }))
    .sort((a, b) => b.count - a.count);

  // Read admin-selected genre IDs for analytics from localStorage
  const [analyticsSelectedIds, setAnalyticsSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('analyticsGenreIds');
      if (raw) setAnalyticsSelectedIds(JSON.parse(raw));
    } catch {}
    const handler = () => {
      try {
        const raw = localStorage.getItem('analyticsGenreIds');
        setAnalyticsSelectedIds(raw ? JSON.parse(raw) : []);
      } catch {}
    };
    window.addEventListener('analytics-genres-changed', handler);
    return () => window.removeEventListener('analytics-genres-changed', handler);
  }, []);

  // If admin selected specific genres, use those; otherwise use top 5 by count
  const selectedGenres = analyticsSelectedIds.length > 0
    ? analyticsSelectedIds
        .map(id => genreCounts.find(x => x.genre.id === id))
        .filter((x): x is { genre: Genre; count: number } => !!x)
    : genreCounts.slice(0, 5);

  const topGenres = selectedGenres;
  const donutSegments = topGenres.map(x => ({ color: x.genre.color, value: x.count, label: x.genre.nameFa }));
  const totalShows = talkShows.length;
  const uploadedShows = uploadedCount;
  const withImagesCount = talkShows.filter(s => s.images && s.images.length > 0).length;
  const recentCount = talkShows.filter(s => s.num && s.num > totalShows - 20).length;
  // Number of genres that have a source PDF file available for download.
  const pdfSourcesCount = genres.filter(g => GENRE_PDF_MAP[g.id]).length;

  // Each genre uses its own color for donut segment
  const donutColors = topGenres.map(x => x.genre.color);
  const otherColor = '#8EADAE';

  // SVG donut geometry — with small gaps between segments for a refined look
  const donutSize = 200;
  const donutStroke = 32;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const gapDeg = donutSegments.length > 1 ? 2.5 : 0; // angular gap between segments in degrees
  const gapArc = (gapDeg / 360) * donutCircumference;
  let cumulativeOffset = 0;
  const donutPaths = donutSegments.map((seg, i) => {
    // Guard against division by zero (totalShows === 0) which would produce NaN
    // and propagate it to strokeDasharray / strokeDashoffset attributes.
    const fraction = totalShows > 0 ? seg.value / totalShows : 0;
    const dashLength = Math.max(fraction * donutCircumference - gapArc, 2);
    const color = i < donutColors.length ? donutColors[i] : otherColor;
    const path = {
      color,
      strokeDasharray: `${dashLength} ${donutCircumference - dashLength}`,
      strokeDashoffset: -cumulativeOffset + gapArc / 2,
      delay: i * 130,
    };
    cumulativeOffset += dashLength + gapArc;
    return path;
  });

  return (
    <>
      {/* Rich analytics card — donut chart + ranked genre list (replaces 4 small stat cards) */}
      <div className="analytics-card animate-card-enter mb-3">
        {/* Decorative glow */}
        <div aria-hidden className="analytics-card-glow" />

        {/* Header row — title is INSIDE the card (removes dead space above) */}
        <div className="analytics-card-header">
          <div className="analytics-card-header-left">
            <div>
              <div className="analytics-card-eyebrow">
                <span>{t('analytics_card_eyebrow')}</span>
                <span className="analytics-card-brand-pill">{t('banke_rasane')}</span>
              </div>
              <h1 className="analytics-card-title">{t('analytics_card_title')}</h1>
              <p className="analytics-card-subtitle">
                {t('analytics_card_subtitle', [talkShows.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US'), genres.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')])}
              </p>
            </div>
            {isAdmin && onConfigureAnalytics && (
              <button onClick={onConfigureAnalytics} className="ticker-config-btn" title={t('analytics_select_genres_title')}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m-6 4h6" />
                </svg>
                <span>{t('analytics_select_genres')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Body: donut (left) + ranked list (right) */}
        <div className="analytics-card-body">
          {/* Donut column */}
          <div className="analytics-donut-col">
            <div className="analytics-donut-wrap">
              <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`} className="analytics-donut-svg">
                {/* Background track */}
                <circle
                  cx={donutSize / 2} cy={donutSize / 2} r={donutRadius}
                  fill="none"
                  stroke="rgba(13, 124, 74, 0.07)"
                  strokeWidth={donutStroke}
                />
                {/* Segments */}
                {donutPaths.map((p, i) => (
                  <circle
                    key={i}
                    cx={donutSize / 2} cy={donutSize / 2} r={donutRadius}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={donutStroke}
                    strokeDasharray={p.strokeDasharray}
                    strokeDashoffset={p.strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                    style={{
                      filter: `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))`,
                      animation: `donut-segment-grow 0.9s cubic-bezier(0.4,0,0.2,1) ${p.delay}ms both`,
                    }}
                  />
                ))}
              </svg>
              {/* Center content */}
              <div className="analytics-donut-center">
                <div className="analytics-donut-center-num">{totalShows.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
                <div className="analytics-donut-center-label">{t('total_programs_count')}</div>
                <div className="analytics-donut-center-growth">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {withImagesCount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('programs_with_images')}
                </div>
              </div>
            </div>

            {/* Mini stats row below donut — monochrome emerald with varied opacity */}
            <div className="analytics-mini-row">
              <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#00E6A0' }}>
                <div className="analytics-mini-num">{pdfSourcesCount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
                <div className="analytics-mini-label">{t('mini_pdf_sources')}</div>
              </div>
              <div className="analytics-mini-divider" />
              <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#00E5EF' }}>
                <div className="analytics-mini-num">{withImagesCount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
                <div className="analytics-mini-label">{t('mini_with_images')}</div>
              </div>
              <div className="analytics-mini-divider" />
              <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#FFD34E' }}>
                <div className="analytics-mini-num">{genres.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
                <div className="analytics-mini-label">{t('mini_genres')}</div>
              </div>
            </div>
          </div>

          {/* Ranked genre list column — uses emerald shades matching the donut */}
          <div className="analytics-list-col">
            <div className="analytics-list-header">
              <span>{t('top_genres_list')}</span>
              <span className="analytics-list-header-count">{t('top_genres_count', [realGenres.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')])}</span>
            </div>
            <div className="analytics-list-items">
              {topGenres.map((x, i) => {
                const pct = Math.round((x.count / totalShows) * 100);
                const shadeColor = donutColors[i] || '#10b981';
                return (
                  <button
                    key={x.genre.id}
                    onClick={() => onGenreClick(x.genre)}
                    className="analytics-list-row"
                    style={{ ['--row-color' as string]: shadeColor }}
                  >
                    <span className="analytics-list-rank">{(i + 1).toLocaleString('fa-IR')}</span>
                    <span className="analytics-list-dot" />
                    <span className="analytics-list-name">{genreName(x.genre, lang)}</span>
                    <div className="analytics-list-bar-wrap">
                      <div
                        className="analytics-list-bar"
                        style={{ width: `${pct}%`, animation: `bar-grow 0.8s ease-out ${i * 100 + 300}ms both` }}
                      />
                    </div>
                    <span className="analytics-list-count">{x.count.toLocaleString('fa-IR')}</span>
                    <span className="analytics-list-pct">{pct.toLocaleString('fa-IR')}٪</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Showcase Carousel — Cover Flow (3D perspective) + Netflix (arrow nav) */}
      {onShowClick && popularShows.length > 0 && (
        <div className="showcase-section mb-6">
          <div className="ticker-header">
            <span className="ticker-title">
              <span className="ticker-pulse-dot" />
              {pinnedTickerIds.length > 0 ? t('showcase_admin_pick') : t('showcase_popular')}
            </span>
            <div className="ticker-header-right">
              <span className="ticker-subtitle">{t('showcase_subtitle')}</span>
              {onConfigureTicker && (
                <button onClick={onConfigureTicker} className="ticker-config-btn" title={t('showcase_select')}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{t('showcase_select')}</span>
                </button>
              )}
            </div>
          </div>
          <div className="showcase-carousel" style={{ perspective: '1200px' }}>
            {/* Left arrow button */}
            <button
              className="showcase-arrow showcase-arrow-left"
              onClick={() => setCarouselIndex(prev => (prev - 1 + popularShows.length) % popularShows.length)}
              aria-label={t('showcase_prev')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {/* Cards with 3D perspective */}
            <div className="showcase-stage">
              {popularShows.map((s, i) => {
                const offset = i - carouselIndex;
                const absOffset = Math.abs(offset);
                const isActive = absOffset === 0;
                // Calculate 3D transform based on offset
                const translateX = offset * 145;
                const translateZ = isActive ? 60 : -Math.min(absOffset * 40, 160);
                const rotateY = offset * -18;
                const scale = isActive ? 1.12 : Math.max(0.7, 1 - absOffset * 0.12);
                const opacity = absOffset > 3 ? 0 : isActive ? 1 : Math.max(0.25, 1 - absOffset * 0.28);
                const zIndex = 100 - absOffset;
                return (
                  <button
                    key={s.num}
                    onClick={() => {
                      if (isActive) onShowClick(s);
                      else setCarouselIndex(i);
                    }}
                    className={`showcase-card ${isActive ? 'showcase-card-active' : ''}`}
                    style={{
                      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                      opacity,
                      zIndex,
                      filter: isActive ? 'none' : `blur(${Math.min(absOffset * 1.5, 4)}px)`,
                    }}
                    title={s.name}
                  >
                    <div className="showcase-thumb">
                      <Image
                        src={s.images![0]}
                        alt={s.name}
                        width={180}
                        height={108}
                        style={{ objectFit: 'cover' }}
                        unoptimized
                      />
                      <div className="showcase-overlay" />
                      <div className="showcase-glass-edge" />
                      {isActive && (
                        <span className="showcase-play">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </span>
                      )}
                      <div className="showcase-name">{s.name}</div>
                    </div>
                    {isActive && (
                      <div className="showcase-info">
                        <span className="showcase-viewers">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          {s.viewers}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Right arrow button */}
            <button
              className="showcase-arrow showcase-arrow-right"
              onClick={() => setCarouselIndex(prev => (prev + 1) % popularShows.length)}
              aria-label={t('showcase_next')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* Dots indicator */}
          <div className="showcase-dots">
            {popularShows.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIndex(i)}
                className={`showcase-dot ${i === carouselIndex ? 'showcase-dot-active' : ''}`}
                aria-label={t('program_aria_n', [String(i + 1)])}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#F4FFFF' }}>{t('genres_title')}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onAddGenre && (
            <button
              onClick={() => setShowAddGenre(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              style={{
                background: 'rgba(16, 185, 129, 0.20)',
                color: '#6ee7b7',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('add_genre_btn')}
            </button>
          )}
          {canEdit && (
            <button
              onClick={onAdd}
              className="btn-enter-premium text-sm"
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              {t('add_program_btn')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {genres.map((g, idx) => {
          const count = talkShows.filter(g.filterFn).length;
          return (
            <button
              key={g.id}
              onClick={() => onGenreClick(g)}
              className="premium-genre-card animate-card-enter text-right"
              style={{
                animationDelay: `${idx * 50}ms`,
                ['--genre-color' as string]: g.color,
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const cx = rect.width / 2;
                const cy = rect.height / 2;
                const rotY = ((x - cx) / cx) * 8;
                const rotX = ((cy - y) / cy) * 8;
                e.currentTarget.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.02)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
              }}
            >
              <div className="genre-shine" aria-hidden />
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${g.color}30`,
                    color: g.color,
                    border: `1px solid ${g.color}80`,
                    backdropFilter: 'blur(8px)',
                    boxShadow: `0 0 20px ${g.color}60`,
                  }}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-4xl font-black" style={{ color: '#ffffff' }}>
                    {count.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{t('programs_short')}</div>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1" style={{ color: '#ffffff' }}>{genreName(g, lang)}</h3>
              <p className="text-sm mt-3" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>{genreDescription(g, lang)}</p>
              <div className="mt-4 flex items-center text-sm font-bold" style={{ color: g.color }}>
                {t('view_and_search')}
                <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {showAddGenre && onAddGenre && (
        <AddGenreModal
          onClose={() => setShowAddGenre(false)}
          onSave={(g) => { onAddGenre(g); setShowAddGenre(false); }}
        />
      )}
    </>
  );
}

// ============================================================
// TICKER CONFIG MODAL — admin selects which programs appear in the liquid-glass ticker
// Selection is persisted to localStorage('tickerPinnedIds') and broadcast via custom event
// ============================================================
function TickerConfigModal({ talkShows, onClose, showToast }: {
  talkShows: TalkShow[];
  onClose: () => void;
  showToast?: (msg: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [showOnlyWithImages, setShowOnlyWithImages] = useState(true);
  const { t, lang } = useLang();

  // Load current selection from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tickerPinnedIds');
      if (raw) setSelected(JSON.parse(raw));
    } catch {}
  }, []);

  const filteredShows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = talkShows;
    if (showOnlyWithImages) list = list.filter(s => s.images && s.images.length > 0);
    if (q) list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.descriptionFa || '').toLowerCase().includes(q)
    );
    return list.slice(0, 200); // limit for performance
  }, [talkShows, search, showOnlyWithImages]);

  const toggleShow = (num: number) => {
    setSelected(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handleSave = () => {
    try {
      localStorage.setItem('tickerPinnedIds', JSON.stringify(selected));
      // broadcast to dashboard to refresh
      window.dispatchEvent(new Event('ticker-pinned-changed'));
      showToast?.(selected.length > 0
        ? t('n_programs_ticker', [selected.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')])
        : t('ticker_auto_restored'));
      onClose();
    } catch (e) {
      showToast?.(t('error_saving_settings'));
    }
  };

  const handleClear = () => {
    setSelected([]);
    localStorage.removeItem('tickerPinnedIds');
    window.dispatchEvent(new Event('ticker-pinned-changed'));
    showToast?.(t('ticker_auto_restored_short'));
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.12)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #10b981 0%, #0d7c4a 100%)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#052e1b' }}>{t('ticker_title')}</h2>
              <p className="text-xs" style={{ color: '#6b7d5e' }}>{t('ticker_desc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + count */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search_ticker_ph')}
              className="flex-1 px-3 py-2 rounded-xl text-sm"
              style={{
                border: '1px solid rgba(13, 124, 74, 0.2)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#1a3a26',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#5a6b4e' }}>
              <input
                type="checkbox"
                checked={showOnlyWithImages}
                onChange={(e) => setShowOnlyWithImages(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              {t('only_with_images')}
            </label>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: '#6b7d5e' }}>
            <span>{selected.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('selected_count')}</span>
            <span>{filteredShows.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('results_count')}</span>
          </div>
        </div>

        {/* List */}
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredShows.map((s) => {
              const isSel = selected.includes(s.num);
              return (
                <button
                  key={s.num}
                  onClick={() => toggleShow(s.num)}
                  className="flex items-center gap-3 p-2 rounded-xl transition-all text-right"
                  style={{
                    background: isSel ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.6)',
                    border: `1px solid ${isSel ? 'rgba(16, 185, 129, 0.4)' : 'rgba(13, 124, 74, 0.1)'}`,
                  }}
                >
                  {s.images && s.images[0] ? (
                    <Image
                      src={s.images[0]}
                      alt={s.name}
                      width={44}
                      height={44}
                      style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                      unoptimized
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13, 124, 74, 0.08)', color: '#0d7c4a' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: '#052e1b' }}>{s.name}</div>
                    <div className="text-xs truncate" style={{ color: '#6b7d5e' }}>{s.category}</div>
                  </div>
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isSel ? 'linear-gradient(135deg, #10b981, #0d7c4a)' : 'rgba(13, 124, 74, 0.08)',
                      border: `1px solid ${isSel ? 'rgba(16, 185, 129, 0.6)' : 'rgba(13, 124, 74, 0.2)'}`,
                    }}
                  >
                    {isSel && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredShows.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#8a8a7a' }}>{t('no_programs')}</div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(13, 124, 74, 0.12)' }}>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(220, 38, 38, 0.08)',
              color: '#dc2626',
              border: '1px solid rgba(220, 38, 38, 0.2)',
            }}
          >
            {t('reset_to_auto')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(13, 124, 74, 0.08)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.2)' }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="btn-enter-premium text-sm"
              style={{ padding: '8px 20px' }}
            >
              {t('save_count_btn', [selected.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')])}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS GENRE CONFIG MODAL — admin selects which genres show in donut
// ============================================================
function AnalyticsGenreConfigModal({ genres, talkShows, onClose, showToast }: {
  genres: Genre[];
  talkShows: TalkShow[];
  onClose: () => void;
  showToast?: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const { t, lang } = useLang();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('analyticsGenreIds');
      if (raw) setSelected(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleGenre = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = () => {
    try {
      localStorage.setItem('analyticsGenreIds', JSON.stringify(selected));
      window.dispatchEvent(new Event('analytics-genres-changed'));
      showToast?.(selected.length > 0
        ? `${selected.length.toLocaleString('fa-IR')} ژانر برای آمار انتخاب شد`
        : 'آمار به حالت خودکار (۵ ژانر برتر) بازگشت');
      onClose();
    } catch {
      showToast?.('خطا در ذخیرهٔ تنظیمات');
    }
  };

  const handleClear = () => {
    setSelected([]);
    localStorage.removeItem('analyticsGenreIds');
    window.dispatchEvent(new Event('analytics-genres-changed'));
    showToast?.('آمار به حالت خودکار بازگشت');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(85, 174, 183, 0.25)' }}>
          <h2 className="text-lg font-bold" style={{ color: '#F4FFFF' }}>انتخاب ژانرهای آمار</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244,255,255,0.6)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs mb-3" style={{ color: 'rgba(244,255,255,0.5)' }}>
            ژانرهایی که می‌خواهید در نمودار آمار نمایش داده شوند را انتخاب کنید. خالی = ۵ ژانر برتر خودکار.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {genres.map((g) => {
              const count = talkShows.filter(g.filterFn).length;
              const isSel = selected.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className="flex items-center gap-3 p-2 rounded-xl transition-all text-right"
                  style={{
                    background: isSel ? `${g.color}22` : 'rgba(205,239,237,0.08)',
                    border: `1px solid ${isSel ? `${g.color}60` : 'rgba(220,250,248,0.15)'}`,
                  }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: '#F4FFFF' }}>{g.nameFa}</div>
                    <div className="text-xs" style={{ color: g.color }}>{count.toLocaleString('fa-IR')} برنامه</div>
                  </div>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{
                    background: isSel ? g.color : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${isSel ? g.color : 'rgba(255,255,255,0.15)'}`,
                  }}>
                    {isSel && <svg className="w-3 h-3" fill="none" stroke="#103A40" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(85, 174, 183, 0.25)' }}>
          <button onClick={handleClear} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'rgba(220,38,38,0.10)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.25)' }}>
            بازنشانی
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'rgba(205,239,237,0.10)', color: 'rgba(244,255,255,0.7)', border: '1px solid rgba(220,250,248,0.20)' }}>
              انصراف
            </button>
            <button onClick={handleSave} className="btn-enter-premium text-sm" style={{ padding: '8px 20px' }}>
              ذخیره ({selected.length.toLocaleString('fa-IR')})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactElement> = {
    film: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />,
    tag: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
    cloud: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />,
    image: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  };
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

// ============================================
// PROGRAMS VIEW — with search, filter, select, upload, PDF/Excel
// ============================================
function ProgramsView({
  genre,
  talkShows,
  uploadedShows,
  setUploadedShows,
  onShowClick,
  onEdit,
  showToast,
  onPublish,
  onExport,
  canEdit,
  onAdd,
  onGenreSelect,
  allGenres,
}: {
  genre?: Genre;
  talkShows: TalkShow[];
  uploadedShows: number[];
  setUploadedShows: (ids: number[]) => void;
  onShowClick: (s: TalkShow) => void;
  onEdit: (s: TalkShow) => void;
  showToast: (msg: string) => void;
  onPublish: (shows: TalkShow[]) => void;
  onExport: (shows: TalkShow[], format: 'pdf' | 'excel') => void;
  canEdit: boolean;
  onAdd?: () => void;
  onGenreSelect?: (g: Genre) => void;
  allGenres?: Genre[];
}) {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [displayCount, setDisplayCount] = useState(60);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterSize, setFilterSize] = useState('all');
  const [filterViewers, setFilterViewers] = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [filterLighting, setFilterLighting] = useState('all');
  const [filterHasImages, setFilterHasImages] = useState(false);
  const [filterHasVideos, setFilterHasVideos] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'count'>('relevance');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [islamicOnly, setIslamicOnly] = useState(false);

  // Debounce search input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset display count when search/genre changes
  useEffect(() => {
    setDisplayCount(60);
  }, [debouncedSearch, genre?.id]);

  // Smart search: normalize Persian/English, fuzzy match, rank results
  const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      // Normalize Persian/Arabic characters
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/أ|إ|آ/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ی')
      // Remove diacritics
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Normalize spaces (including ZWNJ)
      .replace(/\s+/g, ' ')
      .replace(/\u200c/g, ' ')
      .trim();
  };

  const searchScore = (show: TalkShow, query: string): number => {
    if (!query) return 0;
    const q = normalizeText(query);
    if (!q) return 0;
    
    let score = 0;
    const name = normalizeText(show.name);
    const cat = normalizeText(show.category);
    const desc = normalizeText(show.descriptionFa || '');
    const summary = normalizeText(show.summary || '');
    const country = normalizeText(show.country || '');
    const style = normalizeText(show.style || '');
    const effects = normalizeText(show.effects || '');
    const lighting = normalizeText(show.lighting || '');
    const colors = normalizeText(show.colors || '');
    const materials = normalizeText(show.materials || '');
    const elements = normalizeText(show.elements || '');
    const layout = normalizeText(show.layout || '');
    
    // === Phase 1-3: Exact/fuzzy text matching ===
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 80;
    else if (name.includes(q)) score += 60;
    if (cat.includes(q)) score += 40;
    if (summary.includes(q)) score += 30;
    if (desc.includes(q)) score += 20;
    if (country.includes(q)) score += 15;
    if (show.tags) {
      for (const tag of show.tags) {
        if (normalizeText(tag).includes(q)) score += 25;
      }
    }
    // Fuzzy word matching
    const qWords = q.split(' ');
    for (const word of qWords) {
      if (word.length < 2) continue;
      if (name.includes(word)) score += 5;
      if (desc.includes(word)) score += 3;
      if (summary.includes(word)) score += 3;
    }

    // === Phase 4: Semantic / Concept-based search ===
    // Map query concepts to structured fields with weighted scoring
    // This allows finding programs by describing attributes, not just names
    const conceptMap: Record<string, (s: TalkShow) => number> = {
      // Lighting concepts
      'نور آبی': (s) => lighting.includes('آبی') || colors.includes('آبی') ? 35 : 0,
      'نورپردازی تاریک': (s) => lighting.includes('تاریک') ? 40 : 0,
      'نورپردازی روشن': (s) => lighting.includes('روشن') ? 40 : 0,
      'نورپردازی طبیعی': (s) => lighting.includes('طبیعی') ? 40 : 0,
      'نورپردازی سینمایی': (s) => lighting.includes('سینمایی') ? 40 : 0,
      'تاریک': (s) => lighting.includes('تاریک') ? 30 : 0,
      'روشن': (s) => lighting.includes('روشن') ? 30 : 0,
      // Style concepts
      'فضای صنعتی': (s) => style.includes('صنعتی') || materials.includes('فلز') || materials.includes('صنعتی') ? 35 : 0,
      'صنعتی': (s) => style.includes('صنعتی') || materials.includes('صنعتی') ? 30 : 0,
      'مدرن': (s) => style.includes('مدرن') ? 25 : 0,
      'سنتی': (s) => style.includes('سنتی') || materials.includes('چوب') ? 30 : 0,
      'کلاسیک': (s) => style.includes('کلاسیک') || style.includes('سنتی') ? 30 : 0,
      'مستند': (s) => style.includes('مستند') ? 35 : 0,
      'کمدی': (s) => style.includes('کمدی') || style.includes('طنز') ? 35 : 0,
      'خبری': (s) => style.includes('خبری') ? 35 : 0,
      'درام': (s) => style.includes('درام') ? 35 : 0,
      // Effect concepts
      'افکت سه‌بعدی': (s) => effects.includes('سه‌بعدی') || effects.includes('سه بعدی') ? 40 : 0,
      'سه‌بعدی': (s) => effects.includes('سه‌بعدی') || effects.includes('سه بعدی') ? 35 : 0,
      'انیمیشن': (s) => effects.includes('انیمیشن') ? 35 : 0,
      'تصاویر آرشیوی': (s) => effects.includes('آرشیو') ? 30 : 0,
      // Material concepts
      'چوب': (s) => materials.includes('چوب') ? 30 : 0,
      'فلز': (s) => materials.includes('فلز') ? 30 : 0,
      'شیشه': (s) => materials.includes('شیشه') ? 30 : 0,
      // Color concepts
      'رنگ گرم': (s) => colors.includes('گرم') ? 30 : 0,
      'رنگ سرد': (s) => colors.includes('سرد') ? 30 : 0,
      'طیف رنگی متنوع': (s) => colors.includes('متنوع') ? 25 : 0,
      // Layout concepts
      'استودیویی': (s) => layout.includes('استودیو') ? 25 : 0,
      'میدانی': (s) => layout.includes('میدان') || layout.includes('بیرون') ? 30 : 0,
      // Audience concepts
      'با تماشاگر': (s) => s.viewers === 'با تماشاگر' ? 30 : 0,
      'بدون تماشاگر': (s) => s.viewers === 'بدون تماشاگر' ? 25 : 0,
      // Content concepts
      'مصاحبه': (s) => desc.includes('مصاحبه') || summary.includes('مصاحبه') ? 30 : 0,
      'سرگرمی': (s) => desc.includes('سرگرمی') || cat.includes('سرگرمی') ? 30 : 0,
      'آموزشی': (s) => desc.includes('آموزش') || style.includes('آموزش') ? 30 : 0,
      'مذهبی': (s) => desc.includes('مذهب') || cat.includes('مذهب') || cat.includes('رمضان') ? 35 : 0,
      'سیاسی': (s) => desc.includes('سیاس') || cat.includes('سیاس') || cat.includes('خبری') ? 30 : 0,
      'خانوادگی': (s) => desc.includes('خانواده') || cat.includes('خانواده') ? 35 : 0,
      'علمی': (s) => desc.includes('علم') || style.includes('علم') ? 30 : 0,
      'تاریخی': (s) => desc.includes('تاریخ') || style.includes('تاریخ') ? 30 : 0,
      'ورزشی': (s) => desc.includes('ورزش') || cat.includes('ورزش') ? 30 : 0,
      'موسیقی': (s) => desc.includes('موزیک') || desc.includes('موسیق') ? 30 : 0,
      // Multi-word concept queries
      'نور آبی فضای صنعتی': (s) => (lighting.includes('آبی') ? 20 : 0) + (style.includes('صنعتی') || materials.includes('فلز') ? 20 : 0),
      'افکت‌های سه‌بعدی': (s) => effects.includes('سه‌بعدی') || effects.includes('سه بعدی') ? 40 : 0,
    };

    // Check each query word/phrase against concept map
    for (const [concept, scorer] of Object.entries(conceptMap)) {
      if (q.includes(normalizeText(concept))) {
        score += scorer(show);
      }
    }

    // Semantic field matching: query words vs structured fields
    for (const word of qWords) {
      if (word.length < 3) continue;
      // Match against decor fields (lower weight than name/desc)
      if (style.includes(word)) score += 8;
      if (effects.includes(word)) score += 8;
      if (lighting.includes(word)) score += 10;
      if (colors.includes(word)) score += 7;
      if (materials.includes(word)) score += 7;
      if (elements.includes(word)) score += 6;
      if (layout.includes(word)) score += 6;
    }

    return score;
  };

  const filteredShows = useMemo(() => {
    let shows = [...talkShows];
    if (genre) shows = shows.filter(genre.filterFn);
    if (filterSize !== 'all') shows = shows.filter(s => s.size === filterSize);
    if (filterViewers !== 'all') shows = shows.filter(s => s.viewers === filterViewers);
    if (filterStyle !== 'all') shows = shows.filter(s => s.style === filterStyle);
    if (filterLighting !== 'all') shows = shows.filter(s => s.lighting === filterLighting);
    if (filterHasImages) shows = shows.filter(s => s.images && s.images.length > 0 && s.images[0] !== '/banke-rasane-logo.png');
    if (filterHasVideos) shows = shows.filter(s => s.videos && s.videos.length > 0);
    if (islamicOnly) shows = shows.filter(s => detectCountries(s).length > 0);
    
    if (debouncedSearch) {
      const fields: (keyof TalkShow)[] = genre?.searchFields || ['name', 'summary', 'category', 'descriptionFa'];
      // First filter: must match somewhere
      shows = shows.filter(s => {
        const q = normalizeText(debouncedSearch);
        for (const f of fields) {
          const v = s[f];
          if (typeof v === 'string') {
            if (normalizeText(v).includes(q)) return true;
          } else if (Array.isArray(v)) {
            if (v.some(item => normalizeText(String(item)).includes(q))) return true;
          }
        }
        // Also search tags and country
        if (s.tags && s.tags.some(tag => normalizeText(tag).includes(q))) return true;
        if (s.country && normalizeText(s.country).includes(q)) return true;
        return false;
      });
      
      // Then sort by relevance score
      if (sortBy === 'relevance') {
        shows = shows
          .map(s => ({ show: s, score: searchScore(s, debouncedSearch) }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.show);
      }
    } else if (sortBy === 'name') {
      shows.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return shows;
  }, [talkShows, genre, debouncedSearch, filterSize, filterViewers, filterStyle, filterLighting, filterHasImages, filterHasVideos, islamicOnly, sortBy]);

  const handleUploadSelected = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    onPublish(selectedShows);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handlePDF = () => {
    // If in selection mode with picks, export only those. Otherwise export ALL filtered shows.
    const selectedShows = selectionMode && selectedIds.length > 0
      ? filteredShows.filter(s => selectedIds.includes(s.num))
      : filteredShows;
    onExport(selectedShows, 'pdf');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleExcel = () => {
    // Same logic as PDF: export selection if any, otherwise all filtered shows.
    const selectedShows = selectionMode && selectedIds.length > 0
      ? filteredShows.filter(s => selectedIds.includes(s.num))
      : filteredShows;
    onExport(selectedShows, 'excel');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const gc = genre?.color || '#10b981';

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#F4FFFF' }}>
          {genre ? genreName(genre, lang) : t('all_programs')}
        </h1>
      </header>

      {genre && (
        <div
          className="premium-card mb-6 p-6"
          style={{
            ['--card-accent-color' as string]: gc,
          }}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black"
              style={{
                backgroundColor: `${gc}30`,
                color: gc,
                border: `1px solid ${gc}70`,
                boxShadow: `0 6px 20px ${gc}45`,
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: '#F4FFFF' }}>{genreName(genre, lang)}</h2>
                {canEdit && onAdd && (
                  <button
                    onClick={onAdd}
                    className="btn-enter-premium text-sm"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    {t('add_program_btn')}
                  </button>
                )}
              </div>
              {/* PDF source link */}
              <div className="flex items-center gap-2 mt-2">
                {(() => {
                  const pdfUrl = GENRE_PDF_MAP[genre?.id || ''];
                  if (pdfUrl) {
                    return (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                        style={{
                          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.20) 0%, rgba(185, 28, 28, 0.15) 100%)',
                          color: '#fca5a5',
                          border: '1.5px solid rgba(248, 113, 113, 0.5)',
                          textDecoration: 'none',
                          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 38, 38, 0.35) 0%, rgba(185, 28, 28, 0.25) 100%)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.25)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 38, 38, 0.20) 0%, rgba(185, 28, 28, 0.15) 100%)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.15)'; }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {lang === 'fa' ? '📄 دانلود فایل PDF منبع' : '📄 Download source PDF'}
                      </a>
                    );
                  }
                  // No PDF source for this genre — don't show a confusing badge
                  return null;
                })()}
                <span className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
                  {filteredShows.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('programs_short')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Genre Pills Bar — quick switch between genres */}
      {genre && onGenreSelect && allGenres && (
        <div className="genre-pills-bar mb-4">
          <div className="genre-pills-track">
            {allGenres.filter(g => g.id !== 'decor').map((g) => {
              const isActive = g.id === genre?.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onGenreSelect(g)}
                  className={`genre-pill ${isActive ? 'genre-pill-active' : ''}`}
                  style={{ ['--pill-color' as string]: g.color }}
                >
                  <span className="genre-pill-dot" />
                  <span className="genre-pill-name">{g.nameFa}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & toolbar — mobile-friendly: full-width search, actions row, horizontally scrollable filter chips */}
      <div className="premium-glass p-3 sm:p-4 mb-6 space-y-3">
        {/* Search — full width on every screen size */}
        <div className="relative">
          <svg
            className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(244, 255, 255, 0.5)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_in', [genre ? genreName(genre, lang) : t('all_programs')])}
            style={{
              background: 'rgba(205, 239, 237, 0.13)',
              border: '1px solid rgba(220, 250, 248, 0.30)',
              borderRadius: '12px',
              padding: '11px 36px 11px 16px',
              width: '100%',
              fontFamily: 'inherit',
              color: '#F4FFFF',
              outline: 'none',
              fontSize: '15px',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
            }}
          />
        </div>

        {/* Actions row — view toggle + multi-select + Islamic filter */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0"
            style={{
              background: 'rgba(205, 239, 237, 0.13)',
              border: '1px solid rgba(220, 250, 248, 0.30)',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
            }}
          >
            <button
              onClick={() => setView('grid')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'grid' ? { background: '#00E5EF', color: '#103A40' } : { color: 'rgba(244, 255, 255, 0.6)' }}
              aria-label={t('view_grid_aria')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'list' ? { background: '#00E5EF', color: '#103A40' } : { color: 'rgba(244, 255, 255, 0.6)' }}
              aria-label={t('view_list_aria')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* 🌍 Islamic-countries filter — toggles whether shows must mention an Islamic country */}
          <button
            onClick={() => setIslamicOnly(!islamicOnly)}
            className="px-3 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            title={t('islamic_btn_title')}
            style={islamicOnly ? {
              background: 'linear-gradient(135deg, #00E5EF 0%, #00A6B5 100%)',
              color: '#103A40',
              border: '1px solid rgba(0, 229, 239, 0.6)',
            } : {
              background: 'rgba(205, 239, 237, 0.13)',
              color: 'rgba(244, 255, 255, 0.7)',
              border: '1px solid rgba(220, 250, 248, 0.30)',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
            }}
          >
            {t('islamic_btn')}
          </button>

          {/* 📄📊 Always-available export buttons — export all currently-filtered shows
              (or the selection if multi-select is active with picks). */}
          <button
            onClick={handlePDF}
            className="px-3 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0 flex items-center gap-1.5"
            title={lang === 'fa' ? `خروجی PDF از ${filteredShows.length.toLocaleString('fa-IR')} برنامه` : `Export ${filteredShows.length} shows as PDF`}
            style={{
              background: 'rgba(220, 38, 38, 0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h6m-6-8h4" />
            </svg>
            <span className="hidden sm:inline">{t('pdf_report')}</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={handleExcel}
            className="px-3 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0 flex items-center gap-1.5"
            title={lang === 'fa' ? `خروجی Excel از ${filteredShows.length.toLocaleString('fa-IR')} برنامه` : `Export ${filteredShows.length} shows as Excel`}
            style={{
              background: 'rgba(13, 124, 74, 0.18)',
              color: '#6ee7b7',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">{t('excel_report')}</span>
            <span className="sm:hidden">Excel</span>
          </button>

          {canEdit && (
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex-1"
              style={selectionMode ? {
                background: 'rgba(0, 229, 239, 0.18)',
                border: '1px solid rgba(0, 229, 239, 0.5)',
                color: '#00E5EF',
              } : {
                background: 'rgba(205, 239, 237, 0.13)',
                border: '1px solid rgba(220, 250, 248, 0.30)',
                color: 'rgba(244, 255, 255, 0.7)',
                backdropFilter: 'blur(22px) saturate(135%)',
                WebkitBackdropFilter: 'blur(22px) saturate(135%)',
              }}
            >
              {selectionMode ? t('multi_select_active', [selectedIds.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')]) : t('multi_select')}
            </button>
          )}
          {!canEdit && (
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium flex-1 text-center"
              style={{
                background: 'rgba(107, 143, 122, 0.08)',
                color: '#8a8a7a',
                border: '1px solid rgba(107, 143, 122, 0.2)',
              }}
              title={t('view_only_title')}
            >
              🔒 {t('view_only')}
            </div>
          )}
        </div>

        {/* Filters — two horizontally scrollable rows (no chaotic wrapping on mobile) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#CDEFEF' }}>{t('filter_size')}</span>
            {[
              { key: 'all', label: t('filter_all') },
              { key: 'بزرگ/لوکس', label: t('filter_large') },
              { key: 'متوسط/استاندارد', label: t('filter_medium') },
              { key: 'کوچک/اقتصادی', label: t('filter_small') },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterSize(f.key)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                style={filterSize === f.key ? {
                  background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#CDEFEF',
                  border: '1px solid rgba(205, 239, 239, 0.15)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#CDEFEF' }}>{t('filter_style')}</span>
            {[
              { key: 'all', label: t('filter_all') },
              { key: 'مدرن', label: t('filter_modern') },
              { key: 'ترکیبی', label: t('filter_combined') },
              { key: 'مینیمال', label: t('filter_minimal') },
              { key: 'کلاسیک/سنتی', label: t('filter_classic') },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStyle(f.key)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                style={filterStyle === f.key ? {
                  background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#CDEFEF',
                  border: '1px solid rgba(205, 239, 239, 0.15)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {selectionMode && selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-3 pt-3"
            style={{ borderTop: '1px solid rgba(13, 124, 74, 0.1)' }}
          >
            <span style={{ color: '#0d7c4a' }} className="font-medium text-sm">
              {selectedIds.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('selected_count')}
            </span>
            <button
              onClick={handleUploadSelected}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)' }}
            >
              {t('publish_social')}
            </button>
            {/* Export buttons live in the toolbar above now — selection mode just shows count + publish + clear. */}
            <button
              onClick={() => { setSelectedIds([]); setSelectionMode(false); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122, 0.3)' }}
            >
              {t('cancel_selection')}
            </button>
          </div>
        )}
      </div>

      {filteredShows.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#8a8a7a' }}>
          <p>{t('no_programs')}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredShows.slice(0, displayCount).map(s => (
            <ProgramCard
              key={s.num}
              show={s}
              genre={genre}
              selectionMode={selectionMode}
              selected={selectedIds.includes(s.num)}
              isUploaded={uploadedShows.includes(s.num)}
              onToggle={() => {
                if (selectedIds.includes(s.num)) setSelectedIds(selectedIds.filter(x => x !== s.num));
                else setSelectedIds([...selectedIds, s.num]);
              }}
              onClick={() => !selectionMode && onShowClick(s)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredShows.slice(0, displayCount).map(s => (
            <ProgramListRow
              key={s.num}
              show={s}
              genre={genre}
              selectionMode={selectionMode}
              selected={selectedIds.includes(s.num)}
              isUploaded={uploadedShows.includes(s.num)}
              onToggle={() => {
                if (selectedIds.includes(s.num)) setSelectedIds(selectedIds.filter(x => x !== s.num));
                else setSelectedIds([...selectedIds, s.num]);
              }}
              onClick={() => !selectionMode && onShowClick(s)}
            />
          ))}
        </div>
      )}

      {filteredShows.length > 60 && (
        <div className="text-center mt-8 mb-4">
          <button
            onClick={() => setDisplayCount(prev => prev + 60)}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(0, 229, 239, 0.12)',
              color: '#00E5EF',
              border: '1px solid rgba(0, 229, 239, 0.30)',
            }}
          >
            نمایش بیشتر ({(filteredShows.length - displayCount).toLocaleString('fa-IR')} مورد باقی‌مانده)
          </button>
        </div>
      )}
      <div className="text-center mt-2 mb-8">
        <span className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.4)' }}>
          {Math.min(displayCount, filteredShows.length).toLocaleString('fa-IR')} از {filteredShows.length.toLocaleString('fa-IR')} برنامه
        </span>
      </div>
    </>
  );
}

function ProgramCard({ show, selectionMode, selected, isUploaded, onToggle, onClick, genre }: {
  show: TalkShow;
  selectionMode: boolean;
  selected: boolean;
  isUploaded: boolean;
  onToggle: () => void;
  onClick: () => void;
  genre?: Genre | null;
}) {
  const thumb = getShowThumbnail(show);
  // Section-specific tags derived from the genre (fallback to decor's style/size/viewers).
  const genreTags = renderGenreTags(show, genre);
  // User-defined tags on the show itself (purple badges).
  const userTags = show.tags && show.tags.length > 0 ? show.tags : [];
  return (
    <div
      onClick={selectionMode ? onToggle : onClick}
      className="premium-show-card"
      style={selected ? {
        border: '2px solid #10b981',
        boxShadow: '0 0 0 3px rgba(13, 124, 74, 0.3), 0 12px 40px rgba(0, 0, 0, 0.5)',
      } : undefined}
    >
      {/* Thumbnail — real image from PDF if available, otherwise gradient */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{
          background: thumb.gradient,
          borderRadius: '16px 16px 0 0',
        }}
      >
        {thumb.image ? (
          <img
            src={thumb.image}
            alt={show.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: thumb.pattern }}></div>
            {show.materials && (
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: show.materials.includes('wood')
                    ? 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 5px)'
                    : show.materials.includes('glass')
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.2) 100%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1), transparent)',
                }}
              ></div>
            )}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="text-center">
                <div
                  className="text-2xl font-black mb-1"
                  style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)', direction: 'ltr' }}
                >
                  {show.name.length > 20 ? show.name.substring(0, 18) + '...' : show.name}
                </div>
                <div
                  className="text-xs font-medium px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'rgba(255,255,255,0.25)', color: 'white', backdropFilter: 'blur(8px)' }}
                >
                  {show.style}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Multi-image badge — shows count when more than 1 image */}
        {show.images && show.images.length > 1 && (
          <span
            className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md backdrop-blur font-bold flex items-center gap-1"
            style={{ background: 'rgba(0, 0, 0, 0.75)', color: 'white' }}
          >
            🖼 {show.images.length.toLocaleString('fa-IR')}
          </span>
        )}

        {/* Video count badge — shows when show has video links */}
        {show.videos && show.videos.length > 0 && (
          <span
            className="absolute text-xs px-2 py-0.5 rounded-md backdrop-blur font-bold flex items-center gap-1"
            style={{
              background: 'rgba(220, 38, 38, 0.85)',
              color: 'white',
              top: show.images && show.images.length > 1 ? '36px' : '8px',
              right: '8px',
            }}
          >
            🎬 {show.videos.length.toLocaleString('fa-IR')}
          </span>
        )}

        {/* Uploaded badge */}
        {isUploaded && (
          <span
            className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
            style={{ background: 'rgba(124, 58, 237, 0.9)', color: 'white' }}
          >
            ☁ آپلود شده
          </span>
        )}

        {selectionMode && (
          <div
            className="absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center"
            style={selected ? {
              background: thumb.accent,
              borderColor: thumb.accent,
            } : {
              background: 'rgba(255, 255, 255, 0.8)',
              borderColor: `${thumb.accent}90`,
            }}
          >
            {selected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        <div
          className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
          style={{ background: 'rgba(0, 0, 0, 0.75)', color: 'white' }}
        >
          {show.size}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
          >
            {show.style}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}>
              👥 تماشاگر
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2" style={{ direction: 'ltr', textAlign: 'right', color: '#1a2e1a' }}>
          {show.name}
        </h3>

        <p className="text-xs line-clamp-2 mb-3" style={{ color: '#5a6b4a' }}>
          {show.summary && show.summary !== '—' ? show.summary : show.category}
        </p>

        {/* Section-specific genre tags (emerald badges) */}
        {genreTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}

        {/* User-defined tags (purple badges) */}
        {userTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {userTags.slice(0, 4).map((t, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.4)', color: '#c4b5fd', border: '1px solid rgba(168, 85, 247, 0.5)' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs" style={{ color: '#8a8a7a' }}>
          <span className="truncate" title={show.category}>
            {show.category.replace(/^\d+\.\s*/, '').substring(0, 18)}
          </span>
          <span className="font-bold" style={{ color: '#0d7c4a' }}>#{show.num.toLocaleString('fa-IR')}</span>
        </div>
      </div>
    </div>
  );
}

function ProgramListRow({ show, selectionMode, selected, isUploaded, onToggle, onClick, genre }: {
  show: TalkShow;
  selectionMode: boolean;
  selected: boolean;
  isUploaded: boolean;
  onToggle: () => void;
  onClick: () => void;
  genre?: Genre | null;
}) {
  const thumb = getShowThumbnail(show);
  const genreTags = renderGenreTags(show, genre);
  const userTags = show.tags && show.tags.length > 0 ? show.tags : [];
  return (
    <div
      onClick={selectionMode ? onToggle : onClick}
      className="premium-show-card"
      style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        ...(selected ? {
          border: '2px solid #10b981',
          boxShadow: '0 0 0 3px rgba(13, 124, 74, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4)',
        } : {}),
      }}
    >
      {selectionMode && (
        <div
          className="w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0"
          style={selected ? {
            background: '#10b981',
            borderColor: '#10b981',
          } : {
            borderColor: 'rgba(13, 124, 74, 0.5)',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          {selected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      <div
        className="w-14 h-14 rounded-xl flex-shrink-0 relative overflow-hidden"
        style={{ background: thumb.gradient }}
      >
        <div className="absolute inset-0" style={{ background: thumb.pattern }}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black" style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {show.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
          >
            {show.style}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(13, 124, 74, 0.1)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.25)' }}>
            {show.size}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(13, 124, 74, 0.1)', color: '#0d7c4a' }}>
              👥
            </span>
          )}
          {isUploaded && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124, 58, 237, 0.3)', color: '#c4b5fd' }}>
              ☁
            </span>
          )}
        </div>
        <h3 className="font-bold text-sm mb-1 truncate" style={{ direction: 'ltr', textAlign: 'right', color: '#1a2e1a' }}>{show.name}</h3>
        <p className="text-xs truncate" style={{ color: '#5a6b4a' }}>{show.summary && show.summary !== '—' ? show.summary : show.category}</p>
        {(genreTags.length > 0 || userTags.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
              >
                {t.label}
              </span>
            ))}
            {userTags.slice(0, 3).map((t, i) => (
              <span
                key={`u${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.4)', color: '#c4b5fd', border: '1px solid rgba(168, 85, 247, 0.5)' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-center flex-shrink-0">
        <div className="text-xs" style={{ color: '#9EC9C9' }}>شماره</div>
        <div className="font-bold text-sm" style={{ color: '#0d7c4a' }}>#{show.num.toLocaleString('fa-IR')}</div>
      </div>
    </div>
  );
}

// ============================================
// SHOW DETAILS MODAL — with Persian description, links, publish, export
// ============================================
function ShowDetailsModal({ show, onClose, onEdit, onDelete, onPublish, onExport, isUploaded, canEdit, allShows = [], onSwapShow }: {
  show: TalkShow;
  onClose: () => void;
  onEdit: (s: TalkShow) => void;
  onDelete: (num: number) => void;
  onPublish: (s: TalkShow) => void;
  onExport: (s: TalkShow, fmt: 'pdf' | 'excel') => void;
  isUploaded: boolean;
  canEdit: boolean;
  allShows?: TalkShow[];
  onSwapShow?: (s: TalkShow) => void;
}) {
  const thumb = getShowThumbnail(show);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t, lang } = useLang();
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  // Related programs computed from the full list — capped at 6.
  const related = useMemo(
    () => allShows.length > 0 ? findRelated(show, allShows, 6) : [],
    [show, allShows]
  );
  // Detect Islamic-country mentions for the country badges.
  const countries = detectCountries(show);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" onClick={(e) => e.stopPropagation()}>
        {/* Header with thumbnail — real image if available */}
        <div
          className="relative overflow-hidden"
          style={{
            background: thumb.gradient,
            borderRadius: '24px 24px 0 0',
            minHeight: '200px',
          }}
        >
          {thumb.image && (
            <img
              src={thumb.image}
              alt={show.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {!thumb.image && <div className="absolute inset-0" style={{ background: thumb.pattern }}></div>}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2.5 rounded-xl z-20"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative z-10 text-white">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
              >
                {show.style}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
              >
                {show.size}
              </span>
              {show.viewers === 'با تماشاگر' && (
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                  {t('with_viewers')}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ direction: 'ltr', textAlign: 'right', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {show.name}
            </h2>
            <p className="text-sm opacity-90">{t('program_num_n', [show.num.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')])}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Image gallery — all images, not just the cover */}
          {show.images && show.images.length > 0 && (
            <ShowImageGallery images={show.images} showName={show.name} />
          )}

          {/* Persian description */}
          <div className="mb-6 p-4 rounded-xl" style={{ background: `${thumb.accent}10`, border: `1px solid ${thumb.accent}25` }}>
            <h4 className="font-bold mb-2" style={{ color: '#F4FFFF' }}>{t('about_program')}</h4>
            <p style={{ color: '#E0F2F0', lineHeight: 1.8 }}>{show.descriptionFa}</p>
          </div>

          {/* Video links gallery */}
          {show.videos && show.videos.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold mb-3" style={{ color: '#F4FFFF' }}>
                {t('program_videos')}
                <span className="text-xs font-normal mr-2" style={{ color: '#9EC9C9' }}>
                  ({show.videos.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('videos_count_short')})
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {show.videos.map((url, idx) => {
                  const platform = getVideoPlatformInfo(url);
                  const thumbUrl = getYoutubeThumbnail(url);
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${platform.color}30`,
                        textDecoration: 'none',
                      }}
                    >
                      <div
                        className="w-20 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative"
                        style={{ background: thumbUrl ? '#000' : `${platform.color}20` }}
                      >
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-2xl">{platform.icon}</span>
                        )}
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.3)' }}
                        >
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded-md font-bold mb-1"
                          style={{ background: `${platform.color}20`, color: platform.color }}
                        >
                          {platform.icon} {platform.name}
                        </span>
                        <div
                          className="text-xs truncate"
                          style={{ color: '#CDEFEF', direction: 'ltr', textAlign: 'left' }}
                          title={url}
                        >
                          {url}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Access links */}
          <div className="mb-6">
            <h4 className="font-bold mb-3" style={{ color: '#F4FFFF' }}>{t('direct_access')}</h4>
            <div className="flex flex-wrap gap-2">
              <a
                href={show.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)', textDecoration: 'none' }}
              >
                ▶ {t('watch_youtube')}
              </a>
              <a
                href={show.imdb}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', textDecoration: 'none' }}
              >
                🎬 {t('imdb_page')}
              </a>
              <a
                href={show.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)', textDecoration: 'none' }}
              >
                📖 {t('wikipedia_page')}
              </a>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => onPublish(show)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: 'white' }}
            >
              {t('publish_social')}
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(show)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
              >
                {t('edit_btn')}
              </button>
            )}
            <button
              onClick={() => onExport(show, 'pdf')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            >
              {t('pdf_report')}
            </button>
            <button
              onClick={() => onExport(show, 'excel')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
            >
              {t('excel_report')}
            </button>
            {canEdit && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
              >
                {t('delete_program')}
              </button>
            )}
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div
              className="mb-4 p-4 rounded-xl flex items-center justify-between gap-3"
              style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)' }}
            >
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {t('delete_confirm')}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#CDEFEF', border: '1px solid rgba(107, 143, 122, 0.3)' }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => { onDelete(show.num); onClose(); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white' }}
                >
                  {t('delete_yes')}
                </button>
              </div>
            </div>
          )}

          {/* Decor details */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#F4FFFF' }}>{t('decor_details')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField label={t('field_category')} value={show.category} />
              <DetailField label={t('field_decor_style')} value={show.style} />
              <DetailField label={t('field_studio_size')} value={show.size} />
              <DetailField label={t('field_viewers')} value={show.viewers} />
              <DetailField label={t('field_decor_style')} value={show.style} />
              <DetailField label={t('field_effects')} value={show.effects} />
              <DetailField label={t('field_layout')} value={show.layout} />
              <DetailField label={t('field_lighting')} value={show.lighting} />
              <DetailField label={t('field_decor_elements')} value={show.elements} />
              <DetailField label={t('field_materials')} value={show.materials} />
              <div className="sm:col-span-2">
                <DetailField label={t('field_coloring')} value={show.colors} />
              </div>
            </div>
          </div>

          {/* Decor summary */}
          {show.summary && show.summary !== '—' && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: `${thumb.accent}10`, border: `1px solid ${thumb.accent}25` }}>
              <h4 className="font-bold mb-2" style={{ color: '#F4FFFF' }}>{t('decor_summary')}</h4>
              <p style={{ color: '#E0F2F0', lineHeight: 1.7 }}>{show.summary}</p>
            </div>
          )}

          {/* Tags section — user-defined tags + detected Islamic countries */}
          {((show.tags && show.tags.length > 0) || countries.length > 0 || show.country) && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <h4 className="font-bold mb-3" style={{ color: '#F4FFFF' }}>{t('tags_section')}</h4>
              {show.tags && show.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {show.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-md font-medium"
                      style={{ background: 'rgba(124, 58, 237, 0.18)', color: '#6d28d9', border: '1px solid rgba(124, 58, 237, 0.3)' }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {countries.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold" style={{ color: '#9EC9C9' }}>{t('detected_countries')}</span>
                  {countries.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-md font-medium"
                      style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {show.country && (
                <div className="text-xs" style={{ color: '#9EC9C9' }}>
                  {t('origin_country')} <strong style={{ color: '#F4FFFF' }}>{show.country}</strong>
                </div>
              )}
            </div>
          )}

          {/* 🔗 Related programs — computed from allShows via findRelated */}
          {related.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold mb-3" style={{ color: '#F4FFFF' }}>{t('related_programs')}</h4>
              <div className="flex items-center gap-3 overflow-x-auto pb-3 no-scrollbar">
                {related.map(r => {
                  const rThumb = getShowThumbnail(r);
                  const rDark = adjustColor(rThumb.accent, -40);
                  return (
                    <button
                      key={r.num}
                      onClick={() => { if (onSwapShow) onSwapShow(r); setConfirmDelete(false); }}
                      className="flex-shrink-0 rounded-xl overflow-hidden text-right transition-all"
                      style={{
                        width: '180px',
                        background: `linear-gradient(135deg, ${rThumb.accent} 0%, ${rDark} 100%)`,
                        border: '1px solid rgba(255,255,255,0.3)',
                        boxShadow: `0 6px 18px ${rThumb.accent}40`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div className="aspect-video relative overflow-hidden">
                        {rThumb.image ? (
                          <img src={rThumb.image} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="absolute inset-0" style={{ background: rThumb.gradient }}></div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-bold text-white truncate" style={{ direction: 'ltr', textAlign: 'right', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{r.name}</div>
                        <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{r.category.replace(/^\d+\.\s*/, '').substring(0, 18)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold mb-1" style={{ color: '#3d4f3d' }}>{label}</div>
      <div className="text-sm" style={{ color: '#F4FFFF' }}>{value || '—'}</div>
    </div>
  );
}

// ============================================
// ADD/EDIT VIEW
// ============================================
function AddEditView({ talkShows, onSave, editingShow, setEditingShow, onDone, showToast, presetCategory, presetGenre, genres = GENRES, canEdit = true }: {
  talkShows: TalkShow[];
  onSave: (show: TalkShow, isEdit: boolean) => void;
  editingShow: TalkShow | null;
  setEditingShow: (s: TalkShow | null) => void;
  onDone: () => void;
  showToast: (msg: string) => void;
  presetCategory?: string;
  presetGenre?: Genre | null;
  genres?: Genre[];
  canEdit?: boolean;
}) {
  const { t } = useLang();
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [form, setForm] = useState<Partial<TalkShow>>(
    editingShow || {
      num: Math.max(0, ...talkShows.map(s => s.num)) + 1,
      name: '',
      category: presetCategory || '',
      source: '',
      size: 'متوسط/استاندارد',
      viewers: 'بدون تماشاگر',
      style: 'مدرن',
      effects: 'ترکیبی',
      layout: 'پنل/میزگرد',
      elements: '',
      materials: '',
      colors: '',
      lighting: 'خنثی',
      summary: '',
      descriptionFa: '',
      youtube: '',
      imdb: '',
      wikipedia: '',
      country: '',
      tags: [],
    }
  );
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleAutoFetch = async () => {
    if (!fetchUrl) {
      showToast(t('enter_imdb_link'));
      return;
    }
    setFetching(true);
    try {
      const res = await fetch('/api/fetch-show-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fetchUrl }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(t('fetch_error_msg', [data.error]));
      } else {
        const info = data.info;
        const updated = { ...form };
        if (info.title && !updated.name) updated.name = info.title;
        if (info.description) {
          updated.descriptionFa = info.description;
          updated.summary = info.description.substring(0, 200);
        }
        // Push auto-fetched image into images[] array (up to 8 total)
        if (info.image) {
          const existing = updated.images || [];
          if (!existing.includes(info.image) && existing.length < 8) {
            updated.images = [...existing, info.image];
          }
        }
        if (info.rating) updated.colors = `امتیاز: ${info.rating}`;
        if (info.genres) updated.category = info.genres;
        if (info.duration) updated.elements = info.duration;
        if (fetchUrl.includes('imdb.com')) updated.imdb = fetchUrl;
        if (fetchUrl.includes('wikipedia.org')) updated.wikipedia = fetchUrl;
        // Auto-generate YouTube search link
        if (updated.name) {
          updated.youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(updated.name)}`;
        }
        // Auto-generate social post
        if (updated.name) {
          updated.socialPost = `🎬 ${updated.name}\n\n📝 ${updated.descriptionFa || ''}\n\n#بانک_رسانه #تاک_شو`;
        }
        setForm(updated);
        showToast(t('info_fetched'));
      }
    } catch (e) {
      showToast(t('fetch_error'));
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = () => {
    if (!form.name) {
      showToast(t('name_required'));
      return;
    }
    // Auto-generate links if not set
    if (!form.youtube && form.name) {
      form.youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(form.name)}`;
    }
    if (!form.imdb && form.name) {
      form.imdb = `https://www.imdb.com/find?q=${encodeURIComponent(form.name)}`;
    }
    if (!form.wikipedia && form.name) {
      form.wikipedia = `https://fa.wikipedia.org/w/index.php?search=${encodeURIComponent(form.name)}`;
    }
    if (!form.descriptionFa) {
      form.descriptionFa = 'برنامهٔ گفتگومی تلویزیونی با مصاحبه، بحث و بررسی موضوعات متنوع.';
    }
    if (!form.socialPost) {
      form.socialPost = `🎬 ${form.name}\n\n📝 ${form.descriptionFa}\n\n#بانک_رسانه #تاک_شو`;
    }
    if (editingShow) {
      onSave(form as TalkShow, true);
    } else {
      onSave(form as TalkShow, false);
    }
    onDone();
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#1a2e1a' }}>
          {editingShow ? t('edit_program_title') : t('add_program_title')}
        </h1>
        <p style={{ color: '#8a8a7a' }}>
          {editingShow ? t('editing_program_n', [editingShow.num.toLocaleString('fa-IR')]) : t('fill_form_hint')}
        </p>
      </header>

      <div className="premium-glass p-6 space-y-4">
        {/* Auto-fetch from IMDb/Wikipedia */}
        <div className="p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)' }}>
          <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>{t('auto_fetch_title')}</h4>
          <p className="text-xs mb-3" style={{ color: '#8a8a7a' }}>
            {t('auto_fetch_desc')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              placeholder={t('fetch_url_placeholder')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74,0.15)',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'inherit',
                outline: 'none',
                direction: 'ltr',
                textAlign: 'left',
              }}
            />
            <button
              onClick={handleAutoFetch}
              disabled={fetching}
              className="btn-enter-premium"
              style={{ padding: '10px 24px', fontSize: '14px', whiteSpace: 'nowrap' }}
            >
              {fetching ? t('fetching') : t('fetch_btn')}
            </button>
          </div>
        </div>

        <FormField label={t('field_program_name')} value={form.name || ''} onChange={v => setForm({ ...form, name: v })} placeholder={t('field_program_name_ph')} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label={t('field_category')}
            value={form.category || ''}
            onChange={v => setForm({ ...form, category: v })}
            options={genres.map(g => ({ value: g.nameFa, label: genreName(g, 'fa') }))}
          />
          <FormField label={t('field_country')} value={form.country || ''} onChange={v => setForm({ ...form, country: v })} placeholder={t('field_country_ph')} />

          <FormSelect
            label={t('field_studio_size')}
            value={form.size || ''}
            onChange={v => setForm({ ...form, size: v })}
            options={[
              { value: 'بزرگ/لوکس', label: 'بزرگ/لوکس' },
              { value: 'متوسط/استاندارد', label: 'متوسط/استاندارد' },
              { value: 'کوچک/اقتصادی', label: 'کوچک/اقتصادی' },
            ]}
          />
          <FormSelect
            label={t('field_viewers')}
            value={form.viewers || ''}
            onChange={v => setForm({ ...form, viewers: v })}
            options={[
              { value: 'با تماشاگر', label: 'با تماشاگر' },
              { value: 'بدون تماشاگر', label: 'بدون تماشاگر' },
              { value: 'نامشخص', label: 'نامشخص' },
            ]}
          />
          <FormSelect
            label={t('field_decor_style')}
            value={form.style || ''}
            onChange={v => setForm({ ...form, style: v })}
            options={[
              { value: 'مدرن', label: 'مدرن' },
              { value: 'ترکیبی', label: 'ترکیبی' },
              { value: 'مینیمال', label: 'مینیمال' },
              { value: 'کلاسیک/سنتی', label: 'کلاسیک/سنتی' },
              { value: 'فاخر/تزئینی', label: 'فاخر/تزئینی' },
            ]}
          />
          <FormSelect
            label={t('field_lighting')}
            value={form.lighting || ''}
            onChange={v => setForm({ ...form, lighting: v })}
            options={[
              { value: 'خنثی', label: 'خنثی' },
              { value: 'گرم', label: 'گرم' },
              { value: 'سرد', label: 'سرد' },
              { value: 'ترکیبی', label: 'ترکیبی' },
              { value: 'دراماتیک', label: 'دراماتیک' },
            ]}
          />
        </div>

        <FormField label={t('field_decor_elements')} value={form.elements || ''} onChange={v => setForm({ ...form, elements: v })} placeholder={t('field_decor_elements_ph')} />
        <FormField label={t('field_materials')} value={form.materials || ''} onChange={v => setForm({ ...form, materials: v })} placeholder={t('field_materials_ph')} />
        <FormField label={t('field_coloring')} value={form.colors || ''} onChange={v => setForm({ ...form, colors: v })} placeholder={t('field_coloring_ph')} />

        {/* Persian description */}
        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{t('description_fa_label')}</label>
          <textarea
            value={form.descriptionFa || ''}
            onChange={(e) => setForm({ ...form, descriptionFa: e.target.value })}
            placeholder={t('description_fa_ph')}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(13, 124, 74, 0.15)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#1a2e1a',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{t('decor_summary_label')}</label>
          <textarea
            value={form.summary || ''}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder={t('decor_summary_ph')}
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(13, 124, 74, 0.15)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#1a2e1a',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Multi-image upload section — up to 8 images per show */}
        <ImageGalleryEditor
          images={form.images || []}
          onChange={(imgs) => setForm({ ...form, images: imgs })}
          showToast={showToast}
        />

        {/* Tags editor — comma-separated input + quick-add preset buttons */}
        <TagsEditor
          tags={form.tags || []}
          onChange={(t) => setForm({ ...form, tags: t })}
          presetTags={presetGenre?.presetTags}
        />

        {/* Video links section — multiple URLs */}
        <VideoLinksEditor
          videos={form.videos || []}
          youtube={form.youtube || ''}
          onVideosChange={(vids) => setForm({ ...form, videos: vids })}
          onYoutubeChange={(url) => setForm({ ...form, youtube: url })}
          canEdit={canEdit}
          onOpenVideoEditor={() => setShowVideoEditor(true)}
        />

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            className="btn-enter-premium"
            style={{ padding: '12px 32px', fontSize: '15px' }}
          >
            {editingShow ? t('save_update_btn') : t('add_program_btn')}
          </button>
          <button
            onClick={() => { setEditingShow(null); onDone(); }}
            className="px-6 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122, 0.3)' }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      {/* Video editor modal — opened from the VideoLinksEditor section */}
      {showVideoEditor && (
        <VideoEditor
          onClose={() => setShowVideoEditor(false)}
          onSave={(blob, thumb, meta) => {
            showToast(`ویدیو ذخیره شد (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`);
            setShowVideoEditor(false);
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}

function FormField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(13, 124, 74, 0.15)',
          background: 'rgba(255, 255, 255, 0.8)',
          color: '#1a2e1a',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(13, 124, 74, 0.15)',
          background: 'rgba(255, 255, 255, 0.8)',
          color: '#1a2e1a',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// IMAGE GALLERY EDITOR — up to 8 images per show
// Supports both URL paste and file upload (base64 for offline storage)
// ============================================
function ImageGalleryEditor({ images, onChange, showToast }: {
  images: string[];
  onChange: (imgs: string[]) => void;
  showToast: (msg: string) => void;
}) {
  const { t } = useLang();
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to the latest images array so async FileReader callbacks always see current state
  const imagesRef = useRef<string[]>(images);
  imagesRef.current = images;
  const MAX_IMAGES = 8;

  const addUrl = () => {
    if (!urlInput.trim()) return;
    if (images.length >= MAX_IMAGES) {
      showToast(t('max_images_warning', [MAX_IMAGES]));
      return;
    }
    if (images.includes(urlInput.trim())) {
      showToast(t('image_exists'));
      return;
    }
    onChange([...images, urlInput.trim()]);
    setUrlInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const remaining = MAX_IMAGES - imagesRef.current.length;
    const toAdd = fileArr.slice(0, remaining);
    if (toAdd.length < fileArr.length) {
      showToast(t('images_added_partial', [toAdd.length, MAX_IMAGES]));
    }
    // Read files sequentially to preserve order
    toAdd.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const current = imagesRef.current;
        if (current.length < MAX_IMAGES && !current.includes(result)) {
          onChange([...current, result]);
        }
      };
      reader.onerror = () => {
        showToast(t('file_read_error', [file.name]));
      };
      reader.readAsDataURL(file);
    });
    // Reset file input so same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: 'left' | 'right') => {
    const newIdx = dir === 'left' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const newImages = [...images];
    [newImages[idx], newImages[newIdx]] = [newImages[newIdx], newImages[idx]];
    onChange(newImages);
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold" style={{ color: '#F4FFFF' }}>
          {t('program_images')}
          <span className="text-xs font-normal mr-2" style={{ color: '#9EC9C9' }}>
            ({images.length.toLocaleString('fa-IR')} از {MAX_IMAGES.toLocaleString('fa-IR')})
          </span>
        </h4>
        {images.length > 0 && (
          <span className="text-xs" style={{ color: '#6ee7b7' }}>{t('cover_note')}</span>
        )}
      </div>

      {/* URL input + file upload */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          placeholder={t('paste_image_url')}
          disabled={images.length >= MAX_IMAGES}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(13, 124, 74,0.15)',
            background: images.length >= MAX_IMAGES ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            color: '#1a2e1a',
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            fontSize: '12px',
          }}
        />
        <button
          onClick={addUrl}
          disabled={images.length >= MAX_IMAGES || !urlInput.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: images.length >= MAX_IMAGES || !urlInput.trim() ? 'rgba(255, 255, 255, 0.6)' : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
            color: images.length >= MAX_IMAGES || !urlInput.trim() ? '#999' : 'white',
            border: '1px solid rgba(13, 124, 74,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('add_link_btn')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: images.length >= MAX_IMAGES ? 'rgba(255, 255, 255, 0.6)' : 'rgba(13, 124, 74,0.1)',
            color: images.length >= MAX_IMAGES ? '#999' : '#0d7c4a',
            border: '1px solid rgba(13, 124, 74,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('upload_file_btn')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div
          className="text-center py-8 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.5)', border: '2px dashed rgba(13, 124, 74,0.2)' }}
        >
          <div className="text-3xl mb-2 opacity-40">🖼</div>
          <p className="text-xs" style={{ color: '#8a8a7a' }}>
            {t('no_images_hint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl overflow-hidden"
              style={{
                aspectRatio: '4/3',
                border: idx === 0 ? '3px solid #10b981' : '1px solid rgba(13, 124, 74, 0.3)',
                background: 'rgba(232, 228, 216, 0.5)',
              }}
            >
              <img
                src={img}
                alt={`تصویر ${(idx + 1).toLocaleString('fa-IR')}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = '0.3';
                }}
              />
              {/* Cover badge */}
              {idx === 0 && (
                <span
                  className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded-md font-bold"
                  style={{ background: '#10b981', color: 'white' }}
                >
                  {t('cover_badge')}
                </span>
              )}
              {/* Number badge */}
              <span
                className="absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded-md font-bold"
                style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
              >
                {(idx + 1).toLocaleString('fa-IR')}
              </span>
              {/* Controls overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <button
                  onClick={() => moveImage(idx, 'left')}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    background: idx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.8)',
                    color: idx === 0 ? 'rgba(255,255,255,0.5)' : '#1a2e1a',
                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={t('move_left')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => removeImage(idx)}
                  className="p-1.5 rounded-lg"
                  style={{ background: 'rgba(220,38,38,0.9)', color: 'white' }}
                  title={t('delete_image_title')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={() => moveImage(idx, 'right')}
                  disabled={idx === images.length - 1}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    background: idx === images.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.8)',
                    color: idx === images.length - 1 ? 'rgba(255,255,255,0.5)' : '#1a2e1a',
                    cursor: idx === images.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                  title={t('move_right')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {/* Add more slot */}
          {images.length < MAX_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center transition-all"
              style={{
                aspectRatio: '4/3',
                border: '2px dashed rgba(13, 124, 74,0.3)',
                background: 'rgba(13, 124, 74,0.04)',
                color: '#0d7c4a',
                cursor: 'pointer',
              }}
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">افزودن</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// VIDEO LINKS EDITOR — multiple video URLs per show
// ============================================
function VideoLinksEditor({ videos, youtube, onVideosChange, onYoutubeChange, canEdit, onOpenVideoEditor }: {
  videos: string[];
  youtube: string;
  onVideosChange: (vids: string[]) => void;
  onYoutubeChange: (url: string) => void;
  canEdit?: boolean;
  onOpenVideoEditor?: () => void;
}) {
  const { t } = useLang();
  const [urlInput, setUrlInput] = useState('');

  const addVideo = () => {
    if (!urlInput.trim()) return;
    if (videos.includes(urlInput.trim())) return;
    onVideosChange([...videos, urlInput.trim()]);
    setUrlInput('');
  };

  const removeVideo = (idx: number) => {
    onVideosChange(videos.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)' }}>
      <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>
        {t('program_videos')}
        <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
          ({videos.length.toLocaleString('fa-IR')} {t('videos_count_short')})
        </span>
      </h4>

      {/* Main YouTube search link field (auto-generated) */}
      <div className="mb-3">
        <label className="text-xs font-bold mb-1 block" style={{ color: '#5a6b4a' }}>{t('youtube_search_link')}</label>
        <input
          type="text"
          value={youtube}
          onChange={(e) => onYoutubeChange(e.target.value)}
          placeholder={t('youtube_ph')}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(13, 124, 74,0.15)',
            background: 'rgba(255, 255, 255, 0.8)',
            color: '#1a2e1a',
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            fontSize: '12px',
          }}
        />
      </div>

      {/* Add video URL */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())}
          placeholder={t('video_url_ph')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(13, 124, 74,0.15)',
            background: 'rgba(255, 255, 255, 0.8)',
            color: '#1a2e1a',
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            fontSize: '12px',
          }}
        />
        <button
          onClick={addVideo}
          disabled={!urlInput.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: !urlInput.trim() ? 'rgba(255, 255, 255, 0.6)' : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
            color: !urlInput.trim() ? '#999' : 'white',
            border: '1px solid rgba(13, 124, 74,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('add_video_btn')}
        </button>
      </div>

      {/* Video list */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((url, idx) => {
            const platform = getVideoPlatformInfo(url);
            const thumb = getYoutubeThumbnail(url);
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded-xl"
                style={{ background: 'rgba(255, 255, 255, 0.8)', border: '1px solid rgba(13, 124, 74,0.1)' }}
              >
                {/* Thumbnail or icon */}
                <div
                  className="w-16 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: thumb ? '#000' : `${platform.color}20` }}
                >
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <span className="text-xl">{platform.icon}</span>
                  )}
                </div>
                {/* Platform badge + URL */}
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-md font-bold mb-1"
                    style={{ background: `${platform.color}20`, color: platform.color }}
                  >
                    {platform.icon} {platform.name}
                  </span>
                  <div
                    className="text-xs truncate"
                    style={{ color: '#5a6b4a', direction: 'ltr', textAlign: 'left' }}
                    title={url}
                  >
                    {url}
                  </div>
                </div>
                {/* Open link */}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(13, 124, 74,0.1)', color: '#0d7c4a' }}
                  title={t('open_link_title')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                {/* Remove button */}
                <button
                  onClick={() => removeVideo(idx)}
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
                  title={t('delete_video_title')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Video editor button — compress/trim before upload */}
      {canEdit && onOpenVideoEditor && (
        <button
          onClick={onOpenVideoEditor}
          className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: 'rgba(0, 229, 239, 0.12)',
            color: '#00E5EF',
            border: '1px solid rgba(0, 229, 239, 0.30)',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          🎬 ویرایشگر ویدیو (فشرده‌سازی + برش)
        </button>
      )}
    </div>
  );
}

// ============================================
// PUBLISH MODAL — preview social media post before publishing
// ============================================

// ----- Social bot configuration (Telegram / Bale) -----
// Persisted in localStorage so the user enters their bot token + chat ID once.
type SocialBotConfig = {
  platform: 'telegram' | 'bale';
  token: string;
  chatId: string;
};

const BOT_CONFIG_KEY = 'bankresaneh_bot_config_v1';

function loadBotConfig(): SocialBotConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOT_CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if ((c.platform === 'telegram' || c.platform === 'bale') && typeof c.token === 'string' && typeof c.chatId === 'string') {
      return c;
    }
    return null;
  } catch {
    return null;
  }
}

function saveBotConfig(cfg: SocialBotConfig | null) {
  if (typeof window === 'undefined') return;
  try {
    if (cfg) window.localStorage.setItem(BOT_CONFIG_KEY, JSON.stringify(cfg));
    else window.localStorage.removeItem(BOT_CONFIG_KEY);
  } catch {
    // ignore storage errors
  }
}

// ============================================
// TAGS EDITOR — comma-separated input + removable pills + preset quick-adds
// ============================================
function TagsEditor({ tags, onChange, presetTags }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  presetTags?: string[];
}) {
  const { t: tr } = useLang();
  const [input, setInput] = useState('');

  const commit = (next: string[]) => {
    // De-duplicate + trim. Empty strings are dropped.
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const x of next) {
      const s = (x || '').trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push(s);
    }
    onChange(clean);
  };

  const addFromInput = () => {
    if (!input.trim()) return;
    // Split on commas (Persian & English) so the user can paste "tag1, tag2, tag3".
    const parts = input.split(/[,،]/).map(p => p.trim()).filter(Boolean);
    commit([...tags, ...parts]);
    setInput('');
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const togglePreset = (tag: string) => {
    const exists = tags.some(x => x.toLowerCase() === tag.toLowerCase());
    if (exists) {
      onChange(tags.filter(x => x.toLowerCase() !== tag.toLowerCase()));
    } else {
      commit([...tags, tag]);
    }
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
      <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>
        {tr('tags_section')}
        <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
          ({tags.length.toLocaleString('fa-IR')} {tr('tags_count_short')})
        </span>
      </h4>
      <p className="text-xs mb-3" style={{ color: '#8a8a7a' }}>
        {tr('tags_hint')}
      </p>

      {/* Comma-separated input + Add button */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(); } }}
          placeholder={tr('tags_input_ph')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            background: 'rgba(255, 255, 255, 0.8)',
            color: '#1a2e1a',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={addFromInput}
          disabled={!input.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: !input.trim() ? 'rgba(255, 255, 255, 0.6)' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            color: !input.trim() ? '#999' : 'white',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {tr('add_tag_btn')}
        </button>
      </div>

      {/* Removable pill list */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1"
              style={{ background: 'rgba(124, 58, 237, 0.18)', color: '#6d28d9', border: '1px solid rgba(124, 58, 237, 0.3)' }}
            >
              #{tag}
              <button
                onClick={() => removeTag(i)}
                aria-label={tr('remove_tag_aria', [tag])}
                className="hover:opacity-70"
                style={{ color: '#7c3aed', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                title={tr('delete_image_title')}
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs px-2 py-1 rounded-md font-medium"
            style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.25)' }}
            title={tr('clear_all')}
          >
            {tr('clear_all')}
          </button>
        </div>
      )}

      {/* Preset quick-add buttons (from the genre's presetTags) */}
      {presetTags && presetTags.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: '#5a6b4a' }}>{tr('preset_tags_label')}</div>
          <div className="flex items-center gap-2 flex-wrap">
            {presetTags.map(tag => {
              const selected = tags.some(x => x.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  key={tag}
                  onClick={() => togglePreset(tag)}
                  className="text-xs px-2 py-1 rounded-md font-medium transition-all"
                  style={selected ? {
                    background: 'rgba(124, 58, 237, 0.4)',
                    color: 'white',
                    border: '1px solid rgba(124, 58, 237, 0.6)',
                  } : {
                    background: 'rgba(124, 58, 237, 0.08)',
                    color: '#6d28d9',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                  }}
                >
                  {selected ? '✓ ' : '+ '}{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ADD GENRE MODAL — admin creates a new Genre (name + description + color)
// ============================================
const GENRE_COLOR_PRESETS = [
  '#10b981', '#0ea5e9', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0d7c4a',
];

function AddGenreModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (g: Genre) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(GENRE_COLOR_PRESETS[0]);
  const { t } = useLang();
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = 'custom-' + Date.now().toString(36);
    const g: Genre = {
      id,
      key: id,
      nameFa: trimmed,
      name: trimmed,
      color,
      description: description.trim() || `ژانر سفارشی: ${trimmed}`,
      filterFn: (s: TalkShow) => s.category.includes(trimmed),
      isCustom: true,
      tags: DEFAULT_GENRE_TAGS,
      presetTags: [],
      searchFields: ['name', 'summary', 'category', 'descriptionFa'] as (keyof TalkShow)[],
    };
    onSave(g);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>{t('add_genre_modal_title')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{t('genre_name_label')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('genre_name_ph')}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74, 0.15)',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{t('genre_desc_label')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('genre_desc_ph')}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74, 0.15)',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>{t('genre_color_label')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {GENRE_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-9 h-9 rounded-full transition-all"
                  style={{
                    background: c,
                    border: color === c ? '3px solid #1a2e1a' : '3px solid transparent',
                    boxShadow: color === c ? `0 0 0 3px ${c}40` : 'none',
                    cursor: 'pointer',
                  }}
                  aria-label={`رنگ ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
              border: `1px solid ${color}50`,
            }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: '#8a8a7a' }}>{t('preview_label')}</div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              ></span>
              <strong style={{ color: '#1a2e1a' }}>{name || '—'}</strong>
            </div>
            <p className="text-xs mt-1" style={{ color: '#5a6b4a' }}>{description || t('preview_ph')}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-enter-premium flex-1"
              style={{ opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
            >
              {t('save_genre_btn')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122,0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122,0.3)' }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SOCIAL_PLATFORMS = [
  { id: 'telegram', name: 'تلگرام', color: '#0088cc', icon: '✈' },
  { id: 'bale', name: 'بله', color: '#ffaa00', icon: '💬' },
  { id: 'ita', name: 'ایفا', color: '#3b82f6', icon: '📧' },
  { id: 'soroush', name: 'سروش', color: '#f97316', icon: '📱' },
  { id: 'gap', name: 'گپ', color: '#22c55e', icon: '💬' },
  { id: 'instagram', name: 'اینستاگرام', color: '#e1306c', icon: '📷' },
];

function PublishModal({ shows, onClose, onConfirm, onOpenBotConfig }: {
  shows: TalkShow[];
  onClose: () => void;
  onConfirm: (platform: string) => void;
  onOpenBotConfig: () => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [postText, setPostText] = useState(
    shows.length === 1
      ? `🎬 ${shows[0].name}\n\n📝 ${shows[0].descriptionFa}\n\n🏷 ${shows[0].category.replace(/^\d+\.\s*/, '')}\n\n🔗 تماشا: ${shows[0].youtube}\n\n#بانک_رسانه #تاک_شو #برنامه_تلویزیونی`
      : `🎬 ${shows.length.toLocaleString('fa-IR')} برنامهٔ منتخب بانک رسانه\n\n${shows.map(s => `• ${s.name} — ${s.descriptionFa.substring(0, 60)}...`).join('\n\n')}\n\n#بانک_رسانه #تاک_شو`
  );
  // Direct-send state (Telegram / Bale only)
  const [botConfig, setBotConfig] = useState<SocialBotConfig | null>(() => loadBotConfig());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const directSendSupported = selectedPlatform === 'تلگرام' || selectedPlatform === 'بله';

  // Send the post directly to the selected channel via the /api/publish-social route.
  const handleDirectSend = async () => {
    if (!botConfig || !botConfig.token || !botConfig.chatId) {
      setSendResult({ ok: false, msg: 'ابتدا تنظیمات ربات را وارد کنید' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      // Pick the first available image (real program image if present)
      const imageUrl = shows.length === 1 && shows[0].images && shows[0].images.length > 0
        ? shows[0].images[0]
        : undefined;
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: botConfig.platform,
          token: botConfig.token,
          chatId: botConfig.chatId,
          text: postText,
          imageUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSendResult({ ok: true, msg: `✅ پست به ${selectedPlatform} ارسال شد` });
      } else {
        setSendResult({ ok: false, msg: `❌ ${data.error || 'ارسال ناموفق'}` });
      }
    } catch {
      setSendResult({ ok: false, msg: '❌ خطای شبکه هنگام ارسال' });
    } finally {
      setSending(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPlatform) return;

    // Generate a social card image using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.6, '#0d7c4a');
    grad.addColorStop(1, '#0a1f14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative circles
    ctx.fillStyle = 'rgba(13, 124, 74, 0.15)';
    ctx.beginPath();
    ctx.arc(900, 200, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(200, 900, 250, 0, Math.PI * 2);
    ctx.fill();

    // "بانک رسانه" branding
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 32px Vazirmatn, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بانک رسانه', 540, 100);

    // Show name(s)
    ctx.fillStyle = 'white';
    ctx.font = 'bold 56px Vazirmatn, sans-serif';
    if (shows.length === 1) {
      const name = shows[0].name;
      ctx.fillText(name.length > 25 ? name.substring(0, 23) + '...' : name, 540, 250);
    } else {
      ctx.fillText(`${shows.length} برنامهٔ منتخب`, 540, 250);
    }

    // Description
    ctx.font = '36px Vazirmatn, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    if (shows.length === 1) {
      const desc = shows[0].descriptionFa;
      const lines = desc.match(/.{1,40}/g) || [];
      lines.slice(0, 4).forEach((line, i) => {
        ctx.fillText(line, 540, 350 + i * 50);
      });
    } else {
      shows.slice(0, 5).forEach((s, i) => {
        ctx.fillText(`• ${s.name}`, 540, 350 + i * 50);
      });
      if (shows.length > 5) {
        ctx.fillText(`و ${shows.length - 5} برنامهٔ دیگر...`, 540, 350 + 5 * 50);
      }
    }

    // Category badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(340, 700, 400, 60, 30);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Vazirmatn, sans-serif';
    const cat = shows[0]?.category?.replace(/^\d+\.\s*/, '') || 'تاک‌شو';
    ctx.fillText(cat, 540, 740);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'banke-rasane-card.png', { type: 'image/png' });

      // Try Web Share API first (native share dialog on mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'بانک رسانه',
            text: postText,
            files: [file],
          });
          onConfirm(selectedPlatform);
          return;
        } catch (e) {
          // User cancelled or error — fall through to fallback
        }
      }

      // Fallback: download image, copy text, and open platform share URL
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'banke-rasane-card.png';
      a.click();
      URL.revokeObjectURL(url);

      // Copy text to clipboard
      try {
        await navigator.clipboard.writeText(postText);
      } catch {}

      // Open platform-specific share URL
      const platformUrls: Record<string, string> = {
        'تلگرام': `https://t.me/share/url?url=${encodeURIComponent(shows[0]?.youtube || 'https://github.com/salbeheshti-lang/banke-rasane')}&text=${encodeURIComponent(postText)}`,
        'بله': 'https://ble.ir/',
        'ایفا': 'https://eitaa.com/',
        'سروش': 'https://splus.ir/',
        'گپ': 'https://gap.im/',
        'اینستاگرام': 'https://www.instagram.com/',
      };
      const shareUrl = platformUrls[selectedPlatform];
      if (shareUrl) {
        window.open(shareUrl, '_blank');
      }

      onConfirm(selectedPlatform + ' — تصویر دانلود شد، متن کپی شد، پلتفرم باز شد');
    }, 'image/png');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>📱 انتشار در شبکه‌های اجتماعی</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform selection */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>انتخاب پلتفرم</h4>
            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.name)}
                  className="p-3 rounded-xl text-center transition-all"
                  style={selectedPlatform === p.name ? {
                    background: p.color,
                    color: 'white',
                    border: `2px solid ${p.color}`,
                  } : {
                    background: `${p.color}15`,
                    color: p.color,
                    border: `1px solid ${p.color}30`,
                  }}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <div className="text-sm font-bold">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Post preview — with image + description */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>پیش‌نمایش پست</h4>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              {/* Card image preview — real program image or 1080x1080 social card */}
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '1/1',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #0a1f14 100%)',
                  maxHeight: '400px',
                }}
              >
                {/* Real program image as background if available */}
                {shows.length === 1 && shows[0].images && shows[0].images.length > 0 && (
                  <img
                    src={shows[0].images[0]}
                    alt={shows[0].name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      opacity: 0.7,
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(1,10,5,0.3) 0%, rgba(1,10,5,0.8) 100%)' }}></div>

                <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center text-white">
                  <div className="text-xs mb-3 opacity-60">بانک رسانه</div>
                  <div className="text-2xl font-bold mb-4">
                    {shows.length === 1 ? shows[0].name : `${shows.length.toLocaleString('fa-IR')} برنامهٔ منتخب`}
                  </div>
                  {/* Description */}
                  <div className="text-sm opacity-80 max-w-xs line-clamp-3" style={{ lineHeight: 1.6 }}>
                    {shows.length === 1
                      ? shows[0].descriptionFa
                      : shows.slice(0, 3).map(s => `• ${s.name}`).join('  ')
                    }
                  </div>
                  {/* Category badge */}
                  <div className="mt-4 px-4 py-1.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                    {shows[0]?.category?.replace(/^\d+\.\s*/, '') || 'تاک‌شو'}
                  </div>
                </div>
              </div>
              {/* Post text — editable */}
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  color: '#1a2e1a',
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Direct send (Telegram / Bale only) */}
            {directSendSupported && (
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.18)' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: '#1a2e1a' }}>📡 ارسال مستقیم به {selectedPlatform}</div>
                    <div className="text-xs" style={{ color: '#8a8a7a' }}>
                      {botConfig
                        ? `ربات ${botConfig.platform === 'telegram' ? 'تلگرام' : 'بله'} پیکربندی شده — مقصد: ${botConfig.chatId}`
                        : 'برای ارسال مستقیم، ابتدا توکن ربات و شناسهٔ کانال را وارد کنید'}
                    </div>
                  </div>
                  <button
                    onClick={onOpenBotConfig}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{ background: 'rgba(13, 124, 74,0.12)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74,0.3)' }}
                  >
                    {botConfig ? '⚙ تنظیمات ربات' : '＋ پیکربندی ربات'}
                  </button>
                </div>
                <button
                  onClick={handleDirectSend}
                  disabled={!botConfig || sending}
                  className="btn-enter-premium w-full mt-3"
                  style={{ opacity: botConfig && !sending ? 1 : 0.5, cursor: botConfig && !sending ? 'pointer' : 'not-allowed' }}
                >
                  {sending ? '⏳ در حال ارسال...' : `📡 ارسال مستقیم به ${selectedPlatform}`}
                </button>
                {sendResult && (
                  <div
                    className="mt-2 text-xs font-medium px-3 py-2 rounded-lg"
                    style={{
                      background: sendResult.ok ? 'rgba(13, 124, 74,0.12)' : 'rgba(220,38,38,0.1)',
                      color: sendResult.ok ? '#0d7c4a' : '#dc2626',
                    }}
                  >
                    {sendResult.msg}
                  </div>
                )}
              </div>
            )}

            {/* Manual fallback (download image + copy text + open platform) */}
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                disabled={!selectedPlatform}
                className="btn-enter-premium flex-1"
                style={{ opacity: selectedPlatform ? 1 : 0.5, cursor: selectedPlatform ? 'pointer' : 'not-allowed' }}
              >
                {selectedPlatform ? `📤 انتشار دستی در ${selectedPlatform}` : 'ابتدا پلتفرم را انتخاب کنید'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(107, 143, 122,0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122,0.3)' }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BOT CONFIG MODAL — configure Telegram/Bale bot token + chat ID
// ============================================
function BotConfigModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const initial = loadBotConfig();
  const [platform, setPlatform] = useState<'telegram' | 'bale'>(initial?.platform || 'telegram');
  const [token, setToken] = useState(initial?.token || '');
  const [chatId, setChatId] = useState(initial?.chatId || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleTest = async () => {
    if (!token) { setTestResult({ ok: false, msg: 'توکن را وارد کنید' }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/publish-social?platform=${platform}&token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: `✅ ربات «@${data.bot.username}» شناسایی شد` });
      } else {
        setTestResult({ ok: false, msg: `❌ ${data.error || 'توکن نامعتبر'}` });
      }
    } catch {
      setTestResult({ ok: false, msg: '❌ خطای شبکه' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!token || !chatId) return;
    saveBotConfig({ platform, token, chatId });
    onSaved();
  };

  const handleClear = () => {
    saveBotConfig(null);
    setToken('');
    setChatId('');
    setTestResult(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>⚙ تنظیمات ربات انتشار</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Intro help */}
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)', color: '#5a6b4a' }}>
            برای ارسال مستقیم پست‌ها به کانال یا گروه، یک ربات بسازید و آن را ادمین مقصد کنید:
            <ul className="mt-2 space-y-1 text-xs" style={{ color: '#8a8a7a' }}>
              <li>• تلگرام: ربات <code style={{ direction: 'ltr' }}>@BotFather</code> → /newbot</li>
              <li>• بله: ربات <code style={{ direction: 'ltr' }}>@BotFather@</code> → ساخت ربات جدید</li>
              <li>• سپس ربات را به کانال/گروه ادمین کنید</li>
            </ul>
          </div>

          {/* Platform picker */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>پلتفرم</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPlatform('telegram')}
                className="p-3 rounded-xl text-center transition-all"
                style={platform === 'telegram' ? { background: '#0088cc', color: 'white', border: '2px solid #0088cc' } : { background: '#0088cc15', color: '#0088cc', border: '1px solid #0088cc30' }}
              >
                <div className="text-2xl mb-1">✈</div>
                <div className="text-sm font-bold">تلگرام</div>
              </button>
              <button
                onClick={() => setPlatform('bale')}
                className="p-3 rounded-xl text-center transition-all"
                style={platform === 'bale' ? { background: '#ffaa00', color: 'white', border: '2px solid #ffaa00' } : { background: '#ffaa0015', color: '#ffaa00', border: '1px solid #ffaa0030' }}
              >
                <div className="text-2xl mb-1">💬</div>
                <div className="text-sm font-bold">بله</div>
              </button>
            </div>
          </div>

          {/* Bot token */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>توکن ربات (Bot Token)</label>
            <div className="flex gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCdefGhIjKlMnOpQrStUvWxYz"
                dir="ltr"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(13, 124, 74,0.15)',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#1a2e1a',
                  fontFamily: 'monospace',
                  outline: 'none',
                  textAlign: 'left',
                }}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="px-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(107, 143, 122,0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122,0.3)' }}
              >
                {showToken ? '🙈 پنهان' : '👁 نمایش'}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>شناسهٔ مقصد (Chat ID)</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="@channelusername یا -1001234567890"
              dir="ltr"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74,0.15)',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'monospace',
                outline: 'none',
                textAlign: 'left',
              }}
            />
            <p className="text-xs mt-1" style={{ color: '#8a8a7a' }}>
              برای کانال: نام کاربری کانال (مثل @mychannel) یا Chat ID عددی. برای چت خصوصی: Chat ID عددی شما.
            </p>
          </div>

          {/* Test button */}
          <button
            onClick={handleTest}
            disabled={testing || !token}
            className="px-4 py-2 rounded-xl text-sm font-medium w-full"
            style={{
              background: testing || !token ? 'rgba(107, 143, 122,0.15)' : 'rgba(13, 124, 74,0.12)',
              color: testing || !token ? '#8a8a7a' : '#0d7c4a',
              border: '1px solid ' + (testing || !token ? 'rgba(107, 143, 122,0.3)' : 'rgba(13, 124, 74,0.3)'),
              cursor: testing || !token ? 'not-allowed' : 'pointer',
            }}
          >
            {testing ? '⏳ در حال بررسی...' : '🔍 تست اتصال ربات'}
          </button>
          {testResult && (
            <div
              className="text-sm font-medium px-3 py-2 rounded-lg"
              style={{
                background: testResult.ok ? 'rgba(13, 124, 74,0.12)' : 'rgba(220,38,38,0.1)',
                color: testResult.ok ? '#0d7c4a' : '#dc2626',
              }}
            >
              {testResult.msg}
            </div>
          )}

          {/* Save / clear */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!token || !chatId}
              className="btn-enter-premium flex-1"
              style={{ opacity: token && chatId ? 1 : 0.5, cursor: token && chatId ? 'pointer' : 'not-allowed' }}
            >
              ✓ ذخیره تنظیمات
            </button>
            {initial && (
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}
              >
                🗑 پاک کردن
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORT PREVIEW MODAL — preview PDF/Excel before download
// ============================================
function ExportPreviewModal({ shows, format, onClose, onDownload }: {
  shows: TalkShow[];
  format: 'pdf' | 'excel';
  onClose: () => void;
  onDownload: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (format === 'pdf') {
        // Call API to generate professional PDF report
        const res = await fetch('/api/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shows }),
        });
        if (res.ok) {
          const html = await res.text();
          // Open in new window for print-to-PDF
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            // Wait for fonts to load before printing — the PDF uses Vazirmatn
            // loaded from a CDN, which can take >1s. If we print too early,
            // Persian text renders in a fallback font and looks broken.
            const triggerPrint = () => setTimeout(() => { w.print(); }, 300);
            if (w.document.fonts && w.document.fonts.ready) {
              w.document.fonts.ready.then(triggerPrint).catch(triggerPrint);
            } else {
              setTimeout(() => { w.print(); }, 2000);
            }
          }
        }
      } else {
        // Excel: generate a styled HTML table that Excel/LibreOffice opens natively
        // (saved with .xls extension + Excel MIME type). This preserves Persian text,
        // colors, and column widths better than CSV.
        const headers = ['شماره', 'نام برنامه', 'دسته‌بندی', 'منبع', 'اندازه', 'تماشاگر', 'سبک', 'افکت', 'چیدمان', 'عناصر', 'مواد', 'رنگ‌ها', 'نورپردازی', 'خلاصه', 'توضیحات', 'یوتیوب', 'IMDb', 'ویکی‌پدیا', 'کشور'];
        const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const rows = shows.map((s, i) => [
          i + 1, s.name, (s.category || '').replace(/^\d+\.\s*/, ''), s.source, s.size, s.viewers,
          s.style, s.effects, s.layout, s.elements, s.materials, s.colors, s.lighting,
          (s.summary || '').substring(0, 300), (s.descriptionFa || '').substring(0, 500),
          s.youtube, s.imdb, s.wikipedia, s.country,
        ]);
        // Build a styled HTML table (Excel reads HTML tables with inline styles)
        const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
          body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; vertical-align: top; }
          th { background: #0d7c4a; color: white; font-weight: bold; font-size: 12px; }
          tr:nth-child(even) { background: #f0fdf4; }
          td { font-size: 11px; }
        </style></head><body>
        <h2 style="font-family: Tahoma;">بانک رسانه — گزارش برنامه‌ها (${shows.length.toLocaleString('fa-IR')} برنامه)</h2>
        <table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        </body></html>`;
        const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `بانک-رسانه-${new Date().toISOString().slice(0, 10)}.xls`;
        a.click();
        URL.revokeObjectURL(url);
      }
      onDownload();
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>
            {format === 'pdf' ? '📄 پیش‌نمایش گزارش PDF' : '📊 پیش‌نمایش گزارش Excel'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.08)', border: '1px solid rgba(13, 124, 74,0.2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ color: '#5a6b4a' }}>تعداد برنامه‌ها</div>
                <div className="text-2xl font-bold" style={{ color: '#0d7c4a' }}>{shows.length.toLocaleString('fa-IR')}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#5a6b4a' }}>فرمت</div>
                <div className="text-2xl font-bold" style={{ color: format === 'pdf' ? '#dc2626' : '#0d7c4a' }}>{format.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#5a6b4a' }}>تاریخ</div>
                <div className="text-2xl font-bold" style={{ color: '#1a2e1a' }}>{new Date().toLocaleDateString('fa-IR')}</div>
              </div>
            </div>
          </div>

          {/* PDF report preview — multi-section professional template */}
          {format === 'pdf' && (
            <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: '2px solid #0d7c4a', boxShadow: '0 8px 24px rgba(13, 124, 74, 0.15)' }}>
              {/* Cover preview */}
              <div
                className="p-6 text-center relative overflow-hidden"
                style={{
                  background: 'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(54, 179, 126, 0.35) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 25% 80%, rgba(13, 124, 74, 0.4) 0%, transparent 60%), linear-gradient(160deg, #0a1f14 0%, #0d2218 50%, #0a1f14 100%)',
                  color: 'white',
                }}
              >
                <div style={{ color: 'rgba(134, 239, 172, 0.6)', fontSize: '11px', letterSpacing: '4px', marginBottom: '12px' }}>بانک رسانه</div>
                {/* Real app logo image — same file used in the login screen + PDF cover */}
                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    src="/banke-rasane-logo.png"
                    alt="بانک رسانه"
                    style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.4))' }}
                  />
                </div>
                <h3 className="text-xl font-black mb-2" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>گزارش جامع آرشیو برنامه‌های تلویزیونی</h3>
                <p className="text-xs" style={{ color: 'rgba(134, 239, 172, 0.8)' }}>بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی</p>
                <div
                  className="flex justify-center gap-4 mt-4 mx-auto"
                  style={{
                    background: 'rgba(13, 124, 74, 0.1)',
                    border: '1px solid rgba(13, 124, 74, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    maxWidth: '380px',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div>
                    <div className="text-xl font-black" style={{ color: '#10b981' }}>{shows.length.toLocaleString('fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(134, 239, 172, 0.7)' }}>برنامه</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(16, 185, 129, 0.3)' }}></div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#10b981' }}>{new Set(shows.map(s => s.category)).size.toLocaleString('fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(134, 239, 172, 0.7)' }}>دستهٔ ژانری</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(16, 185, 129, 0.3)' }}></div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#10b981' }}>{new Date().toLocaleDateString('fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(134, 239, 172, 0.7)' }}>تاریخ</div>
                  </div>
                </div>
              </div>

              {/* Sections list — shows the report structure with descriptions */}
              <div className="p-4" style={{ background: '#f8faf9' }}>
                <div className="text-xs font-bold mb-3" style={{ color: '#0d7c4a', paddingRight: '8px', borderRight: '3px solid #0d7c4a' }}>
                  ساختار گزارش (۸ بخش) — هر بخش شامل توضیحات کامل
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { n: 1, t: 'خلاصه اجرایی', icon: '📋', desc: 'مرور کلی آرشیو، حجم داده‌ها، یافته‌های کلیدی و نکات مهم برای تصمیم‌گیرندگان' },
                    { n: 2, t: 'روش جمع‌آوری داده', icon: '🔬', desc: 'توضیح منابع داده، فرایند طبقه‌بندی ژانری و رویکرد ترکیبی' },
                    { n: 3, t: 'نمای آماری کلی', icon: '📊', desc: '۴ کارت آماری + ۵ نمودار میله‌ای: اندازه استودیو، سبک دکور، تماشاگر، نورپردازی، چیدمان' },
                    { n: 4, t: 'تحلیل توزیع ژانرها', icon: '🏷', desc: 'نمودار کامل توزیع + معرفی تفصیلی هر دسته با شمارش، درصد، و برنامه‌های شاخص' },
                    { n: 5, t: 'تحلیل دکور و صحنه', icon: '🎨', desc: '۴ نمودار: عناصر پرتکرار صحنه، مصالح، طیف رنگی، نورپردازی + یافته‌های تحلیلی' },
                    { n: 6, t: 'فهرست تفصیلی برنامه‌ها', icon: '📚', desc: 'کارت کامل برای هر برنامه: تصویر، توضیحات فارسی، تگ‌ها، مشخصات دکور، خلاصه' },
                    { n: 7, t: 'نتیجه‌گیری و پیشنهادها', icon: '💡', desc: 'جمع‌بندی یافته‌ها + ۵ پیشنهاد اجرایی + بخش امضا و تاریخ' },
                    { n: 8, t: 'پیوست: نمایهٔ الفبایی', icon: '📑', desc: 'فهرست کامل همهٔ برنامه‌ها به ترتیب الفبایی با شماره و دستهٔ ژانری' },
                  ].map(s => (
                    <div
                      key={s.n}
                      className="p-3 rounded-lg flex gap-2.5"
                      style={{ background: 'white', border: '1px solid rgba(13, 124, 74, 0.3)' }}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)', color: 'white', boxShadow: '0 2px 6px rgba(13, 124, 74, 0.3)' }}
                      >
                        {s.n.toLocaleString('fa-IR')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{s.icon}</span>
                          <span className="text-xs font-bold" style={{ color: '#1a2e1a' }}>{s.t}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: '#5a6b4a', fontSize: '10.5px' }}>
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample program card preview */}
              <div className="p-4" style={{ background: 'white', borderTop: '1px solid rgba(13, 124, 74, 0.3)' }}>
                <div className="text-xs font-bold mb-2" style={{ color: '#0d7c4a' }}>نمونه کارت برنامه (از بخش ۶)</div>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid rgba(13, 124, 74, 0.3)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="p-2 flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f0f8f4 0%, #e8f4ee 100%)', borderBottom: '1px solid #c8e0d4' }}
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#0d7c4a', color: 'white' }}
                    >۱</span>
                    <span className="text-xs font-bold flex-1" style={{ color: '#1a2e1a', direction: 'ltr', textAlign: 'right' }}>
                      {shows[0]?.name || 'نمونه برنامه'}
                    </span>
                    <span className="text-xs" style={{ color: '#8a8a7a' }}>شناسه: ۱</span>
                  </div>
                  <div className="p-2 flex gap-2">
                    <div
                      className="w-12 h-9 rounded flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)' }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(13, 124, 74,0.08)', color: '#0d7c4a', fontSize: '9px' }}>
                          {shows[0]?.style || 'مدرن'}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(13, 124, 74,0.08)', color: '#0d7c4a', fontSize: '9px' }}>
                          {shows[0]?.size || 'متوسط'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#2a3a30', lineHeight: 1.5 }}>
                        {(shows[0]?.descriptionFa || '').substring(0, 100)}...
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {shows.length > 80 && (
                <div className="p-2 text-center text-xs" style={{ background: '#fef9e7', color: '#8a8a7a' }}>
                  در گزارش کامل، ۸۰ برنامهٔ نخست به‌صورت تفصیلی و همهٔ {shows.length.toLocaleString('fa-IR')} برنامه در نمایهٔ الفبایی
                </div>
              )}
            </div>
          )}

          {/* Excel preview */}
          {format === 'excel' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              <div className="p-3 text-center" style={{ background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)', color: 'white' }}>
                <div className="text-lg font-bold">بانک رسانه — خروجی Excel</div>
                <div className="text-xs opacity-80">{shows.length.toLocaleString('fa-IR')} برنامه</div>
              </div>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="w-full" style={{ fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f5efe0', zIndex: 1 }}>
                    <tr>
                      <th className="text-right p-2 font-bold" style={{ color: '#5a6b4a' }}>#</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#5a6b4a' }}>نام</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#5a6b4a' }}>دسته</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#5a6b4a' }}>سبک</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#5a6b4a' }}>اندازه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shows.slice(0, 50).map((s, i) => (
                      <tr key={s.num} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.6)' }}>
                        <td className="p-2" style={{ color: '#8a8a7a' }}>{(i + 1).toLocaleString('fa-IR')}</td>
                        <td className="p-2 font-medium" style={{ color: '#1a2e1a', direction: 'ltr', textAlign: 'right' }}>{s.name}</td>
                        <td className="p-2" style={{ color: '#5a6b4a' }}>{s.category.replace(/^\d+\.\s*/, '').substring(0, 20)}</td>
                        <td className="p-2" style={{ color: '#5a6b4a' }}>{s.style}</td>
                        <td className="p-2" style={{ color: '#5a6b4a' }}>{s.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Download button */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-enter-premium flex-1"
            >
              {downloading ? '⏳ در حال تولید...' : `⬇ دانلود فایل ${format.toUpperCase()}`}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122,0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122,0.3)' }}
            >
              انصراف
            </button>
          </div>
          {format === 'pdf' && (
            <p className="mt-3 text-xs text-center" style={{ color: '#8a8a7a', lineHeight: 1.7 }}>
              گزارش شامل ۸ بخش است: صفحهٔ عنوان، فهرست مطالب، خلاصهٔ اجرایی، روش تحقیق، نمای آماری، تحلیل ژانرها، تحلیل دکور، و معرفی تفصیلی برنامه‌ها.<br />
              پس از کلیک روی دانلود، پنجره چاپ باز می‌شود — مقاس «A4» و «Save as PDF» را انتخاب کنید.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// REPORTS VIEW
// ============================================
function ReportsView({ talkShows, uploadedShows, showToast, onExport }: {
  talkShows: TalkShow[];
  uploadedShows: number[];
  showToast: (msg: string) => void;
  onExport: (shows: TalkShow[], format: 'pdf' | 'excel') => void;
}) {
  // Derive real stats from the dataset — previously this used stats.pdf / stats.web
  // which were never defined, crashing the whole view.
  const stats = {
    total: talkShows.length,
    uploaded: uploadedShows.length,
    withImages: talkShows.filter(s => (s.images?.length || 0) > 0).length,
    withVideo: talkShows.filter(s => (s.videos?.length || 0) > 0).length,
    genres: new Set(talkShows.map(s => s.category).filter(Boolean)).size,
    withSocial: talkShows.filter(s => s.socialPost || s.youtube || s.imdb || s.wikipedia).length,
  };

  const reports = [
    { id: 1, title: 'گزارش کامل همهٔ برنامه‌ها', type: 'pdf' as const,   count: stats.total,    date: '۱۴۰۴/۰۸/۲۵' },
    { id: 2, title: 'گزارش برنامه‌های آپلود شده در فضای مجازی', type: 'excel' as const, count: stats.uploaded, date: '۱۴۰۴/۰۸/۲۵' },
    { id: 3, title: 'گزارش برنامه‌های دارای تصویر', type: 'pdf' as const,  count: stats.withImages, date: '۱۴۰۴/۰۸/۲۵' },
    { id: 4, title: 'گزارش برنامه‌های دارای ویدئو', type: 'pdf' as const,  count: stats.withVideo, date: '۱۴۰۴/۰۸/۲۵' },
    { id: 5, title: 'گزارش برنامه‌های با حضور در شبکه‌های اجتماعی', type: 'excel' as const, count: stats.withSocial, date: '۱۴۰۴/۰۸/۲۵' },
  ];

  const handleDownload = (r: typeof reports[number]) => {
    let shows: TalkShow[] = [];
    if (r.id === 1) shows = talkShows;
    else if (r.id === 2) shows = talkShows.filter(s => uploadedShows.includes(s.num));
    else if (r.id === 3) shows = talkShows.filter(s => (s.images?.length || 0) > 0);
    else if (r.id === 4) shows = talkShows.filter(s => (s.videos?.length || 0) > 0);
    else if (r.id === 5) shows = talkShows.filter(s => s.socialPost || s.youtube || s.imdb || s.wikipedia);
    if (shows.length === 0) { showToast('برنامه‌ای برای این گزارش وجود ندارد'); return; }
    onExport(shows, r.type);
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>گزارش‌ها</h1>
        <p style={{ color: 'var(--text-muted)' }}>آمار و گزارش‌های بانک رسانه</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: 'var(--accent-bright)' }}>{stats.total.toLocaleString('fa-IR')}</div>
          <div style={{ color: 'var(--text-secondary)' }} className="text-sm">کل برنامه‌ها</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#7c3aed' }}>{stats.uploaded.toLocaleString('fa-IR')}</div>
          <div style={{ color: 'var(--text-secondary)' }} className="text-sm">آپلود شده</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#dc2626' }}>{stats.genres.toLocaleString('fa-IR')}</div>
          <div style={{ color: 'var(--text-secondary)' }} className="text-sm">ژانرها</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#0891b2' }}>{stats.withImages.toLocaleString('fa-IR')}</div>
          <div style={{ color: 'var(--text-secondary)' }} className="text-sm">با تصویر</div>
        </div>
      </div>

      <div className="premium-glass overflow-hidden">
        <div className="p-5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>گزارش‌های موجود</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(13, 124, 74, 0.08)', borderBottom: '1px solid var(--glass-border-strong)' }}>
              <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>#</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>عنوان</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>نوع</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>تعداد</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>تاریخ</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, idx) => (
              <tr
                key={r.id}
                style={{ borderBottom: '1px solid var(--glass-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13, 124, 74, 0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>{(idx + 1).toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.title}</td>
                <td className="p-4 hidden sm:table-cell">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={r.type === 'pdf'
                      ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                      : { background: 'rgba(13, 124, 74, 0.15)', color: 'var(--accent)' }
                    }
                  >
                    {r.type === 'pdf' ? 'PDF' : 'Excel'}
                  </span>
                </td>
                <td className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.count.toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{r.date}</td>
                <td className="p-4">
                  <button
                    className="text-sm hover:underline font-bold"
                    style={{ color: 'var(--accent-bright)' }}
                    onClick={() => handleDownload(r)}
                  >
                    دانلود
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================
// PROFILE SHEET — compact contact-card style overlay
// Inspired by iPhone contact cards: a small centered modal with a tight
// hero (avatar + name + role) and stacked, single-column fields.
// Keeps the premium-show-card aesthetic (glass + emerald gradient cover).
// ============================================
function ProfileSheet({
  currentUser,
  onClose,
  showToast,
  onProfileUpdated,
  onOpenSettings,
}: {
  currentUser: User;
  onClose: () => void;
  showToast: (msg: string) => void;
  onProfileUpdated?: (u: User) => void;
  onOpenSettings: () => void;
}) {
  const [profileName, setProfileName] = useState(currentUser.name || currentUser.username);
  const [profileAvatar, setProfileAvatar] = useState<string>(currentUser.avatar || '');
  const [profileJobTitle, setProfileJobTitle] = useState(currentUser.jobTitle || '');
  const [profileDeputy, setProfileDeputy] = useState(currentUser.deputy || '');
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  // Phone field is always editable for the user themselves (they fill it in),
  // but in the users-list view only admins see it.
  const showPhoneField = true;

  // Pull the latest profile from the server when the sheet opens.
  useEffect(() => {
    let cancelled = false;
    api.getProfile().then((u) => {
      if (cancelled) return;
      setProfileName(u.name || u.username);
      setProfileAvatar(u.avatar || '');
      setProfileJobTitle(u.jobTitle || '');
      setProfileDeputy(u.deputy || '');
      setProfilePhone(u.phone || '');
    }).catch(() => { /* fall back to currentUser */ });
    return () => { cancelled = true; };
  }, [currentUser]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveProfile = async () => {
    // Phone is required (admin needs it to contact users).
    const phone = profilePhone.trim();
    if (!phone) {
      showToast('شماره تماس را وارد کنید');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile({
        name: profileName,
        jobTitle: profileJobTitle,
        deputy: profileDeputy,
        phone: profilePhone,
        avatar: profileAvatar,
      });
      onProfileUpdated?.(updated);
      showToast('پروفایل ذخیره شد');
    } catch (e: any) {
      showToast(e?.message || 'خطا در ذخیره پروفایل');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('فقط فایل تصویری قابل قبول است');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256);
          setProfileAvatar(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="profile-sheet-backdrop"
      onClick={onClose}
    >
      <div
        className="profile-sheet relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero — full-width square banner image (like a program cover) with
            fallback gradient. Camera button overlays bottom-right. */}
        <div className="profile-sheet-hero">
          {/* Banner image OR fallback gradient */}
          {profileAvatar ? (
            <img
              src={profileAvatar}
              alt="avatar"
              className="profile-sheet-banner-img"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="profile-sheet-banner-fallback">
              <span className="profile-sheet-banner-initial">
                {(profileName || currentUser.username).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Dark gradient overlay at bottom so the name is readable */}
          <div className="profile-sheet-banner-scrim" />
          {/* Glass shine top highlight */}
          <div className="profile-sheet-shine" />
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="بستن"
            className="profile-sheet-close"
            title="بستن"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Name + role + meta overlaid on the banner bottom (like program cards) */}
          <div className="profile-sheet-banner-overlay">
            <div className="profile-sheet-name">{profileName || currentUser.username}</div>
            <div className="profile-sheet-meta">
              <span className="profile-role-badge" data-role={currentUser.role}>
                {currentUser.role === 'admin' ? 'مدیر سیستم' : currentUser.role === 'editor' ? 'ویراستار' : 'بیننده'}
              </span>
              {profileJobTitle && <span className="profile-meta-chip">{profileJobTitle}</span>}
              {profileDeputy && <span className="profile-meta-chip">{profileDeputy}</span>}
            </div>
          </div>
          {/* Camera upload button — bottom-right corner of banner */}
          <label className="profile-sheet-avatar-upload" title="تغییر تصویر">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>

        {/* Username line — below banner */}
        <div className="profile-sheet-identity">
          <div className="profile-sheet-username" dir="ltr">@{currentUser.username}</div>
        </div>

        {/* Compact fields — single column, tight spacing */}
        <div className="profile-sheet-fields">
          <div className="profile-field-card profile-field-compact">
            <label className="profile-field-label">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              نام نمایشی
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="نام و نام خانوادگی"
              className="profile-field-input profile-field-input-compact"
            />
          </div>

          <div className="profile-field-card profile-field-compact">
            <label className="profile-field-label">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              عنوان شغلی
            </label>
            <input
              type="text"
              value={profileJobTitle}
              onChange={(e) => setProfileJobTitle(e.target.value)}
              placeholder="مثلاً: کارشناس رسانه"
              className="profile-field-input profile-field-input-compact"
            />
          </div>

          <div className="profile-field-card profile-field-compact">
            <label className="profile-field-label">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
              </svg>
              معاونت و سمت
            </label>
            <input
              type="text"
              value={profileDeputy}
              onChange={(e) => setProfileDeputy(e.target.value)}
              placeholder="مثلاً: معاونت برنامه‌سازی"
              className="profile-field-input profile-field-input-compact"
            />
          </div>

          <div className="profile-field-card profile-field-compact">
            <label className="profile-field-label">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              نام کاربری
            </label>
            <input
              type="text"
              value={currentUser.username}
              readOnly
              dir="ltr"
              className="profile-field-input profile-field-input-compact profile-field-readonly"
            />
          </div>

          {showPhoneField && (
            <div className="profile-field-card profile-field-compact">
              <label className="profile-field-label">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                شماره تماس
                <span className="profile-field-required" title="الزامی">*</span>
              </label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="مثلاً: ۰۹۱۲۳۴۵۶۷۸۹"
                dir="ltr"
                className="profile-field-input profile-field-input-compact"
              />
            </div>
          )}
        </div>

        {/* Footer actions — save + settings */}
        <div className="profile-sheet-footer">
          <button
            onClick={onOpenSettings}
            className="profile-sheet-secondary-btn"
            title="تنظیمات سیستم (سرور، کاربران، رمز عبور)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            تنظیمات
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="profile-sheet-save-btn"
          >
            {savingProfile ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                ذخیره...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                ذخیره
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SETTINGS MODAL — system tabs only (server / users / password).
// Profile moved to its own standalone page view (ProfileView).
// ============================================
function SettingsModal({
  currentUser,
  onClose,
  showToast,
  onLogout,
}: {
  currentUser: User;
  onClose: () => void;
  showToast: (msg: string) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<'server' | 'users' | 'password'>(
    currentUser.role === 'admin' ? 'server' : 'password'
  );

  // Tabs are filtered by role:
  //  - password: every logged-in user
  //  - server: admin only
  //  - users: admin + editor (read-only for editor)
  const allTabs: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'server',   label: 'سرور',     icon: '🖥' },
    { key: 'users',    label: 'کاربران',  icon: '👥' },
    { key: 'password', label: 'رمز عبور', icon: '🔑' },
  ];
  const tabs = allTabs.filter((t) => {
    if (t.key === 'password') return true;
    if (t.key === 'server') return currentUser.role === 'admin';
    if (t.key === 'users') return currentUser.role === 'admin' || currentUser.role === 'editor';
    return false;
  });
  const allowedKeys = tabs.map((t) => t.key).join(',');
  // Make sure the active tab is allowed for this role; otherwise fall back to password.
  useEffect(() => {
    if (!allowedKeys.includes(tab)) setTab('password');
  }, [allowedKeys, tab]);

  // Theme-aware color tokens for the modal
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tokens = {
    modalBg: isDark ? 'rgba(8, 28, 24, 0.97)' : 'rgba(255, 255, 255, 0.96)',
    modalBorder: isDark ? 'rgba(52, 211, 153, 0.25)' : 'rgba(13, 124, 74, 0.15)',
    headerBg: isDark
      ? 'linear-gradient(180deg, #0a1f1a 0%, #0d2924 100%)'
      : 'linear-gradient(180deg, #0a1f14 0%, #0d2218 100%)',
    tabBarBg: isDark ? 'rgba(52, 211, 153, 0.08)' : 'rgba(13, 124, 74, 0.05)',
    tabActiveBg: isDark
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
    textColor: isDark ? '#ffffff' : '#1a2e1a',
    labelColor: isDark ? '#6ee7b7' : '#1a2e1a',
    mutedColor: isDark ? '#5eead4' : '#8a8a7a',
    inputBg: isDark ? 'rgba(52, 211, 153, 0.06)' : 'white',
    inputBorder: isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(13, 124, 74, 0.25)',
    cardBg: isDark
      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.10) 0%, rgba(52, 211, 153, 0.04) 100%)'
      : 'linear-gradient(135deg, rgba(13, 124, 74, 0.10) 0%, rgba(0, 229, 239, 0.06) 100%)',
    cardBorder: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(13, 124, 74, 0.20)',
    saveBtnBg: isDark
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
    avatarAccent: isDark ? '#10b981' : '#0d7c4a',
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: 'min(720px, 96vw)',
          maxHeight: '90vh',
          background: tokens.modalBg,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderRadius: '24px',
          border: '1px solid rgba(13, 124, 74, 0.15)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, #0a1f14 0%, #0d2218 100%)',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
            borderBottom: '1px solid rgba(13, 124, 74, 0.12)',
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: '#1a2e1a' }}>⚙ تنظیمات سیستم</h2>
          <button
            onClick={onClose}
            aria-label="بستن تنظیمات"
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#8a8a7a' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a8a7a'; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-2 flex-shrink-0"
          style={{ background: 'rgba(13, 124, 74, 0.05)', borderBottom: '1px solid rgba(13, 124, 74, 0.12)' }}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={active ? {
                  background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(13, 124, 74, 0.3), inset 0 1px 0 rgba(13, 124, 74, 0.4)',
                } : {
                  color: '#5a6b4a',
                  border: '1px solid transparent',
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 settings-body" style={{ maxHeight: 'calc(90vh - 130px)' }}>
          {tab === 'server' && <SettingsServerTab showToast={showToast} />}
          {tab === 'users' && <SettingsUsersTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'password' && <SettingsPasswordTab currentUser={currentUser} showToast={showToast} onLogout={onLogout} />}
        </div>
      </div>
    </div>
  );
}

// --- Tab 1: Server URL ---
function SettingsServerTab({ showToast }: { showToast: (msg: string) => void }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setUrl(getApiBase());
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/api/health`, { method: 'GET' });
      const data = await res.json();
      if (res.ok && data?.status === 'ok') {
        setTestResult({ ok: true, msg: 'اتصال برقرار شد ✓' });
      } else {
        setTestResult({ ok: false, msg: `پاسخ نامعتبر: ${JSON.stringify(data).slice(0, 100)}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: `خطا در اتصال: ${e?.message || 'نامشخص'}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setApiBase(url);
    showToast('آدرس سرور ذخیره شد. برای اعمال کامل، صفحه را بارگذاری مجدد کنید.');
    setTestResult({ ok: true, msg: 'ذخیره شد ✓ — آدرس جدید اعمال شد.' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#1a2e1a' }}>🖥 آدرس سرور API</h3>
        <p className="text-sm mb-3" style={{ color: '#8a8a7a' }}>
          آدرس سرویس API که این برنامه به آن متصل می‌شود. پیش‌فرض: <code dir="ltr" style={{ background: 'rgba(13, 124, 74,0.1)', padding: '2px 6px', borderRadius: '6px', color: '#0d7c4a' }}>http://localhost:3002</code>
        </p>
        <input
          type="text"
          dir="ltr"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
          placeholder="http://localhost:3002"
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(13, 124, 74, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#1a2e1a',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            textAlign: 'left',
            direction: 'ltr',
          }}
        />
      </div>

      {testResult && (
        <div
          className="p-3 rounded-xl text-sm font-medium"
          style={
            testResult.ok
              ? { background: 'rgba(13, 124, 74, 0.12)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }
              : { background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }
          }
        >
          {testResult.ok ? '✓' : '⚠'} {testResult.msg}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !url}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: testing ? 'rgba(107, 143, 122, 0.5)' : 'rgba(13, 124, 74, 0.15)',
            color: testing ? '#8a8a7a' : '#0d7c4a',
            border: '1px solid rgba(13, 124, 74, 0.3)',
            opacity: testing || !url ? 0.6 : 1,
            cursor: testing || !url ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? '⏳ در حال تست...' : '🔍 تست اتصال'}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1"
          style={{
            background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(13, 124, 74, 0.3)',
          }}
        >
          ✓ ذخیره آدرس
        </button>
      </div>

      <div
        className="p-3 rounded-xl text-xs"
        style={{ background: 'rgba(13, 124, 74, 0.05)', border: '1px solid rgba(13, 124, 74, 0.15)', color: '#5a6b4a', lineHeight: 1.7 }}
      >
        <strong>راهنما:</strong> آدرس وارد شده باید ریشهٔ سرویس API باشد (بدون مسیرهای <code dir="ltr">/api/...</code>).
        اگر از گیتوی Caddy استفاده می‌کنید، می‌توانید آدرس نسبی وارد کنید. پس از ذخیره، توکن فعلی شما معتبر می‌ماند.
      </div>
    </div>
  );
}

// --- Tab 2: Users management ---
// Formats a unix-seconds timestamp into a Persian relative + absolute label.
// e.g. { relative: 'همین حالا', absolute: '۱۴۰۳/۰۸/۰۹ - ۱۴:۳۲' }
function formatLastSeen(sec?: number): { relative: string; absolute: string } {
  if (!sec || sec <= 0) {
    return { relative: 'هنوز وارد نشده', absolute: '—' };
  }
  const now = Math.floor(Date.now() / 1000);
  const diff = now - sec;
  let relative: string;
  if (diff < 60) relative = 'همین حالا';
  else if (diff < 3600) relative = `${Math.floor(diff / 60).toLocaleString('fa-IR')} دقیقه پیش`;
  else if (diff < 86400) relative = `${Math.floor(diff / 3600).toLocaleString('fa-IR')} ساعت پیش`;
  else if (diff < 2592000) relative = `${Math.floor(diff / 86400).toLocaleString('fa-IR')} روز پیش`;
  else relative = `${Math.floor(diff / 2592000).toLocaleString('fa-IR')} ماه پیش`;
  try {
    const d = new Date(sec * 1000);
    const abs = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
    return { relative, absolute: abs };
  } catch {
    return { relative, absolute: String(sec) };
  }
}

// Admins can create / delete / change roles. Editors get a read-only view so
// they can see who is online and the last visit time of every user.
function SettingsUsersTab({ currentUser, showToast }: { currentUser: User; showToast: (msg: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', name: '' });
  const [creating, setCreating] = useState(false);

  const canManage = currentUser.role === 'admin';

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (e: any) {
      if (!silent) setError(e?.message || 'خطا در بارگذاری کاربران');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh every 20s so online status / last-seen stays fresh while the
    // tab is open.
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, []);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      showToast('نام کاربری و رمز را وارد کنید');
      return;
    }
    setCreating(true);
    try {
      await api.createUser({
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role,
        name: newUser.name,
      });
      showToast(`کاربر «${newUser.username}» ساخته شد`);
      setNewUser({ username: '', password: '', role: 'viewer', name: '' });
      await load();
    } catch (e: any) {
      showToast(e?.message || 'خطا در ایجاد کاربر');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser.id) {
      showToast('نمی‌توانید حساب خودتان را حذف کنید');
      return;
    }
    if (!confirm(`کاربر «${u.username}» حذف شود؟`)) return;
    try {
      await api.deleteUser(u.id);
      showToast('کاربر حذف شد');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'خطا در حذف کاربر');
    }
  };

  const handleChangeRole = async (u: User, newRole: string) => {
    if (newRole === u.role) return;
    try {
      await api.updateUser(u.id, { role: newRole });
      showToast(`نقش «${u.username}» به ${newRole} تغییر کرد`);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'خطا در تغییر نقش');
    }
  };

  const onlineCount = users.filter(u => u.online).length;

  const roleLabel: Record<string, string> = { admin: 'مدیر', editor: 'ویراستار', viewer: 'بیننده' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#1a2e1a' }}>👥 {canManage ? 'مدیریت کاربران' : 'فهرست کاربران'}</h3>
        <p className="text-sm" style={{ color: '#8a8a7a' }}>
          {canManage
            ? 'افزودن، حذف یا تغییر نقش کاربران سیستم. نقش‌ها: مدیر (دسترسی کامل)، ویراستار (افزودن/ویرایش برنامه‌ها)، بیننده (فقط مشاهده).'
            : 'view-only — مشاهدهٔ کاربران، وضعیت آنلاین و آخرین مراجعه.'}
        </p>
        {/* Online summary */}
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
            {onlineCount.toLocaleString('fa-IR')} آنلاین
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(107, 114, 128, 0.12)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.25)' }}>
            مجموع: {users.length.toLocaleString('fa-IR')}
          </span>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-all ml-auto"
            style={{ background: 'rgba(13, 124, 74, 0.10)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.25)' }}
            title="بارگذاری مجدد"
          >
            ↻ به‌روزرسانی
          </button>
        </div>
      </div>

      {/* Add new user form (admin only) */}
      {canManage && (
      <div
        className="p-4 rounded-xl"
        style={{ background: 'rgba(13, 124, 74, 0.05)', border: '1px solid rgba(13, 124, 74, 0.15)' }}
      >
        <h4 className="font-bold text-sm mb-3" style={{ color: '#1a2e1a' }}>＋ افزودن کاربر جدید</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            dir="ltr"
            placeholder="نام کاربری"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{
              background: 'white',
              border: '1px solid rgba(13, 124, 74, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#1a2e1a',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <input
            type="text"
            placeholder="نام نمایشی (اختیاری)"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            style={{
              background: 'white',
              border: '1px solid rgba(13, 124, 74, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#1a2e1a',
              outline: 'none',
            }}
          />
          <input
            type="password"
            dir="ltr"
            placeholder="رمز عبور (حداقل ۸ کاراکتر)"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            style={{
              background: 'white',
              border: '1px solid rgba(13, 124, 74, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#1a2e1a',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{
              background: 'white',
              border: '1px solid rgba(13, 124, 74, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#1a2e1a',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            <option value="viewer">بیننده</option>
            <option value="editor">ویراستار</option>
            <option value="admin">مدیر</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: creating ? 'rgba(107, 143, 122, 0.5)' : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(13, 124, 74, 0.3)',
            opacity: creating ? 0.6 : 1,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? '⏳ در حال ایجاد...' : '＋ ایجاد کاربر'}
        </button>
      </div>
      )}

      {/* Users list */}
      <div>
        <h4 className="font-bold text-sm mb-2" style={{ color: '#1a2e1a' }}>
          کاربران فعلی ({users.length.toLocaleString('fa-IR')})
        </h4>
        {loading && (
          <div className="p-4 text-center text-sm" style={{ color: '#8a8a7a' }}>در حال بارگذاری...</div>
        )}
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && (
          <div className="space-y-2">
            {users.map((u) => {
              const isMe = u.id === currentUser.id;
              const online = !!u.online;
              // Format the last-visit time as a Persian relative + absolute string.
              const lastSeenText = formatLastSeen(u.lastSeen);
              return (
                <div
                  key={u.id}
                  className="p-3 rounded-xl flex items-center gap-3 flex-wrap"
                  style={{ background: 'white', border: `1px solid ${online ? 'rgba(34, 197, 94, 0.35)' : 'rgba(13, 124, 74, 0.15)'}` }}
                >
                  {/* Avatar with online dot */}
                  <div className="relative flex-shrink-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full object-cover" style={{ border: '1px solid rgba(13, 124, 74, 0.2)' }} />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          background: u.role === 'admin' ? 'rgba(220, 38, 38, 0.15)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(13, 124, 74, 0.15)',
                          color: u.role === 'admin' ? '#dc2626' : u.role === 'editor' ? '#d97706' : '#0d7c4a',
                          border: `1px solid ${u.role === 'admin' ? 'rgba(220, 38, 38, 0.35)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(13, 124, 74, 0.35)'}`,
                        }}
                      >
                        {(u.name || u.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      title={online ? 'آنلاین' : 'آفلاین'}
                      style={{
                        position: 'absolute',
                        bottom: -1,
                        insetInlineStart: -1,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: online ? '#22c55e' : '#9ca3af',
                        border: '2px solid white',
                        boxShadow: online ? '0 0 6px rgba(34, 197, 94, 0.7)' : 'none',
                      }}
                    />
                  </div>
                  {/* Name + meta */}
                  <div className="flex-1 min-w-0" style={{ minWidth: 140 }}>
                    <div className="font-bold text-sm flex items-center gap-1.5 flex-wrap" style={{ color: '#1a2e1a' }} title={u.username}>
                      <span className="truncate">{u.name || u.username}</span>
                      {isMe && (
                        <span className="text-xs font-normal px-1.5 py-0.5 rounded" style={{ color: '#0d7c4a', background: 'rgba(13, 124, 74, 0.10)' }}>(شما)</span>
                      )}
                    </div>
                    <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: '#8a8a7a' }}>
                      <span dir="ltr">@{u.username}</span>
                      {u.jobTitle && <span>• {u.jobTitle}</span>}
                    </div>
                    {/* Last visit */}
                    <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: online ? '#16a34a' : '#9ca3af' }} title={lastSeenText.absolute}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#22c55e' : '#9ca3af', display: 'inline-block' }} />
                      {lastSeenText.relative}
                    </div>
                  </div>
                  {/* Role control — admin can change; everyone else sees a badge */}
                  {canManage ? (
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u, e.target.value)}
                      disabled={isMe}
                      style={{
                        background: 'rgba(13, 124, 74, 0.05)',
                        border: '1px solid rgba(13, 124, 74, 0.2)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '13px',
                        color: '#1a2e1a',
                        outline: 'none',
                        fontFamily: 'inherit',
                        cursor: isMe ? 'not-allowed' : 'pointer',
                        opacity: isMe ? 0.6 : 1,
                      }}
                      title={isMe ? 'نمی‌توانید نقش خودتان را تغییر دهید' : 'تغییر نقش'}
                    >
                      <option value="viewer">بیننده</option>
                      <option value="editor">ویراستار</option>
                      <option value="admin">مدیر</option>
                    </select>
                  ) : (
                    <span
                      className="text-xs px-2 py-1 rounded-md font-bold flex-shrink-0"
                      style={{
                        background: u.role === 'admin' ? 'rgba(220, 38, 38, 0.12)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(13, 124, 74, 0.12)',
                        color: u.role === 'admin' ? '#dc2626' : u.role === 'editor' ? '#d97706' : '#0d7c4a',
                        border: `1px solid ${u.role === 'admin' ? 'rgba(220, 38, 38, 0.3)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(13, 124, 74, 0.3)'}`,
                      }}
                    >
                      {roleLabel[u.role] || u.role}
                    </span>
                  )}
                  {/* Delete — admin only */}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={isMe}
                      className="p-2 rounded-lg transition-colors flex-shrink-0"
                      style={{
                        color: isMe ? 'rgba(107, 143, 122, 0.4)' : '#dc2626',
                        background: isMe ? 'transparent' : 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.25)',
                        cursor: isMe ? 'not-allowed' : 'pointer',
                        opacity: isMe ? 0.4 : 1,
                      }}
                      title={isMe ? 'نمی‌توانید خودتان را حذف کنید' : `حذف ${u.username}`}
                      aria-label={`حذف کاربر ${u.username}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab 3: Change password ---
function SettingsPasswordTab({
  currentUser,
  showToast,
  onLogout,
}: {
  currentUser: User;
  showToast: (msg: string) => void;
  onLogout: () => void;
}) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      showToast('هر سه فیلد را پر کنید');
      return;
    }
    if (newPw.length < 8) {
      showToast('رمز جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('رمز جدید و تأیید آن یکسان نیستند');
      return;
    }
    if (newPw === oldPw) {
      showToast('رمز جدید باید با رمز فعلی متفاوت باشد');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(oldPw, newPw);
      showToast('رمز با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.');
      // Force re-login since the API invalidated the session.
      setTimeout(() => { onLogout(); }, 1500);
    } catch (e: any) {
      showToast(e?.message || 'خطا در تغییر رمز');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(13, 124, 74, 0.25)',
    borderRadius: '12px',
    padding: '12px 48px 12px 16px',
    color: '#1a2e1a',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'left',
    direction: 'ltr',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#1a2e1a' }}>🔑 تغییر رمز عبور</h3>
        <p className="text-sm" style={{ color: '#8a8a7a' }}>
          رمز عبور خود را تغییر دهید. پس از تغییر، تمام نشست‌های فعال شما باطل شده و باید دوباره وارد شوید.
        </p>
      </div>

      <div
        className="p-3 rounded-xl text-sm flex items-center gap-2"
        style={{ background: 'rgba(13, 124, 74, 0.08)', border: '1px solid rgba(13, 124, 74, 0.2)', color: '#0d7c4a' }}
      >
        <span>👤 حساب فعلی:</span>
        <strong>{currentUser.name || currentUser.username}</strong>
        <span dir="ltr" style={{ color: '#8a8a7a' }}>@{currentUser.username}</span>
      </div>

      {[
        { label: 'رمز فعلی', val: oldPw, set: setOldPw },
        { label: 'رمز جدید', val: newPw, set: setNewPw },
        { label: 'تکرار رمز جدید', val: confirmPw, set: setConfirmPw },
      ].map((f, i) => (
        <div key={i}>
          <label className="block text-sm font-bold mb-2" style={{ color: '#1a2e1a' }}>{f.label}</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              dir="ltr"
              value={f.val}
              onChange={(e) => f.set(e.target.value)}
              placeholder="••••••"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg"
              style={{ color: '#5a6b4a', background: 'transparent' }}
              aria-label={showPw ? 'پنهان کردن رمز' : 'نمایش رمز'}
            >
              {showPw ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}

      {newPw && confirmPw && newPw !== confirmPw && (
        <div
          className="p-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
        >
          ⚠ رمز جدید و تأیید آن یکسان نیستند
        </div>
      )}

      <button
        onClick={handleChange}
        disabled={saving}
        className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: saving ? 'rgba(107, 143, 122, 0.5)' : 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(13, 124, 74, 0.3)',
          opacity: saving ? 0.6 : 1,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '⏳ در حال تغییر...' : '✓ تغییر رمز عبور'}
      </button>
    </div>
  );
}
