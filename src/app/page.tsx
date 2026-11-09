'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { api, setApiBase, getApiBase, getApiUrl, User, authHeaders } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { LangProvider, useLang } from '@/lib/i18n-context';

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
  isFilm?: boolean;
  tags?: string[];
  images?: string[];
  videos?: string[];
  // Explicit user choice; undefined preserves legacy decor classification.
  decorIncluded?: boolean;
  // Source of the DB-stored image BLOB ('wikipedia', 'imdb', or '' if none).
  // Used as a cache-buster for /api/image/<num> so cards re-fetch after update.
  imageSource?: string;
}

// A "section-specific tag" — derives a small badge label from a TalkShow field
// (only when the field has a meaningful value). Each Genre chooses which tags to show.
type TagSpec = { id: string; label: (s: TalkShow) => string | null };

interface Genre {
  id: string;
  key: string;
  nameFa: string;
  name: string;
  color: string;
  description: string;
  aliases?: string[];
  filterFn: (s: TalkShow) => boolean;
  // Section-specific tags shown on cards in this genre's view
  tags?: TagSpec[];
  // Preset tags offered as quick-add buttons in AddEditView when this genre is preset
  presetTags?: string[];
  // Which TalkShow fields the ProgramsView search bar should match against
  searchFields?: (keyof TalkShow)[];
  // True for user-created genres (stored in localStorage)
  isCustom?: boolean;
  isActive?: boolean;
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

// Categories that have NO analyzable decor — excluded from the "Decor" view.
// (advertising, PSA, films/series, back-to-school ads, live streams)
const NO_DECOR_CATEGORIES: string[] = [
  'آگهی‌های تبلیغاتی',     // includes PSA + energy-saving ads
  'مدرسه',              // back-to-school ads/teasers
  'پخش زنده',           // live webcams (no studio decor)
];
// Shows whose category starts with one of these prefixes are also excluded from Decor
const NO_DECOR_PREFIXES: string[] = [
  'خارج از ژانر تاک‌شو:',  // competition/reality/documentary — not analyzable as decor
];

function hasDecor(show: TalkShow): boolean {
  // New/edited records honor the explicit checkbox. Legacy records retain their
  // previous classification until a user makes an explicit choice.
  if (typeof show.decorIncluded === 'boolean') return show.decorIncluded;
  if (show.isFilm) return false;            // films/series have no TV-studio decor
  const cat = show.category || '';
  if (NO_DECOR_CATEGORIES.includes(cat)) return false;
  for (const p of NO_DECOR_PREFIXES) {
    if (cat.startsWith(p)) return false;
  }
  return true;
}

// Convert a #RRGGBB hex color to an `r, g, b` string (for use inside rgba()).
// Falls back to "255,255,255" if the input is malformed.
function hexToRgb(hex: string): string {
  let h = (hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '255,255,255';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Real genres from Excel - 17 categories + technical decor view + 3 extras (PSA, deep observation, ads)
const GENRES: Genre[] = [
  {
    id: 'decor', key: 'decor', nameFa: 'دکور برنامه‌ها', name: 'Decor Analysis',
    color: '#10E98B', description: 'برنامه‌های قابل تحلیل از نظر دکور و صحنه', filterFn: hasDecor,
    tags: DEFAULT_GENRE_TAGS,
    presetTags: ['مدرن', 'مینیمال', 'چوب', 'تکنولوژی', 'گرم', 'لوکس', 'تاریک', 'روشن'],
    searchFields: ['name', 'summary', 'materials', 'colors'],
  },
  {
    id: 'interview', key: 'interview', nameFa: 'تاک‌شوی مصاحبه‌محور', name: 'Interview',
    aliases: ["مصاحبه"],
    color: '#06B6D4', description: '۱۰۲ برنامه', filterFn: s => s.category.includes('مصاحبه'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.viewers],
    presetTags: ['مصاحبه اختصاصی', 'مهمان ویژه', 'تکنولوژی', 'استودیو', 'مدرن', 'گریل'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'comedy', key: 'comedy', nameFa: 'تاک‌شوی طنز و کمدی', name: 'Comedy',
    aliases: ["طنز"],
    color: '#db2777', description: '۸۹ برنامه', filterFn: s => s.category.includes('طنز'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['طنز', 'استندآپ', 'شخصیت‌محور', 'استودیوی رنگارنگ', 'پویا'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'news', key: 'news', nameFa: 'تاک‌شوی سیاسی و خبری', name: 'News/Politics',
    aliases: ["خبری","سیاسی"],
    color: '#dc2626', description: '۶۸ برنامه', filterFn: s => s.category.includes('خبری') || s.category.includes('سیاسی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['خبری', 'تحلیل سیاسی', 'مهمان سیاسی', 'رسمی', 'مدرن'],
    searchFields: ['name', 'summary', 'descriptionFa', 'category'],
  },
  {
    id: 'lifestyle', key: 'lifestyle', nameFa: 'تاک‌شوی تخصصی و سبک زندگی', name: 'Lifestyle',
    aliases: ["تخصصی"],
    color: '#16a34a', description: '۵۴ برنامه', filterFn: s => s.category.includes('تخصصی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['سبک زندگی', 'آشپزی', 'سلامت', 'مد', 'منزل', 'طبیعت'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'cultural', key: 'cultural', nameFa: 'تاک‌شوی فرهنگی، هنری', name: 'Cultural',
    aliases: ["فرهنگی"],
    color: '#b45309', description: '۵۲ برنامه', filterFn: s => s.category.includes('فرهنگی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['فرهنگی', 'هنری', 'سنتی', 'تاریخی', 'موسیقی'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'celebrity', key: 'celebrity', nameFa: 'تاک‌شوی گروهی سلبریتی‌ها', name: 'Celebrity',
    aliases: ["سلبریتی"],
    color: '#7c3aed', description: '۴۲ برنامه', filterFn: s => s.category.includes('سلبریتی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.size],
    presetTags: ['سلبریتی', 'گروهی', 'مهمان‌محور', 'سرگرمی', 'لوکس'],
    searchFields: ['name', 'summary', 'style', 'size'],
  },
  {
    id: 'panel', key: 'panel', nameFa: 'تاک‌شوی پنلی و میزگرد', name: 'Panel',
    aliases: ["پنلی"],
    color: '#2563eb', description: '۲۳ برنامه', filterFn: s => s.category.includes('پنلی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.size],
    presetTags: ['پنل', 'میزگرد', 'چندمهمانه', 'بحث', 'تخصصی'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'morning', key: 'morning', nameFa: 'تاک‌شوی روزانه/صبحگاهی', name: 'Morning Show',
    aliases: ["صبحگاهی"],
    color: '#f59e0b', description: '۲۰ برنامه', filterFn: s => s.category.includes('صبحگاهی'),
    tags: [TAG_LIBRARY.size, TAG_LIBRARY.viewers],
    presetTags: ['صبحگاهی', 'روزانه', 'پویا', 'با تماشاگر', 'موسیقی زنده'],
    searchFields: ['name', 'summary', 'category', 'viewers'],
  },
  {
    id: 'reality', key: 'reality', nameFa: 'ریلیتی شو / مسابقه', name: 'Reality/Competition',
    aliases: ["مسابقه","رئالیتی"],
    color: '#ea580c', description: '۱۹ برنامه', filterFn: s => s.category.includes('مسابقه') || s.category.includes('رئالیتی'),
    tags: [TAG_LIBRARY.effects, TAG_LIBRARY.style],
    presetTags: ['مسابقه', 'رئالیتی', 'داورمحور', 'پیروز', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'night', key: 'night', nameFa: 'تاک‌شوی شبانه', name: 'Late Night',
    aliases: ["شبانه"],
    color: '#6366f1', description: '۱۵ برنامه', filterFn: s => s.category.includes('شبانه'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['شبانه', 'تاریک', 'کمدی', 'مصاحبه کوتاه', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'lighting'],
  },
  {
    id: 'entertainment', key: 'entertainment', nameFa: 'صنعت سرگرمی / پشت‌صحنه', name: 'Entertainment',
    aliases: ["سرگرمی"],
    color: '#c026d3', description: '۱۳ برنامه', filterFn: s => s.category.includes('سرگرمی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['سرگرمی', 'پشت‌صحنه', 'گوینده', 'مدرن', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'location', key: 'location', nameFa: 'موقعیت‌محور / خارج از استودیو', name: 'On-Location',
    aliases: ["موقعیت"],
    color: '#F59E0B', description: '۱۲ برنامه', filterFn: s => s.category.includes('موقعیت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['موقعیت‌محور', 'بیرون از استودیو', 'میدانی', 'طبیعت', 'شهری'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'digital', key: 'digital', nameFa: 'تاک‌شوی دیجیتال / اینترنتی', name: 'Digital',
    aliases: ["دیجیتال"],
    color: '#10b981', description: '۱۰ برنامه', filterFn: s => s.category.includes('دیجیتال'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['دیجیتال', 'اینترنتی', 'استریم', 'تعاملی', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'relationships', key: 'relationships', nameFa: 'تاک‌شوی روابط و تعارض', name: 'Relationships',
    aliases: ["روابط"],
    color: '#be185d', description: '۸ برنامه', filterFn: s => s.category.includes('روابط'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['روابط', 'تعارض', 'خانوادگی', 'گفتگومحور', 'صمیمی'],
    searchFields: ['name', 'summary', 'style', 'layout'],
  },
  {
    id: 'radio', key: 'radio', nameFa: 'تاک‌شوی رادیویی / صوتی', name: 'Radio/Audio',
    aliases: ["رادیویی"],
    color: '#14B8A6', description: '۶ برنامه', filterFn: s => s.category.includes('رادیویی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.effects],
    presetTags: ['رادیویی', 'صوتی', 'گفتگو', 'مدرن', 'استودیویی'],
    searchFields: ['name', 'summary', 'layout', 'effects'],
  },
  {
    id: 'human', key: 'human', nameFa: 'تاک‌شوی انسانی و داستان‌محور', name: 'Human Stories',
    aliases: ["انسانی"],
    color: '#0EA5E9', description: '۵ برنامه', filterFn: s => s.category.includes('انسانی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['انسانی', 'داستان‌محور', 'مصاحبه عمیق', 'صمیمی', 'مستندگونه'],
    searchFields: ['name', 'summary', 'style', 'materials'],
  },
  {
    id: 'deepobs', key: 'deepobs', nameFa: 'پایش تحلیلی', name: 'Deep Observation',
    aliases: ["پایش تحلیلی"],
    color: '#7c3aed', description: 'تحلیل و رصد عمیق برنامه‌ها',
    filterFn: s => s.category.includes('پایش تحلیلی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting, TAG_LIBRARY.materials],
    presetTags: ['تحلیلی', 'رصد عمیق', 'بررسی تخصصی', 'مقایسه‌ای', 'تفصیلی'],
    searchFields: ['name', 'summary', 'descriptionFa', 'materials'],
  },
  {
    id: 'funeral', key: 'funeral', nameFa: 'سوگواری و خاکسپاری', name: 'Funeral Coverage',
    aliases: ["خاکسپاری","سوگواری"],
    color: '#64748B', description: 'پوشش خبری مراسم خاکسپاری و سوگواری شخصیت‌ها',
    filterFn: s => s.category.includes('خاکسپاری') || s.category.includes('سوگواری'),
    tags: [],
    presetTags: ['رسمی', 'مذهبی', 'دولتی', 'مردمی', 'سنتی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'war', key: 'war', nameFa: 'برنامه‌های جنگ و بحران', name: 'War & Conflict',
    aliases: ["جنگ","بحران"],
    color: '#EF4444', description: 'برنامه‌های تلویزیونی با موضوع جنگ و منازعات',
    filterFn: s => s.category.includes('جنگ') || s.category.includes('بحران'),
    tags: [],
    presetTags: ['مستند جنگ', 'تحلیل نظامی', 'خبری', 'بیانیه'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'debate', key: 'debate', nameFa: 'مناظرات انتخاباتی', name: 'Electoral Debates',
    aliases: ["مناظره","انتخابات"],
    color: '#1e40af', description: 'مناظرات و بحث‌های انتخاباتی',
    filterFn: s => s.category.includes('مناظره') || s.category.includes('انتخابات'),
    tags: [],
    presetTags: ['ریاست جمهوری', 'پارلمانی', 'محلی', 'حزبی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'ads', key: 'ads', nameFa: 'آگهی‌های تبلیغاتی', name: 'Advertisements',
    aliases: ["آگهی"],
    color: '#ea580c', description: 'تبلیغات، آگهی‌ها و پیام‌های خدمت عمومی (PSA)',
    filterFn: s => s.category.includes('آگهی'),
    tags: [],
    presetTags: ['تبلیغاتی', 'تجاری', 'PSA', 'صرفه‌جویی انرژی', 'آگاهی‌بخش', 'کوتاه'],
    searchFields: ['name', 'summary', 'category', 'colors', 'tags'],
  },
  // ----- 11 new genre categories (kasht, krismas, polisi, ramazan, etc.) -----
  {
    id: 'kasht', key: 'kasht', nameFa: 'درختکاری', name: 'Tree Planting',
    aliases: ["کاشت درخت"],
    color: '#16a34a', description: '۲۱ برنامه — باغبانی، کاشت درخت و سبک زندگی سبز',
    filterFn: s => s.category === 'کاشت درخت',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['باغبانی', 'درخت', 'سبز', 'محیط زیست', 'سبک زندگی'],
    searchFields: ['name', 'summary', 'materials', 'elements'],
  },
  {
    id: 'krismas', key: 'krismas', nameFa: 'کریسمس', name: 'Christmas',
    aliases: ["کریسمس"],
    color: '#dc2626', description: '۱۵ برنامه — ویژه‌برنامه‌های کریسمس و سال نو',
    filterFn: s => s.category === 'کریسمس',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['کریسمس', 'سال نو', 'موسیقی', 'رژه', 'ویژه'],
    searchFields: ['name', 'summary', 'style', 'lighting'],
  },
  {
    id: 'polisi', key: 'polisi', nameFa: 'پلیسی', name: 'Police',
    aliases: ["پلیسی"],
    color: '#2563EB', description: '۱۹ برنامه — مستند و رئالیتی‌شوی پلیسی',
    filterFn: s => s.category === 'پلیسی',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['پلیسی', 'تحقیقی', 'رئالیتی', 'مستند', 'جنایی'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'ramazan', key: 'ramazan', nameFa: 'برنامه‌های ماه مبارک رمضان', name: 'Ramadan Programs',
    aliases: ["رمضان"],
    color: '#F97316', description: '۶۳ برنامه — برنامه‌های ماه رمضان',
    filterFn: s => s.category === 'رمضان',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['رمضان', 'زیارتی', 'مذهبی', 'سحری', 'آشپزی', 'خانواده', 'اندونزی', 'مالزی', 'قطر'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'safar', key: 'safar', nameFa: 'سفرنامه و ماجراجویی', name: 'Travel & Adventure',
    aliases: ["سفر جاده‌ای"],
    color: '#c2410c', description: '۹۳ برنامه — ریلیتی‌شوی سفر و ماجراجویی',
    filterFn: s => s.category === 'سفر جاده‌ای',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['سفر', 'جاده', 'ریلیتی', 'ماجراجویی', 'غذا', 'طبیعت'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'madrese', key: 'madrese', nameFa: 'مدرسه و دانش‌آموزی', name: 'School & Students',
    aliases: ["مدرسه"],
    color: '#0284c7', description: '۲۷ برنامه — آگهی و تیزر بازگشت به مدرسه',
    filterFn: s => s.category === 'مدرسه',
    tags: [],
    presetTags: ['مدرسه', 'آگهی', 'تیزر', 'PSA', 'فناوری'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'naghd', key: 'naghd', nameFa: 'نقد فیلم', name: 'Film Review',
    aliases: ["نقد فیلم"],
    color: '#7c3aed', description: '۱۲ برنامه — تاک‌شو و مستند نقد فیلم',
    filterFn: s => s.category === 'نقد فیلم',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['نقد', 'فیلم', 'سینما', 'تاک‌شو', 'مستند'],
    searchFields: ['name', 'summary', 'style', 'layout'],
  },
  {
    id: 'ghanun', key: 'ghanun', nameFa: 'قانون اساسی', name: 'Constitution',
    aliases: ["قانون اساسی"],
    color: '#3B82F6', description: '۹ برنامه — مستند قانون اساسی کشورها',
    filterFn: s => s.category === 'قانون اساسی',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['قانون', 'اساسی', 'مستند', 'تاریخی', 'سیاسی'],
    searchFields: ['name', 'summary', 'style', 'layout'],
  },
  {
    id: 'pakhsh', key: 'pakhsh', nameFa: 'پخش زنده', name: 'Live Stream',
    aliases: ["پخش زنده"],
    color: '#0d9488', description: '۲۵ برنامه — پخش زنده دوربین‌های وب',
    filterFn: s => s.category === 'پخش زنده',
    tags: [],
    presetTags: ['زنده', 'دوربین', 'قطار', 'خیابان', 'حیات وحش', 'فضا', 'فرودگاه'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'jasoosi', key: 'jasoosi', nameFa: 'ستون پنجم', name: 'The Fifth Column',
    aliases: ["جاسوسی"],
    color: '#4F46E5', description: '۱۵۴ برنامه — مستند جاسوسی و عملیات اطلاعاتی',
    filterFn: s => s.category === 'جاسوسی',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['جاسوسی', 'مستند', 'اطلاعاتی', 'جنگ سرد', 'عملیات'],
    searchFields: ['name', 'summary', 'tags'],
  },
  // ----- 5 more new categories (zandan, ehda, tarikhi, radio, rusta) -----
  {
    id: 'zandan', key: 'zandan', nameFa: 'زندان و اصلاح', name: 'Prison & Reform',
    aliases: ["زندان"],
    color: '#6366F1', description: '۱۸ برنامه — مستند و واقع‌نمای زندان و اصلاح',
    filterFn: s => s.category === 'زندان',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['زندان', 'مستند', 'سریال', 'اعدام', 'اصلاح'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'ehda', key: 'ehda', nameFa: 'اهدا و پیوند اعضا', name: 'Organ Donation & Transplant',
    aliases: ["اهدای عضو"],
    color: '#dc2626', description: '۶۴ برنامه — سریال و فیلم پیوند و اهدای اعضا',
    filterFn: s => s.category === 'اهدای عضو',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['اهدای عضو', 'پزشکی', 'پیوند', 'بیمارستان', 'سریال', 'فیلم'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'tarikhi', key: 'tarikhi', nameFa: 'تاریخ و تمدن', name: 'History & Civilisation',
    aliases: ["تاریخی"],
    color: '#F97316', description: '۱۵ برنامه — مستند و بازسازی تاریخی',
    filterFn: s => s.category === 'تاریخی',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['تاریخی', 'مستند', 'واقع‌نما', 'بازسازی', 'تمدن'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'radio-podcast', key: 'radio-podcast', nameFa: 'رادیو و پادکست', name: 'Radio & Podcast',
    aliases: ["رادیو تصویری"],
    color: '#7c3aed', description: '۵۰ برنامه — رادیو تصویری، پادکست و رسانه شنیداری',
    filterFn: s => s.category === 'رادیو تصویری',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['رادیو', 'پادکست', 'تاک‌شو', 'موسیقی', 'خبری', 'طنز'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'rusta', key: 'rusta', nameFa: 'روستا و کشاورزی', name: 'Rural & Agriculture',
    aliases: ["روستا"],
    color: '#65a30d', description: '۴۴ برنامه — مستند و رئالیتی روستایی و کشاورزی',
    filterFn: s => s.category === 'روستا',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['روستا', 'کشاورزی', 'مزرعه', 'طبیعت', 'دامداری', 'واقع‌نما'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'ketab', key: 'ketab', nameFa: 'کتاب و کتاب‌خوانی', name: 'Books & Literature',
    aliases: ["کتاب و کتاب‌خوانی"],
    color: '#F59E0B', description: '۳۰ برنامه — تاک‌شو، مستند و مسابقه ادبی',
    filterFn: s => s.category === 'کتاب و کتاب‌خوانی',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['کتاب', 'ادبی', 'مصاحبه', 'باشگاه کتاب', 'مستند', 'مسابقه', 'کودک'],
    searchFields: ['name', 'summary', 'tags'],
  },
  {
    id: 'sarmaye', key: 'sarmaye', nameFa: 'سرمایه‌گذاری در تولید', name: 'Investment in Production',
    aliases: ["سرمایه‌گذاری در تولید"],
    color: '#0e7490', description: 'برنامه‌های مرتبط با سرمایه‌گذاری و تولید محتوا',
    filterFn: s => s.category === 'سرمایه‌گذاری در تولید',
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['سرمایه‌گذاری', 'تولید', 'اقتصاد', 'صنعت', 'کارآفرینی'],
    searchFields: ['name', 'summary', 'tags'],
  },
];

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
  const text = `${show.descriptionFa || ''} ${show.summary || ''} ${show.country || ''} ${(show.tags || []).join(' ')} ${show.category || ''}`;
  const found: string[] = [];
  for (const c of ISLAMIC_COUNTRIES) {
    // Word-boundary-style match: country must not be part of a longer Persian word.
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
  const showTags = (show.tags || []);
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
    // Match by tags (sub-genres)
    const sTags = (s.tags || []);
    if (showTags.length > 0 && sTags.length > 0) {
      const sharedTags = showTags.filter(t => sTags.includes(t)).length;
      score += sharedTags * 2;
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
  aliases?: string[];
  isActive?: boolean;
};

/**
 * Legacy custom genres were auto-described as "ژانر سفارشی: <name>". That
 * placeholder must never appear on a genre card, so any description that
 * matches the old auto-generated pattern is dropped (empty string → the card
 * simply omits the description line). User-written descriptions pass through.
 */
function stripLegacyGenreDescription(description: string): string {
  const d = (description || '').trim();
  if (!d) return '';
  // Matches "ژانر سفارشی", "ژانر سفارشی:", "ژانر سفارشی :"
  // and "ژانر سفارشی: <name>" / "ژانر سفارشی : <name>" (legacy auto-filled placeholders).
  // The regex allows optional whitespace before the colon so BOTH variants are stripped.
  if (d === 'ژانر سفارشی' || /^ژانر\s*سفارشی\s*:/.test(d)) return '';
  return d;
}

function hydrateCustomGenres(items: StoredGenre[]): Genre[] {
  return items
    .filter((g: any) => g && typeof g === 'object' && typeof g.id === 'string' && typeof g.nameFa === 'string' && typeof g.color === 'string')
    .map((g: StoredGenre) => ({
      id: g.id, key: g.id, nameFa: g.nameFa, name: g.name || g.nameFa, color: g.color,
      description: stripLegacyGenreDescription(g.description || ''),
      aliases: Array.isArray(g.aliases) ? g.aliases : [],
      filterFn: (show: TalkShow) => [g.nameFa, g.name, ...(g.aliases || [])].some(name => !!name && show.category.includes(name)),
      isCustom: true, isActive: g.isActive !== false, tags: DEFAULT_GENRE_TAGS, presetTags: [],
      searchFields: ['name', 'summary', 'category', 'descriptionFa'] as (keyof TalkShow)[],
    }));
}

// Read only for one-time migration of legacy browser-local genres. Normal reads/writes use the API.
function loadCustomGenres(): Genre[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_GENRES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? hydrateCustomGenres(arr) : [];
  } catch {
    return [];
  }
}

// Render the section-specific tags (from genre.tags or DEFAULT_GENRE_TAGS) as small badges.
function renderGenreTags(show: TalkShow, genre?: Genre | null): { id: string; label: string }[] {
  // Films/series/documentaries should NOT get decor tags — they're not TV studio shows.
  // Instead, tag them by content type: فیلم/سریال/مستند.
  if (show.isFilm) {
    const filmTags: { id: string; label: string }[] = [];
    // Detect content type from user tags or category
    const userTags = show.tags || [];
    const cat = show.category || '';
    if (userTags.some(t => t.includes('سریال') || t.includes('series')) || cat.includes('اهدای')) {
      filmTags.push({ id: 'film-type', label: '🎬 سریال' });
    } else if (userTags.some(t => t.includes('مستند') || t.includes('doc')) || cat.includes('مستند')) {
      filmTags.push({ id: 'film-type', label: '🎬 مستند' });
    } else {
      filmTags.push({ id: 'film-type', label: '🎬 فیلم' });
    }
    // Keep user-defined tags (but not decor-style tags)
    for (const t of userTags.slice(0, 3)) {
      if (!['مدرن', 'کلاسیک', 'ترکیبی', 'مینیمال'].includes(t)) {
        filmTags.push({ id: 'user-' + t, label: t });
      }
    }
    return filmTags;
  }
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

// Get show's real image if available, otherwise generate thumbnail from decor properties.
//
// Image source priority (first match wins):
//   1. First EXTERNAL URL in show.images[] (https://...) — these are real
//      images the user fetched from Wikipedia/IMDb via the auto-fetch feature.
//   2. /api/image/<num> BLOB endpoint — images stored in the DB by an admin
//      via the fetch-image endpoint.
//   3. Gradient placeholder (no image).
//
// Note: show.images[] may also contain LOCAL file paths (e.g. /program-images/
// p4_img1.png) from the original seed data. The user has stated these are
// "incorrect movie posters, not actual decor photos", so we deliberately
// SKIP any image that doesn't start with http(s)://.
//
// When the user is NOT logged in, we show only the gradient placeholder.
function getShowThumbnail(show: TalkShow): { gradient: string; pattern: string; accent: string; image: string | null } {
  const thumb = generateThumbnailColors(show);
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('bankresaneh_token');

  // 1. Prefer the first EXTERNAL image URL the user fetched (Wikipedia/IMDb).
  if (show.images && show.images.length > 0) {
    const externalUrl = show.images.find((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
    if (externalUrl) {
      return { ...thumb, image: externalUrl };
    }
    // If only local paths exist (seed data), fall through to the BLOB endpoint.
  }

  // 2. Try the DB-backed image BLOB (may return 404 → onError hides the <img>).
  if (loggedIn) {
    // Use imageSource as a cache-buster so that when an image is freshly
    // fetched, the URL changes and the browser re-requests it instead of
    // serving a stale 404 from its internal cache.
    const cacheBuster = show.imageSource ? encodeURIComponent(show.imageSource) : '0';
    return { ...thumb, image: getApiUrl('api/image/' + show.num) + '?v=' + cacheBuster };
  }

  // 3. Not logged in — no image.
  return { ...thumb, image: null };
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
  return { name: 'ویدیو', icon: '🎬', color: 'rgba(244, 255, 255, 0.7)' };
}

// ============================================
// SHOW IMAGE GALLERY — displays all images for a show in modal
// ============================================
function ShowImageGallery({ images, showName }: { images: string[]; showName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>
        🖼 تصاویر برنامه
        <span className="text-xs font-normal mr-2" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
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
  const baseNums = new Set(base.map(show => show.num));
  const out: TalkShow[] = [];
  for (const s of base) {
    if (deleted.has(s.num)) continue;
    out.push(o.edited[s.num] || s);
  }
  // A legacy edit whose original record is absent from the server must remain
  // visible in the local recovery view until an administrator resolves it.
  const orphanedEdits = Object.values(o.edited).filter(show => !baseNums.has(show.num) && !deleted.has(show.num));
  return [...o.added.filter(show => !deleted.has(show.num)), ...out, ...orphanedEdits];
}

export default function Home() {
  // LangProvider wraps the whole app so every component can call useLang()
  // to get the current language + t() translation function.
  return (
    <LangProvider>
      <HomeInner />
    </LangProvider>
  );
}

function HomeInner() {
  const { theme, toggleTheme } = useTheme();
  // Language is now managed globally via LangContext (see i18n-context.tsx).
  // The toggle button calls toggleLang() which switches fa ↔ en and updates
  // <html lang/dir> + persists to localStorage.
  const { lang, toggleLang, t } = useLang();
  const [currentView, setCurrentView] = useState<'dashboard' | 'programs' | 'genre' | 'reports' | 'add'>('dashboard');
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [talkShows, setTalkShows] = useState<TalkShow[]>([]);
  // Base archive data loaded from the authenticated shared API.
  const [baseShows, setBaseShows] = useState<TalkShow[]>([]);
  // Recovery-only local overrides retained solely for safe migration of legacy browser edits.
  const [overrides, setOverrides] = useState<Overrides>({ added: [], edited: {}, deleted: [] });
  const [uploadedShows, setUploadedShows] = useState<number[]>([]);
  const [selectedShow, setSelectedShow] = useState<TalkShow | null>(null);

  // Track "view_show" analytics whenever a show's details modal opens
  useEffect(() => {
    if (selectedShow) {
      api.trackAnalytics('view_show', 'show', String(selectedShow.num), `Viewed "${selectedShow.name}"`);
    }
  }, [selectedShow]);

  const [editingShow, setEditingShow] = useState<TalkShow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publishShows, setPublishShows] = useState<TalkShow[] | null>(null);
  const [showBotConfig, setShowBotConfig] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    shows: TalkShow[];
    format: 'pdf' | 'excel';
    title?: string;
    subtitle?: string;
    organization?: string;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Navigation history so every view can navigate back to the previous one
  const [viewStack, setViewStack] = useState<Array<{ view: typeof currentView; genre: Genre | null }>>([]);
  // Real authenticated user (null = logged out → show login screen)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Settings modal (admin only)
  const [showSettings, setShowSettings] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  // Server-backed genre records — merged with built-in genre definitions.
  const [customGenres, setCustomGenres] = useState<Genre[]>([]);
  // When the user clicks "+ افزودن برنامه" from inside a genre view, that genre's
  // Persian name is preset here so AddEditView's category field starts with it.
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined);
  // When AddEditView opens with a preset genre, its preset tags are offered as quick-adds.
  const [presetGenre, setPresetGenre] = useState<Genre | null>(null);

  // One shared catalog drives both built-in and user-created genres.
  // Server records override built-in presentation and can deactivate any genre.
  const genres: Genre[] = useMemo(() => {
    const records = new Map(customGenres.map(g => [g.id, g]));
    const builtIn = GENRES.flatMap(base => {
      const record = records.get(base.id);
      if (record?.isActive === false) return [];
      if (!record) return [base];
      return [{
        ...base,
        nameFa: record.nameFa,
        name: record.name || record.nameFa,
        color: record.color,
        description: record.description,
        aliases: record.aliases || [],
        isCustom: false,
        filterFn: base.id === 'decor' ? base.filterFn : (show: TalkShow) =>
          [record.nameFa, record.name, ...(record.aliases || [])]
            .some(name => !!name && show.category.includes(name)),
      }];
    });
    const custom = customGenres.filter(g => !GENRES.some(base => base.id === g.id) && g.isActive !== false);
    return [...builtIn, ...custom];
  }, [customGenres]);

  // Role helpers — viewer is read-only (no add/edit/delete), admin can manage users + settings.
  const role = currentUser?.role || null;
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  // Shared genre catalog: every authenticated role can read; only admins can mutate.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      const saved = loadOverrides();
      const remaining: Overrides = { added: [], edited: {}, deleted: [] };
      const hasLegacyChanges = saved.added.length > 0 || Object.keys(saved.edited).length > 0 || saved.deleted.length > 0;

      // One-time, loss-aware migration of old browser-only edits into the
      // shared database. Each failed item remains in the local recovery layer.
      if (hasLegacyChanges && (currentUser.role === 'admin' || currentUser.role === 'editor')) {
        for (const [key, show] of Object.entries(saved.edited)) {
          try { await api.updateShow(show); }
          catch (error) { remaining.edited[Number(key)] = show; console.warn('[migration] edited show retained locally:', key, error); }
        }
        for (const show of saved.added) {
          try { await api.saveShow(show); }
          catch (error) { remaining.added.push(show); console.warn('[migration] added show retained locally:', show.name, error); }
        }
        if (currentUser.role === 'admin') {
          for (const num of saved.deleted) {
            try { await api.deleteShow(num); }
            catch (error) { remaining.deleted.push(num); console.warn('[migration] deleted show retained locally:', num, error); }
          }
        } else {
          remaining.deleted = saved.deleted.slice();
        }
      } else if (hasLegacyChanges) {
        // Read-only users cannot migrate or discard historical local edits.
        Object.assign(remaining, saved);
      }

      const migrationComplete = remaining.added.length === 0
        && Object.keys(remaining.edited).length === 0
        && remaining.deleted.length === 0;
      if (migrationComplete) {
        try { window.localStorage.removeItem(OVERRIDES_KEY); } catch {}
      } else {
        saveOverrides(remaining);
      }

      try {
        const data = await api.getAllShows() as TalkShow[];
        if (cancelled) return;
        setBaseShows(data);
        setOverrides(remaining);
        setTalkShows(applyOverrides(data, remaining));
        if (hasLegacyChanges && !migrationComplete) {
          console.warn('[migration] some legacy changes remain in local recovery storage');
        }
      } catch (error) {
        console.error('[shows] failed to load shared archive:', error);
        if (!cancelled) showToast('دریافت آرشیو از سرور ناموفق بود؛ اتصال سرور را بررسی کنید');
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role]);

  // On Electron desktop, require a fresh sign-in once per application launch.
  // sessionStorage survives in-app reloads but is cleared when the app process exits.
  // Browser/PWA sessions retain their existing persistent-login behavior.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDesktopLaunch = params.get('desktop') === '1';
    const launchMarker = 'bankresaneh_desktop_login_checked';
    if (isDesktopLaunch && !sessionStorage.getItem(launchMarker)) {
      localStorage.removeItem('bankresaneh_token');
      sessionStorage.setItem(launchMarker, '1');
    }

    const stored = localStorage.getItem('bankresaneh_token');
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Resolve the initial auth gate when no persisted session exists.
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the displayed list synchronized with persisted edits.
      setTalkShows(applyOverrides(baseShows, overrides));
    }
  }, [baseShows, overrides]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Persist a new set of overrides to state + localStorage in one place.
  const commitOverrides = (next: Overrides) => {
    setOverrides(next);
    saveOverrides(next);
  };

  // All new and existing shows are saved to the shared database.
  const handleSaveShow = async (show: TalkShow, isEdit: boolean) => {
    try {
      const saved = (isEdit ? await api.updateShow(show) : await api.saveShow(show)) as TalkShow;
      setBaseShows(prev => isEdit
        ? prev.map(item => item.num === saved.num ? saved : item)
        : [saved, ...prev.filter(item => item.num !== saved.num)]);
      const nextOverrides: Overrides = {
        added: overrides.added.filter(item => item.num !== show.num),
        edited: Object.fromEntries(Object.entries(overrides.edited).filter(([num]) => Number(num) !== show.num)),
        deleted: overrides.deleted.filter(num => num !== show.num),
      };
      commitOverrides(nextOverrides);
      showToast(isEdit ? `برنامه «${saved.name}» بروزرسانی شد` : `برنامه «${saved.name}» اضافه شد`);
    } catch (error: any) {
      showToast(error?.message || 'ذخیرهٔ برنامه ناموفق بود');
      throw error;
    }
  };

  // Deletion is authoritative and shared; it no longer hides records in one browser.
  const handleDeleteShow = async (num: number) => {
    try {
      await api.deleteShow(num);
      setBaseShows(prev => prev.filter(item => item.num !== num));
      const nextOverrides: Overrides = {
        added: overrides.added.filter(item => item.num !== num),
        edited: Object.fromEntries(Object.entries(overrides.edited).filter(([key]) => Number(key) !== num)),
        deleted: overrides.deleted.filter(item => item !== num),
      };
      commitOverrides(nextOverrides);
      showToast('برنامه حذف شد');
    } catch (error: any) {
      showToast(error?.message || 'حذف برنامه ناموفق بود');
    }
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

  // Add a custom genre to the shared server catalog (server enforces admin role).
  const handleAddGenre = async (g: Genre) => {
    if (!isAdmin) return;
    try {
      const result = await api.createCustomGenre({
        id: g.id, nameFa: g.nameFa, name: g.name, color: g.color, description: g.description, aliases: g.aliases,
      });
      setCustomGenres(prev => [...prev.filter(x => x.id !== g.id), ...hydrateCustomGenres([result.genre])]);
      showToast(`ژانر «${g.nameFa}» اضافه شد`);
    } catch (error: any) {
      showToast(error?.message || 'افزودن ژانر ناموفق بود');
    }
  };

  // Edit any genre (built-in or custom) through the shared server catalog.
  // The API migrates matching category references for every existing show atomically.
  const handleEditGenre = async (g: Genre) => {
    if (!isAdmin) return;
    const prev = customGenres.find(x => x.id === g.id) || GENRES.find(x => x.id === g.id);
    const aliases = Array.from(new Set([
      ...(prev?.aliases || g.aliases || []),
      ...(prev?.nameFa && prev.nameFa !== g.nameFa ? [prev.nameFa] : []),
    ])).filter(Boolean);
    try {
      const result = await api.updateCustomGenre({
        id: g.id, nameFa: g.nameFa, name: g.name, color: g.color,
        description: g.description, aliases,
      });
      const refreshedGenres = await api.getCustomGenres();
      setCustomGenres(hydrateCustomGenres(refreshedGenres.genres || [result.genre]));
      const refreshedShows = await api.getAllShows();
      setBaseShows(refreshedShows);
      setTalkShows(refreshedShows);
      showToast(`ژانر «${g.nameFa}» به‌روزرسانی شد — ${result.migratedCount || 0} برنامه همگام شد`);
    } catch (error: any) {
      showToast(error?.message || 'ویرایش ژانر ناموفق بود');
    }
  };

  // Deactivate a genre server-side; the API preserves programs and removes
  // only the matching genre label from their category field.
  const handleDeleteGenre = async (id: string) => {
    if (!isAdmin) return;
    const target = genres.find(x => x.id === id);
    try {
      const result = await api.deleteCustomGenre(id);
      const refreshedGenres = await api.getCustomGenres();
      setCustomGenres(hydrateCustomGenres(refreshedGenres.genres || []));
      const refreshedShows = await api.getAllShows();
      setBaseShows(refreshedShows);
      setTalkShows(refreshedShows);
      showToast(`ژانر «${target?.nameFa || id}» حذف شد — برنامه‌ها حفظ شدند؛ ${result.affectedShows || 0} برنامه به‌روزرسانی شد`);
    } catch (error: any) {
      showToast(error?.message || 'حذف ژانر ناموفق بود');
    }
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
    // Authentication unlocks the shared API bootstrap effect above. Never
    // reload the static JSON here: it would overwrite server-side edits.
    setCurrentUser(user);
    setAuthLoading(false);
  };

  if (authLoading) {
    return (
      <div className="login-screen min-h-screen relative flex flex-col items-center justify-center">
        <div className="login-ambient-light green-1"></div>
        <div className="login-ambient-light green-2"></div>
        <div className="login-ambient-light green-3"></div>
        <div className="relative z-20 flex flex-col items-center" style={{ gap: '16px' }}>
          <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#34d399' }}></div>
          <span style={{ color: 'rgba(134, 239, 172, 0.85)', fontSize: '14px' }}>در حال بارگذاری...</span>
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
        totalShows={talkShows.length}
        totalGenres={genres.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onToggleLang={toggleLang}
      />

      <DrawerMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentView={currentView}
        onNavigate={handleNavigate}
        onGenreSelect={handleGenreSelect}
        onLogout={handleLogout}
        onOpenSettings={() => { setShowSettings(true); setDrawerOpen(false); }}
        onOpenProfile={() => { setShowUserProfile(true); setDrawerOpen(false); }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        talkShows={talkShows}
        genres={genres}
      />

      <main key={currentView} className={`animate-view-enter ${isMobile ? 'p-4 pt-24 pb-28' : 'p-8 pt-28'}`}>
        {currentView === 'dashboard' && <Dashboard onGenreClick={(g) => navigate('genre', g)} talkShows={talkShows} uploadedCount={uploadedShows.length} onAdd={() => { setPresetCategory(undefined); setPresetGenre(null); setEditingShow(null); navigate('add'); }} canEdit={canEdit} isAdmin={isAdmin} genres={genres} onAddGenre={handleAddGenre} onEditGenre={handleEditGenre} onDeleteGenre={handleDeleteGenre} onShowClick={setSelectedShow} />}
        {currentView === 'programs' && <ProgramsView talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} genres={genres} onGenreSelect={(g) => navigate('genre', g)} onNavigate={handleNavigate} />}
        {currentView === 'genre' && selectedGenre && <ProgramsView genre={selectedGenre} talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} onAdd={() => handleAddFromGenre(selectedGenre)} genres={genres} onGenreSelect={(g) => navigate('genre', g)} onNavigate={handleNavigate} />}
        {currentView === 'reports' && <ReportsView talkShows={talkShows} uploadedShows={uploadedShows} showToast={showToast} onExport={(shows, format, meta) => setExportPreview({ shows, format, ...meta })} />}
        {currentView === 'add' && canEdit && <AddEditView talkShows={talkShows} onSave={handleSaveShow} editingShow={editingShow} setEditingShow={setEditingShow} onDone={() => { setEditingShow(null); setSelectedGenre(null); setPresetCategory(undefined); setPresetGenre(null); setCurrentView('programs'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }} showToast={showToast} presetCategory={presetCategory} presetGenre={presetGenre} genres={genres} />}
        {currentView === 'add' && !canEdit && (
          <div className="premium-glass p-8 text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#dc2626' }}>دسترسی غیرمجاز</h2>
            <p style={{ color: '#99f6e4' }}>شما اجازهٔ افزودن یا ویرایش برنامه‌ها را ندارید. برای دسترسی کامل با حساب مدیر یا ویراستار وارد شوید.</p>
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
          onPublish={(s) => {
            api.trackAnalytics('publish_show', 'show', String(s.num), `Published "${s.name}"`);
            setPublishShows([s]);
          }}
          onExport={(s, fmt) => {
            api.trackAnalytics(fmt === 'pdf' ? 'export_pdf' : 'export_excel', 'show', String(s.num), `Exported "${s.name}" as ${fmt.toUpperCase()}`);
            setExportPreview({ shows: [s], format: fmt });
          }}
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
          onSaved={() => { setShowBotConfig(false); showToast(t('publish.saved')); }}
        />
      )}

      {/* Settings modal (admin only) — server URL, users, change password */}
      {showSettings && isAdmin && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          showToast={showToast}
          onLogout={handleLogout}
          onPasswordChanged={(updatedUser) => { setCurrentUser(updatedUser); setShowSettings(false); }}
        />
      )}

      {/* User profile modal — for ALL users */}
      {showUserProfile && currentUser && (
        <UserProfileModal
          user={currentUser}
          onClose={() => setShowUserProfile(false)}
          showToast={showToast}
        />
      )}

      {/* Export preview modal */}
      {exportPreview && (
        <ExportPreviewModal
          shows={exportPreview.shows}
          format={exportPreview.format}
          title={exportPreview.title}
          subtitle={exportPreview.subtitle}
          organization={exportPreview.organization}
          onClose={() => setExportPreview(null)}
          onDownload={() => {
            showToast(t('export.downloaded'));
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
  const [isReady] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

   


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!username.trim() || !password) {
      setError(t('login.errorEmpty'));
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      onLogin(data.user);
    } catch (err: any) {
      setError(err?.message || t('login.errorFailed'));
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
              alt={t('app.title')}
              width={360}
              height={196}
              priority
            />
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Username */}
          <div>
            <label htmlFor="login-username" className="block text-sm font-bold mb-2" style={{ color: 'rgba(134, 239, 172, 0.9)' }}>
              {t('login.username')}
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('login.usernamePlaceholder') || 'نام کاربری خود را وارد کنید'}
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.96)',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#0d2218',
                fontSize: '15px',
                fontFamily: 'inherit',
                outline: 'none',
                textAlign: 'left',
                direction: 'ltr',
              }}
            />
          </div>

          {/* Password with show/hide */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-bold mb-2" style={{ color: 'rgba(134, 239, 172, 0.9)' }}>
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder') || 'رمز عبور خود را وارد کنید'}
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.96)',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  borderRadius: '12px',
                  padding: '12px 48px 12px 16px',
                  color: '#0d2218',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  textAlign: 'left',
                  direction: 'ltr',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors"
                style={{ color: '#0d7c4a', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13, 124, 74, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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

          {/* Submit — premium dark-green gradient button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-enter-premium group"
            style={{ marginTop: '8px' }}
          >
            <span className="relative z-10 flex items-center gap-3 justify-center" style={{ color: '#ffffff' }}>
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#ffffff' }}></div>
                  <span>{t('login.loading')}</span>
                </>
              ) : (
                <>
                  <span>{t('login.submit')}</span>
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
            نسخه ۲.۰.۰ • مرجع جامع برنامه‌های تلویزیونی بین‌المللی
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TOP APP BAR — fixed at top, hamburger (3-line) on the right,
// logo + title in the center, visible on BOTH desktop and mobile
// ============================================
function TopAppBar({ onMenuClick, isMobile, currentView, onBack, canGoBack, totalShows, totalGenres, theme, onToggleTheme, lang, onToggleLang }: {
  onMenuClick: () => void;
  isMobile: boolean;
  currentView: string;
  onBack: () => void;
  canGoBack: boolean;
  totalShows?: number;
  totalGenres?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: 'fa' | 'en';
  onToggleLang: () => void;
}) {
  const { t } = useLang();
  const viewTitles: Record<string, string> = {
    dashboard: t('app.tagline'),
    programs: t('view.programs'),
    genre: t('programs.genrePrograms'),
    reports: t('view.reports'),
    add: t('view.add') + ' / ' + t('common.edit'),
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40"
      style={{
        /* Header: 2 shades darker than background, slightly glossy */
        background: 'linear-gradient(90deg, rgba(5, 80, 65, 0.82) 0%, rgba(0, 95, 75, 0.78) 50%, rgba(8, 110, 90, 0.75) 100%)',
        backdropFilter: 'blur(24px) saturate(135%)',
        WebkitBackdropFilter: 'blur(24px) saturate(135%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        borderBottomLeftRadius: '30px',
        borderBottomRightRadius: '30px',
        overflow: 'hidden',
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
          aria-label={t('nav.openMenu')}
          className="flex flex-col justify-center items-center p-2.5 transition-all"
          style={{
            /* Liquid glass button — rounded */
            background: 'rgba(45, 212, 191, 0.1)',
            border: '1px solid rgba(45, 212, 191, 0.25)',
            color: '#5eead4',
            borderRadius: '14px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 10px rgba(0, 30, 25, 0.15)',
            minWidth: '44px',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(45, 212, 191, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(45, 212, 191, 0.1)';
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
            alt={t('app.title')}
            width={isMobile ? 110 : 160}
            height={isMobile ? 30 : 42}
            priority
            style={{
              /* Brighter, clearer logo — brighter shadow + slight brightness boost */
              filter: 'drop-shadow(0 3px 10px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px rgba(84, 217, 192, 0.25)) brightness(1.15) saturate(1.15)',
              flexShrink: 0,
            }}
          />
          {!isMobile && (
            <div
              className="flex flex-col"
              style={{ borderRight: '1px solid rgba(84, 217, 192, 0.2)', paddingRight: '12px' }}
            >
              <span style={{ color: '#f0fdf4', fontWeight: 800, fontSize: '14px', lineHeight: 1.2 }}>
                {t('app.tagline')}
              </span>
              <span style={{ color: '#54D9C0', fontSize: '11px', marginTop: '2px' }}>
                {t('app.title')} — {totalShows?.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US') || '0'} {t('dashboard.programs')} {t('dashboard.stripTitle').includes('ژانر') ? 'در' : 'in'} {totalGenres?.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US') || '0'} {t('drawer.genres')}
              </span>
            </div>
          )}
        </div>

        {/* Left: theme + language toggles, then back button (when there is history), else status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '44px', justifyContent: 'flex-end' }}>
          {/* Language toggle — FA/EN */}
          <button
            onClick={onToggleLang}
            aria-label={t('nav.toggleLang')}
            title={lang === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
            className="flex items-center justify-center transition-all"
            style={{
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              color: '#5eead4',
              borderRadius: '10px',
              minWidth: '36px',
              minHeight: '36px',
              fontWeight: 800,
              fontSize: '12px',
              padding: '0 8px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.1)'; }}
          >
            {lang === 'fa' ? 'EN' : 'فا'}
          </button>

          {/* Theme toggle — sun/moon */}
          <button
            onClick={onToggleTheme}
            aria-label={t('nav.toggleTheme')}
            title={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
            className="flex items-center justify-center transition-all"
            style={{
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              color: '#5eead4',
              borderRadius: '10px',
              minWidth: '36px',
              minHeight: '36px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.1)'; }}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {canGoBack ? (
            <button
              onClick={onBack}
              aria-label={t('nav.back')}
              title={t('nav.back')}
              className="flex items-center gap-2 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: isMobile ? '9px 12px' : '9px 16px',
                boxShadow: '0 4px 14px rgba(0, 107, 80, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                minWidth: '44px',
                minHeight: '44px',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {!isMobile && <span>{t('nav.backShort')}</span>}
            </button>
          ) : isMobile ? (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(13, 124, 74, 0.1)',
                color: '#54D9C0',
                border: '1px solid rgba(13, 124, 74, 0.2)',
              }}
            >
              {t('app.title')}
            </span>
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
              <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '12px' }}>{t('app.connected')}</span>
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
  talkShows: TalkShow[];
  genres?: Genre[];
}) {
  const { t, lang } = useLang();
  const [genresExpanded, setGenresExpanded] = useState(true);

  const navItems = [
    { key: 'dashboard', label: t('view.dashboard'), icon: 'home', desc: t('view.dashboard.desc') },
    { key: 'programs', label: t('view.programs'), icon: 'grid', desc: t('view.programs.desc') + ' — ' + (talkShows.length).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US') + ' ' + t('dashboard.programs') },
    { key: 'add', label: t('view.add'), icon: 'plus', desc: t('view.add.desc') },
    { key: 'reports', label: t('view.reports'), icon: 'reports', desc: t('view.reports.desc') },
  ] as const;

  // Don't render anything if not open — keeps DOM clean
  if (!open) return null;

  const roleLabel: Record<string, string> = {
    admin: t('settings.role.admin'),
    editor: t('settings.role.editor'),
    viewer: t('settings.role.viewer'),
  };

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <aside
        className="fixed top-0 right-0 bottom-0 animate-drawer-slide-in flex flex-col"
        style={{
          width: 'min(340px, 88vw)',
          /* Drawer: SAME as header — 2 shades darker than bg, slightly glossy */
          background: 'linear-gradient(90deg, rgba(5, 80, 65, 0.82) 0%, rgba(0, 95, 75, 0.78) 50%, rgba(8, 110, 90, 0.75) 100%)',
          backdropFilter: 'blur(24px) saturate(135%)',
          WebkitBackdropFilter: 'blur(24px) saturate(135%)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '-16px 0 56px rgba(0, 0, 0, 0.2), inset 1px 0 0 rgba(255, 255, 255, 0.12)',
          borderTopLeftRadius: '30px',
          borderBottomLeftRadius: '30px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header — logo + close */}
        <div
          className="p-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}
        >
          <Image
            src="/banke-rasane-logo.png"
            alt={t('app.title')}
            width={130}
            height={34}
            priority
            style={{ filter: 'drop-shadow(0 2px 8px rgba(13, 124, 74, 0.25))' }}
          />
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(244, 255, 255, 0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(244, 255, 255, 0.7)'; }}
            title={t('drawer.close')}
            aria-label={t('drawer.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation + genres (scrollable) */}
        <nav
          className="flex-1 overflow-y-auto p-3"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key as any)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-right"
                  style={isActive ? {
                    background: 'rgba(13, 124, 74, 0.1)',
                    border: '1px solid rgba(13, 124, 74, 0.25)',
                    color: '#54D9C0',
                    boxShadow: '0 2px 8px rgba(13, 124, 74, 0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
                  } : {
                    border: '1px solid transparent',
                    color: '#f0fdf4',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(13, 124, 74, 0.06)';
                      e.currentTarget.style.color = '#54D9C0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#f0fdf4';
                    }
                  }}
                >
                  <NavIcon name={item.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)', marginTop: '2px' }}>{item.desc}</div>
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
              style={{ color: 'rgba(138, 138, 122, 0.85)' }}
            >
              <span>{t('drawer.genres')} ({genres.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')})</span>
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
                      style={{ color: '#f0fdf4' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${g.color}25`;
                        e.currentTarget.style.color = g.color;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#f0fdf4';
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                        style={{
                          backgroundColor: g.color,
                          /* No glow on dot in drawer */
                        }}
                      ></div>
                      <span className="text-sm flex-1 text-right truncate">{lang === 'fa' ? g.nameFa : g.name}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: g.color }}
                      >
                        {count.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
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
          className="p-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(13, 124, 74, 0.1)' }}
        >
          {currentUser && (
            <div
              className="mb-2 p-3 rounded-xl"
              style={{
                /* Liquid glass user card */
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px) saturate(135%)',
                WebkitBackdropFilter: 'blur(16px) saturate(135%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: '#f0fdf4' }} title={currentUser.username}>
                    {currentUser.name || currentUser.username}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                      style={{
                        background: currentUser.role === 'admin' ? 'rgba(220, 38, 38, 0.3)' : currentUser.role === 'editor' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 185, 154, 0.3)',
                        color: currentUser.role === 'admin' ? '#fca5a5' : currentUser.role === 'editor' ? '#fcd34d' : '#54D9C0',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {roleLabel[currentUser.role] || currentUser.role}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }} dir="ltr">
                      @{currentUser.username}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile button — for ALL users */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full mb-1"
            style={{ color: '#f0fdf4' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium text-sm">{t('profile.title')}</span>
          </button>

          {/* Settings button — admin only */}
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full mb-1"
              style={{ color: '#f0fdf4' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(13, 124, 74, 0.08)';
                e.currentTarget.style.color = '#54D9C0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#f0fdf4';
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-sm">⚙ {t('settings.title')}</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full"
            style={{ color: '#f0fdf4' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#f0fdf4';
            }}
          >
            <NavIcon name="exit" />
            <span className="font-medium text-sm">{t('drawer.logout')}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, import('react').ReactElement> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    reports: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
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
  talkShows,
  genres = GENRES,
}: {
  currentView: string;
  onNavigate: (v: 'dashboard' | 'programs' | 'reports' | 'add') => void;
  onGenreSelect: (g: Genre) => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
  talkShows: TalkShow[];
  genres?: Genre[];
}) {
  const { t, lang } = useLang();
  const [showGenres, setShowGenres] = useState(false);

  return (
    <>
      {showGenres && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setShowGenres(false)}
        >
          <div
            className="fixed bottom-0 left-0 right-0 p-4 animate-slide-up-nav"
            style={{
              /* Same emerald glass as header */
              background: 'linear-gradient(90deg, rgba(0, 90, 72, 0.92) 0%, rgba(8, 127, 107, 0.88) 40%, rgba(22, 143, 135, 0.82) 65%, rgba(169, 214, 231, 0.65) 88%, rgba(230, 198, 224, 0.6) 100%)',
              backdropFilter: 'blur(28px) saturate(140%)',
              WebkitBackdropFilter: 'blur(28px) saturate(140%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '30px 30px 0 0',
              boxShadow: '0 -8px 30px rgba(0, 30, 25, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              paddingBottom: '32px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: '#f0fdf4' }}>{t('drawer.genres')} ({genres.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')})</h3>
              <button
                onClick={() => setShowGenres(false)}
                className="p-2 rounded-lg"
                style={{ color: 'rgba(244, 255, 255, 0.7)', background: 'rgba(255, 255, 255, 0.6)' }}
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
                      background: `${g.color}18`,
                      border: `1px solid ${g.color}40`,
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
                        <div className="text-sm font-bold truncate" style={{ color: '#f0fdf4' }}>{g.nameFa}</div>
                        <div className="text-xs font-bold" style={{ color: g.color }}>
                          {count.toLocaleString('fa-IR')} برنامه
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
          className="flex items-center justify-around no-scrollbar"
          style={{
            /* Mobile nav: SAME as header */
            background: 'linear-gradient(90deg, rgba(5, 80, 65, 0.82) 0%, rgba(0, 95, 75, 0.78) 50%, rgba(8, 110, 90, 0.75) 100%)',
            backdropFilter: 'blur(24px) saturate(135%)',
            WebkitBackdropFilter: 'blur(24px) saturate(135%)',
            borderRadius: '30px',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            padding: '8px',
          }}
        >
          <MobileNavBtn label="منو" icon="menu" active={false} onClick={onOpenDrawer} highlight />
          <MobileNavBtn label="آرشیو" icon="home" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          <MobileNavBtn label="برنامه‌ها" icon="grid" active={currentView === 'programs'} onClick={() => onNavigate('programs')} />
          <MobileNavBtn label={t('drawer.genres')} icon="genre" active={showGenres} onClick={() => setShowGenres(!showGenres)} highlight />
          <MobileNavBtn label="افزودن" icon="plus" active={currentView === 'add'} onClick={() => onNavigate('add')} />
          <MobileNavBtn label="خروج" icon="exit" active={false} onClick={onLogout} />
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
      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
      style={{
        background: active ? 'linear-gradient(135deg, rgba(34, 185, 154, 0.25) 0%, rgba(34, 185, 154, 0.1) 100%)' : 'transparent',
        border: active ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
        minWidth: '56px',
      }}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke={active ? '#ffffff' : 'rgba(255, 255, 255, 0.9)'}
        viewBox="0 0 24 24"
        style={{ filter: 'none' }}
      >
        {icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
        {icon === 'grid' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
        {icon === 'genre' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
        {icon === 'plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
        {icon === 'exit' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
        {icon === 'menu' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
      </svg>
      <span className="text-xs font-medium" style={{ color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.8)' }}>
        {label}
      </span>
    </button>
  );
}

// ============================================
// FEATURED CAROUSEL — Cover Flow style (one card at a time, dots below)
// ============================================
const FEATURED_KEY = 'bankresaneh_featured_shows_v1';

function FeaturedCarousel({ talkShows, onShowClick, isAdmin }: {
  talkShows: TalkShow[];
  onShowClick: (s: TalkShow) => void;
  isAdmin?: boolean;
}) {
  const { t, lang } = useLang();
  const [featuredNums, setFeaturedNums] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEATURED_KEY);
      // One-time hydration of persisted featured-shows from localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once on mount, guarded by `raw` check, no cascading renders.
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) setFeaturedNums(arr); }
    } catch {}
  }, []);

  const saveFeatured = (nums: number[]) => {
    setFeaturedNums(nums);
    try { localStorage.setItem(FEATURED_KEY, JSON.stringify(nums)); } catch {}
  };

  const featuredShows = useMemo(() => {
    return featuredNums.map(n => talkShows.find(s => s.num === n)).filter((s): s is TalkShow => s !== undefined);
  }, [featuredNums, talkShows]);

  useEffect(() => {
    if (featuredNums.length === 0 && talkShows.length > 0) {
      const defaults = talkShows.filter(s => s.images && s.images.length > 0).slice(0, 12).map(s => s.num);
      // Seed defaults only once when no user selection exists yet.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guarded by `featuredNums.length === 0`, stops re-running after first set.
      if (defaults.length > 0) saveFeatured(defaults);
    }
  }, [talkShows]);

  const scrollToCard = (idx: number) => {
    const el = trackRef.current;
    if (!el || featuredShows.length === 0) return;
    const clamped = Math.max(0, Math.min(featuredShows.length - 1, idx));
    const cards = el.querySelectorAll('[data-card-idx]');
    const card = cards[clamped] as HTMLElement;
    if (card) {
      const elRect = el.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.left - elRect.left - (el.clientWidth / 2 - card.offsetWidth / 2);
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
    setCurrentIdx(clamped);
  };

  const next = () => scrollToCard(currentIdx + 1);
  const prev = () => scrollToCard(currentIdx - 1);

  const scrollTO = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = () => {
    if (scrollTO.current) clearTimeout(scrollTO.current);
    scrollTO.current = setTimeout(() => {
      const el = trackRef.current;
      if (!el || featuredShows.length === 0) return;
      const cards = el.querySelectorAll('[data-card-idx]');
      let closestIdx = 0, closestDist = Infinity;
      cards.forEach((card, i) => {
        const cardEl = card as HTMLElement;
        const elRect = el.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const dist = Math.abs((cardRect.left + cardRect.width / 2) - (elRect.left + el.clientWidth / 2));
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });
      setCurrentIdx(closestIdx);
    }, 80);
  };

  const removeShow = (num: number) => saveFeatured(featuredNums.filter(n => n !== num));
  const addShow = (num: number) => { if (!featuredNums.includes(num)) saveFeatured([...featuredNums, num]); };

  const filteredSearch = useMemo(() => {
    if (!search.trim()) return talkShows.slice(0, 30);
    const q = search.toLowerCase();
    return talkShows.filter(s => s.name.toLowerCase().includes(q) || s.category.includes(search)).slice(0, 30);
  }, [search, talkShows]);

  return (
    <div className="featured-carousel">
      <div className="featured-carousel-header">
        <span className="featured-carousel-title">برنامه‌های منتخب</span>
        <div className="featured-carousel-nav">
          {isAdmin && (
            <button onClick={() => setShowPicker(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)' }}>+ {t('dashboard.manageStrip')}</button>
          )}
          <button className="featured-nav-btn" onClick={prev} disabled={currentIdx === 0} aria-label={t('dashboard.prev')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button className="featured-nav-btn" onClick={next} disabled={currentIdx >= featuredShows.length - 1} aria-label={t('dashboard.next')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
      </div>

      {featuredShows.length === 0 ? (
        <div className="featured-empty">{isAdmin ? (lang === 'fa' ? 'برنامه‌ای انتخاب نشده — روی «' + t('dashboard.manageStrip') + '» کلیک کنید' : 'No programs selected — click "' + t('dashboard.manageStrip') + '"') : (lang === 'fa' ? 'برنامه‌ای موجود نیست' : 'No programs available')}</div>
      ) : (
        <>
          <div className="featured-carousel-track" ref={trackRef} onScroll={handleScroll}>
            {featuredShows.map((show, idx) => {
              const thumb = getShowThumbnail(show);
              const isCenter = idx === currentIdx;
              return (
                <div key={show.num} data-card-idx={idx} className={`featured-card ${isCenter ? 'is-center' : ''}`}
                  onClick={() => { if (isCenter) onShowClick(show); else scrollToCard(idx); }}>
                  {isAdmin && <button className="featured-card-remove" onClick={(e) => { e.stopPropagation(); removeShow(show.num); }} title="حذف">×</button>}
                  {thumb.image ? <img className="featured-card-thumb" src={thumb.image} alt={show.name} /> : <div className="featured-card-thumb-placeholder" style={{ background: thumb.gradient }}>{show.name.charAt(0).toUpperCase()}</div>}
                  <div className="featured-card-info"><div className="featured-card-name">{show.name}</div><div className="featured-card-cat">{show.category}</div></div>
                </div>
              );
            })}
          </div>
          {featuredShows.length > 1 && (
            <div className="featured-dots">
              {featuredShows.map((_, i) => (<button key={i} className={`featured-dot ${i === currentIdx ? 'active' : ''}`} onClick={() => scrollToCard(i)} aria-label={`برنامه ${i + 1}`} />))}
            </div>
          )}
        </>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, rgba(0,60,48,0.95) 0%, rgba(8,90,75,0.92) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', padding: '20px', maxWidth: '520px', width: '100%', maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ color: '#f0fdf4', marginBottom: '12px', fontWeight: 800, fontSize: '16px' }}>مدیریت برنامه‌های منتخب</h3>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی برنامه..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.35)', color: '#f0fdf4', fontSize: '13px', outline: 'none', marginBottom: '12px', fontFamily: 'inherit' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
              {filteredSearch.map(show => {
                const isF = featuredNums.includes(show.num);
                return (<button key={show.num} onClick={() => isF ? removeShow(show.num) : addShow(show.num)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', background: isF ? 'rgba(34,185,154,0.2)' : 'rgba(255,255,255,0.05)', border: isF ? '1px solid rgba(34,185,154,0.4)' : '1px solid rgba(255,255,255,0.1)', color: '#f0fdf4', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}><span style={{ fontSize: '14px' }}>{isF ? '✓' : '+'}</span><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.name}</span></button>);
              })}
            </div>
            <button onClick={() => setShowPicker(false)} style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>✓ تأیید</button>
          </div>
        </div>
      )}
    </div>
  );
}
// USER PROFILE MODAL — iPhone Contacts style (for all users)
// ============================================
function UserProfileModal({ user, onClose, showToast }: {
  user: User;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  useEscapeKey(onClose, editing); // don't close on Escape while editing
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');
  const [deputy, setDeputy] = useState(user.deputy || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);

  const roleLabels: Record<string, string> = { admin: 'مدیر سیستم', editor: 'ویراستار', viewer: 'بیننده' };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(getApiUrl('api/auth/me'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('bankresaneh_token')}` },
        body: JSON.stringify({ name, phone, jobTitle, deputy, avatar }),
      });
      if (res.ok) {
        showToast(t('settings.profile.saved'));
        setEditing(false);
      } else {
        showToast(t('toast.error'));
      }
    } catch {
      showToast(t('toast.networkError'));
    }
    setSaving(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full"
        style={{
          maxWidth: '440px',
          maxHeight: '90vh',
          /* iPhone light grey liquid glass — entire card bright */
          background: 'linear-gradient(180deg, rgba(180, 180, 190, 0.45) 0%, rgba(160, 160, 170, 0.4) 50%, rgba(140, 140, 150, 0.35) 100%)',
          backdropFilter: 'blur(40px) saturate(180%) brightness(1.4)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.4)',
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-width banner image — bigger, text overlays on it, bottom fades into card */}
        <div style={{ position: 'relative', width: '100%', height: '280px', flexShrink: 0 }}>
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #6e6e73 0%, #8e8e93 50%, #aeaeb2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '96px', fontWeight: 900, color: 'rgba(255, 255, 255, 0.9)',
            }}>
              {(name || user.username).charAt(0).toUpperCase()}
            </div>
          )}
          {/* Gradient overlay — bottom fades into grey card background */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(180, 180, 190, 0.5) 50%, rgba(180, 180, 190, 0.9) 100%)',
          }} />
          {/* Top bar buttons — overlay on image */}
          <div className="flex items-center justify-between p-4" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <button
              onClick={onClose}
              className="p-2 rounded-full"
              style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', color: '#fff' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {editing ? (
              <button
                onClick={() => { setEditing(false); setName(user.name || ''); setPhone(user.phone || ''); setJobTitle(user.jobTitle || ''); setDeputy(user.deputy || ''); setAvatar(user.avatar || ''); }}
                style={{
                  padding: '6px 16px', borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                انصراف
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '6px 16px', borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                ویرایش
              </button>
            )}
          </div>
          {/* Upload button */}
          {editing && (
            <label style={{
              position: 'absolute', top: '60px', left: '12px',
              padding: '8px 14px', borderRadius: '999px',
              background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: 600,
            }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.82-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              تغییر عکس
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </label>
          )}
          {/* Name + role + username — overlaid ON the image */}
          <div style={{
            position: 'absolute', bottom: '16px', left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            padding: '0 16px',
          }}>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
              {name || user.username}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              @{user.username}
            </div>
            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '5px 16px', borderRadius: '999px',
              background: user.role === 'admin' ? 'rgba(220, 38, 38, 0.85)' : user.role === 'editor' ? 'rgba(245, 158, 11, 0.85)' : 'rgba(34, 185, 154, 0.85)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              marginTop: '4px',
              backdropFilter: 'blur(4px)',
            }}>
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        </div>

        {/* Contact details — below the banner */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-2">
          <ContactRow icon="👤" label="نام نمایشی" value={name} editing={editing} onChange={setName} placeholder="نام و نام خانوادگی" />
          <ContactRow icon="📱" label="شماره همراه" value={phone} editing={editing} onChange={setPhone} placeholder="0912xxxxxxx" dir="ltr" />
          <ContactRow icon="💼" label="عنوان شغلی" value={jobTitle} editing={editing} onChange={setJobTitle} placeholder="مثلاً: تهیه‌کننده" />
          <ContactRow icon="🏢" label="معاونت" value={deputy} editing={editing} onChange={setDeputy} placeholder="مثلاً: معاونت برنامه" />

          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: '16px', marginTop: '8px',
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: '#fff', fontWeight: 700, fontSize: '15px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(0, 107, 80, 0.4)',
              }}
            >
              {saving ? 'در حال ذخیره...' : '✓ ذخیره پروفایل'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable contact row — iPhone grey style
function ContactRow({ icon, label, value, editing, onChange, placeholder, dir }: {
  icon: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '14px 16px', borderRadius: '14px',
      background: 'rgba(160, 160, 170, 0.4)',
      backdropFilter: 'blur(10px) brightness(1.3)',
      WebkitBackdropFilter: 'blur(10px) brightness(1.3)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
    }}>
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '3px' }}>{label}</div>
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            dir={dir}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: '#f0fdf4', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', padding: 0,
            }}
          />
        ) : (
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f0fdf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir={dir}>
            {value || '—'}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ onGenreClick, talkShows, uploadedCount, onAdd, canEdit, isAdmin, genres = GENRES, onAddGenre, onEditGenre, onDeleteGenre, onShowClick }: {
  onGenreClick: (g: Genre) => void;
  talkShows: TalkShow[];
  uploadedCount: number;
  onAdd: () => void;
  canEdit: boolean;
  isAdmin?: boolean;
  genres?: Genre[];
  onAddGenre?: (g: Genre) => void;
  onEditGenre?: (g: Genre) => void;
  onDeleteGenre?: (id: string) => void;
  onShowClick?: (s: TalkShow) => void;
}) {
  const { t, lang } = useLang();
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [deletingGenre, setDeletingGenre] = useState<Genre | null>(null);

  // ----- Analytics computation -----
  // Build ranked genre list with counts and percentages.
  const genreStats = useMemo(() => {
    return genres
      .map(g => ({ genre: g, count: talkShows.filter(g.filterFn).length, color: g.color }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [genres, talkShows]);

  const totalShows = talkShows.length;
  const totalGenres = genres.length;
  const withImages = talkShows.filter(s => s.images && s.images.length > 0).length;
  const uploadedPct = totalShows > 0 ? Math.round((uploadedCount / totalShows) * 100) : 0;

  // Donut chart geometry — 200×200 SVG, 16 segments max for readability
  const DONUT_SIZE = 200;
  const DONUT_STROKE = 26;
  const DONUT_R = (DONUT_SIZE - DONUT_STROKE) / 2;          // 87
  const DONUT_CIRC = 2 * Math.PI * DONUT_R;                  // ~546.6
  const DONUT_CENTER = DONUT_SIZE / 2;                       // 100
  // Default: top 4 genres — initialize once with useState lazy initializer
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = JSON.parse(localStorage.getItem('bankresaneh_analytics_genres_v1') || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const STRIP_COUNT = 5;

  // Use memo for default selection — computed from genreStats
  const defaultGenreIds = useMemo(
    () => genreStats.slice(0, STRIP_COUNT).map(g => g.genre.id),
    [genreStats]
  );

  useEffect(() => {
    if (selectedGenreIds.length === 0 && defaultGenreIds.length > 0) {
      // Default-select the top strip genres when the user hasn't picked any.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guarded by `selectedGenreIds.length === 0`, runs once.
      setSelectedGenreIds(defaultGenreIds);
    }
  }, [defaultGenreIds]);

  useEffect(() => {
    try { localStorage.setItem('bankresaneh_analytics_genres_v1', JSON.stringify(selectedGenreIds)); } catch { /* storage may be disabled */ }
  }, [selectedGenreIds]);

  const stripGenres = useMemo(() => {
    return selectedGenreIds
      .map(id => genreStats.find(g => g.genre.id === id))
      .filter((x): x is NonNullable<typeof x> => x !== undefined)
      .slice(0, STRIP_COUNT);
  }, [selectedGenreIds, genreStats]);

  const donutSegments = useMemo(() => {
    const segs: { color: string; dash: number; offset: number; pct: number }[] = [];
    let acc = 0;
    const items = stripGenres.map(g => ({ color: g.color, count: g.count }));
    const total = items.reduce((s, x) => s + x.count, 0) || 1;
    for (const it of items) {
      const frac = it.count / total;
      const dash = frac * DONUT_CIRC;
      segs.push({
        color: it.color,
        dash,
        offset: -acc * DONUT_CIRC,
        pct: Math.round(frac * 100),
      });
      acc += frac;
    }
    return segs;
  }, [stripGenres]);

  // ----- Render -----
  return (
    <>
      {/* ====== ANALYTICS CARD — replaces the 4 small stat cards ====== */}
      <div className="mb-8 animate-fade-in">
        <div className="analytics-card">
          <div className="analytics-card-glow" aria-hidden />
          {/* Header */}
          <div className="analytics-card-header">
            <div className="analytics-card-header-left">
              <div>
                <div className="analytics-card-eyebrow">
                  <span>بانک رسانه</span>
                  <span className="analytics-card-brand-pill">آمار زنده</span>
                </div>
                <h2 className="analytics-card-title">نمای آماری کلی</h2>
                <p className="analytics-card-subtitle">توزیع برنامه‌ها در ژانرهای مختلف</p>
                <button type="button" onClick={() => setShowGenrePicker(true)} className="mt-3 rounded-lg px-3 py-2 text-xs font-bold" style={{ color: '#f0fdf4', background: 'rgba(0,65,52,0.35)', border: '1px solid rgba(255,255,255,0.35)' }}>⚙ انتخاب ژانرهای آمار</button>
              </div>
            </div>
          </div>

          {/* Body: donut LEFT, list RIGHT on desktop */}
          <div className="analytics-card-body">
            {/* ----- DONUT COL ----- */}
            <div className="analytics-donut-col">
              <div className="analytics-donut-wrap">
                <svg
                  className="analytics-donut-svg"
                  width={DONUT_SIZE}
                  height={DONUT_SIZE}
                  viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
                >
                  {/* Background ring */}
                  <circle
                    cx={DONUT_CENTER}
                    cy={DONUT_CENTER}
                    r={DONUT_R}
                    fill="none"
                    stroke="rgba(15, 64, 71, 0.18)"
                    strokeWidth={DONUT_STROKE}
                  />
                  {/* Segments — rotate -90deg so they start at 12 o'clock */}
                  <g transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}>
                    {donutSegments.map((seg, i) => (
                      <circle
                        key={i}
                        cx={DONUT_CENTER}
                        cy={DONUT_CENTER}
                        r={DONUT_R}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={DONUT_STROKE}
                        strokeDasharray={`${Math.max(seg.dash - 1.5, 0)} ${DONUT_CIRC}`}
                        strokeDashoffset={seg.offset}
                        strokeLinecap="round"
                        style={{
                          transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease',
                          /* No drop-shadow glow on donut segments */
                        }}
                      />
                    ))}
                  </g>
                </svg>
                <div className="analytics-donut-center">
                  <div className="analytics-donut-center-num">
                    {totalShows.toLocaleString('fa-IR')}
                  </div>
                  <div className="analytics-donut-center-label">برنامه</div>
                  <div className="analytics-donut-center-growth">
                    {totalGenres.toLocaleString('fa-IR')} ژانر
                  </div>
                </div>
              </div>

              {/* Mini stats row — vibrant colors */}
              <div className="analytics-mini-row">
                <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#10E98B' }}>
                  <div className="analytics-mini-num">{totalShows.toLocaleString('fa-IR')}</div>
                  <div className="analytics-mini-label">کل برنامه‌ها</div>
                </div>
                <div className="analytics-mini-divider" />
                <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#06B6D4' }}>
                  <div className="analytics-mini-num">{totalGenres.toLocaleString('fa-IR')}</div>
                  <div className="analytics-mini-label">ژانرها</div>
                </div>
                <div className="analytics-mini-divider" />
                <div className="analytics-mini-stat" style={{ ['--mini-color' as string]: '#F472B6' }}>
                  <div className="analytics-mini-num">{withImages.toLocaleString('fa-IR')}</div>
                  <div className="analytics-mini-label">با تصویر</div>
                </div>
              </div>
            </div>

            {/* ----- RANKED LIST — top 5 with rank/dot/name/bar/count/pct ----- */}
            <div className="analytics-list-col">
              <div className="analytics-list-header">
                <span>برترین ژانرها</span>
                <span className="analytics-list-header-count">
                  {totalGenres.toLocaleString('fa-IR')} دسته
                </span>
              </div>
              <div className="analytics-list-items">
                {stripGenres.map((g, i) => {
                  const pct = totalShows > 0 ? Math.round((g.count / totalShows) * 100) : 0;
                  return (
                    <button
                      key={g.genre.id}
                      onClick={() => onGenreClick(g.genre)}
                      className="analytics-list-row"
                      style={{ ['--row-color' as string]: g.color }}
                      title={g.genre.description}
                    >
                      <span className="analytics-list-rank">{(i + 1).toLocaleString('fa-IR')}</span>
                      <span className="analytics-list-dot" />
                      <span className="analytics-list-name">{g.genre.nameFa}</span>
                      <span className="analytics-list-bar-wrap">
                        <span
                          className="analytics-list-bar"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </span>
                      <span className="analytics-list-count">{g.count.toLocaleString('fa-IR')}</span>
                      <span className="analytics-list-pct">{pct.toLocaleString('fa-IR')}٪</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genre picker modal — lets user change which genres are shown in the strip */}
      {showGenrePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowGenrePicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(7, 55, 48, 0.95) 0%, rgba(10, 70, 60, 0.92) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(84, 217, 192, 0.3)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '70vh',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0, 30, 25, 0.4)',
            }}
          >
            <h3 style={{ color: '#f0fdf4', marginBottom: '8px', fontWeight: 800 }}>
              انتخاب ژانرهای نمایش داده‌شده
            </h3>
            <p style={{ color: '#7ba8a0', fontSize: '12px', marginBottom: '16px' }}>
              {STRIP_COUNT.toLocaleString('fa-IR')} ژانر برای نمایش در نوار افقی انتخاب کنید (برای حذف، دوباره کلیک کنید)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {genreStats.map(g => {
                const checked = selectedGenreIds.includes(g.genre.id);
                return (
                  <button
                    key={g.genre.id}
                    onClick={() => {
                      setSelectedGenreIds(prev => {
                        if (prev.includes(g.genre.id)) {
                          return prev.filter(id => id !== g.genre.id);
                        }
                        if (prev.length >= STRIP_COUNT) return prev; // Max limit
                        return [...prev, g.genre.id];
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: checked ? `rgba(84, 217, 192, 0.18)` : 'rgba(255, 255, 255, 0.04)',
                      border: checked ? `1px solid ${g.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#f0fdf4',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'right',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.genre.nameFa}
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>
                      {g.count.toLocaleString('fa-IR')}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowGenrePicker(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: 'white',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✓ تأیید
            </button>
          </div>
        </div>
      )}

      {/* ====== FEATURED CAROUSEL — Netflix-style program row ====== */}
      <FeaturedCarousel
        talkShows={talkShows}
        onShowClick={(s) => onShowClick?.(s)}
        isAdmin={isAdmin}
      />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#f0fdf4' }}>همهٔ ژانرها</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onAddGenre && (
            <button
              onClick={() => setShowAddGenre(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                /* Same style as add-program button — emerald glass */
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 14px rgba(0, 107, 80, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              + افزودن ژانر
            </button>
          )}
          {canEdit && (
            <button
              onClick={onAdd}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                /* Same style as add-genre button — emerald glass */
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 14px rgba(0, 107, 80, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              + افزودن برنامه
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {genres.map((g, idx) => {
          const count = talkShows.filter(g.filterFn).length;
          const genreDescription = (g.description || '').replace(/^[0-9۰-۹٠-٩]+[\s,٬]*برنامه\s*[—-]?\s*/, '').trim();
          const canManage = isAdmin && onEditGenre && onDeleteGenre;
          return (
            <div
              key={g.id}
              className="premium-genre-card animate-card-enter text-right relative"
              style={{
                animationDelay: `${idx * 50}ms`,
                ['--genre-color' as string]: g.color,
                ['--card-index' as string]: idx,
              }}
            >
              {canManage && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingGenre(g); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    title="ویرایش ژانر"
                    aria-label="ویرایش ژانر"
                    style={{
                      background: 'rgba(255, 255, 255, 0.18)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeletingGenre(g); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    title="حذف ژانر"
                    aria-label="حذف ژانر"
                    style={{
                      background: 'rgba(220, 38, 38, 0.25)',
                      border: '1px solid rgba(220, 38, 38, 0.45)',
                      color: '#fecaca',
                      cursor: 'pointer',
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => onGenreClick(g)}
                className="w-full text-right"
                style={{ background: 'transparent', border: 'none', padding: '0', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      /* Colored icon container — vibrant, no glow */
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-4xl font-black" style={{ color: '#ffffff' }}>
                      {count.toLocaleString('fa-IR')}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>برنامه</div>
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#ffffff' }}>{g.nameFa}</h3>
                {genreDescription ? (
                  <p className="text-sm mt-3" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>{genreDescription}</p>
                ) : null}
                <div className="mt-4 flex items-center text-sm font-bold text-white">
                  مشاهده و جستجو
                  <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {showAddGenre && onAddGenre && (
        <AddGenreModal
          onClose={() => setShowAddGenre(false)}
          onSave={(g) => { onAddGenre(g); setShowAddGenre(false); }}
        />
      )}

      {editingGenre && onEditGenre && (
        <AddGenreModal
          editingGenre={editingGenre}
          onClose={() => setEditingGenre(null)}
          onSave={(g) => { onEditGenre(g); setEditingGenre(null); }}
        />
      )}

      {deletingGenre && onDeleteGenre && (
        <DeleteGenreConfirm
          genre={deletingGenre}
          count={talkShows.filter(deletingGenre.filterFn).length}
          onClose={() => setDeletingGenre(null)}
          onConfirm={() => { onDeleteGenre(deletingGenre.id); setDeletingGenre(null); }}
        />
      )}
    </>
  );
}

function StatIcon({ name }: { name: string }) {
  const icons: Record<string, import('react').ReactElement> = {
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
// GENRE FILE ATTACHMENT — admin uploads PDF/Excel, all users can download
// ============================================
function GenreFileAttachment({ genreId, genreName, canEdit }: {
  genreId: string;
  genreName: string;
  canEdit: boolean;
}) {
  const STORAGE_KEY = `bankresaneh_genre_file_${genreId}`;
  const [fileData, setFileData] = useState<{ name: string; type: string; data: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFileData(JSON.parse(raw));
      }
    } catch {}
  }, [STORAGE_KEY]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('حداکثر حجم فایل ۵ مگابایت');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = { name: file.name, type: file.type, data: reader.result as string };
      setFileData(data);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {
        alert('خطا در ذخیره — حجم فایل زیاد است');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    if (!fileData) return;
    const a = document.createElement('a');
    a.href = fileData.data;
    a.download = fileData.name;
    a.click();
  };

  const handleDelete = () => {
    setFileData(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {fileData ? (
        <>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            {fileData.type.includes('pdf') ? '📄' : '📊'} دانلود {fileData.name.length > 20 ? fileData.name.substring(0, 20) + '...' : fileData.name}
          </button>
          {canEdit && (
            <button
              onClick={handleDelete}
              className="px-2 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: 'rgba(220, 38, 38, 0.2)',
                color: '#fca5a5',
                border: '1px solid rgba(220, 38, 38, 0.3)',
              }}
            >
              🗑 حذف
            </button>
          )}
        </>
      ) : canEdit ? (
        <label
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          📎 آپلود PDF/Excel
          <input type="file" accept=".pdf,.xls,.xlsx,.csv" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      ) : null}
    </div>
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
  onNavigate,
  genres,
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
  onNavigate?: (v: 'dashboard' | 'programs' | 'reports' | 'add') => void;
  genres?: Genre[];
}) {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterSize, setFilterSize] = useState('all');
  const [filterViewers, setFilterViewers] = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [islamicOnly, setIslamicOnly] = useState(false);
  // How many shows to display — starts at 60, increases by 60 when user clicks "بیشتر"
  const [displayCount, setDisplayCount] = useState(60);

  const filteredShows = useMemo(() => {
    let shows = [...talkShows];
    if (genre) shows = shows.filter(genre.filterFn);
    if (filterSize !== 'all') shows = shows.filter(s => s.size === filterSize);
    if (filterViewers !== 'all') shows = shows.filter(s => s.viewers === filterViewers);
    if (filterStyle !== 'all') shows = shows.filter(s => s.style === filterStyle);
    if (islamicOnly) shows = shows.filter(s => detectCountries(s).length > 0);
    if (search) {
      // Normalize search query: unify Arabic/Persian variants + remove ZWNJ
      const normalizeFa = (text: string) =>
        text
          .replace(/\u064a/g, '\u06cc')  // ي (Arabic) → ی (Persian)
          .replace(/\u0643/g, '\u06a9')  // ك (Arabic) → ک (Persian)
          .replace(/\u0629/g, '\u0647')  // ة (Taa Marbuta) → ه
          .replace(/\u200c/g, '')         // remove ZWNJ
          .replace(/\u200f/g, '')         // remove RLM
          .toLowerCase()
          .trim();

      const q = normalizeFa(search);
      // Section-specific search: use genre.searchFields if defined, else search broadly.
      const fields: (keyof TalkShow)[] = genre?.searchFields || ['name', 'summary', 'category', 'descriptionFa', 'materials', 'style', 'elements', 'colors'];
      shows = shows.filter(s => {
        for (const f of fields) {
          const v = s[f];
          if (typeof v === 'string') {
            if (normalizeFa(v).includes(q)) return true;
          } else if (Array.isArray(v)) {
            if (v.some(item => normalizeFa(String(item)).includes(q))) return true;
          }
        }
        return false;
      });
    }
    return shows;
  }, [talkShows, genre, search, filterSize, filterViewers, filterStyle, islamicOnly]);

  const handleUploadSelected = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    selectedShows.forEach(s => api.trackAnalytics('publish_show', 'show', String(s.num), `Bulk published "${s.name}"`));
    onPublish(selectedShows);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handlePDF = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    selectedShows.forEach(s => api.trackAnalytics('export_pdf', 'show', String(s.num), `Bulk PDF "${s.name}"`));
    onExport(selectedShows, 'pdf');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleExcel = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    selectedShows.forEach(s => api.trackAnalytics('export_excel', 'show', String(s.num), `Bulk Excel "${s.name}"`));
    onExport(selectedShows, 'excel');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const gc = genre?.color || '#10b981';

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#f0fdf4' }}>
          {genre ? (lang === 'fa' ? genre.nameFa : genre.name) : t('programs.allPrograms')}
        </h1>
        <p style={{ color: '#99f6e4' }}>
          {filteredShows.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} {t('programs.count')}
          {genre && ` • ${genre.description}`}
        </p>
      </header>

      {genre && (
        <div
          className="premium-glass mb-6 p-6"
          style={{
            /* Bright glass card for genre header — visible & readable */
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(135%)',
            WebkitBackdropFilter: 'blur(20px) saturate(135%)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '24px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black"
              style={{
                /* Bright colored icon container — visible */
                backgroundColor: gc,
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>{genre.nameFa}</h2>
                {canEdit && onAdd && (
                  <button
                    onClick={onAdd}
                    className="btn-enter-premium text-sm"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    + افزودن برنامه
                  </button>
                )}
              </div>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)' }} className="text-sm mt-1">{genre.description}</p>

              {/* Genre file attachment — admin uploads, all users download */}
              <GenreFileAttachment genreId={genre.id} genreName={genre.nameFa} canEdit={canEdit} />
            </div>
          </div>
        </div>
      )}

      {/* Search & toolbar — mobile-friendly: full-width search, actions row, horizontally scrollable filter chips */}
      <div className="p-3 sm:p-4 mb-6 space-y-3" style={{
        background: 'linear-gradient(90deg, rgba(5, 70, 58, 0.78) 0%, rgba(0, 85, 68, 0.74) 50%, rgba(8, 95, 78, 0.7) 100%)',
        backdropFilter: 'blur(24px) saturate(135%)',
        WebkitBackdropFilter: 'blur(24px) saturate(135%)',
        borderRadius: '20px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      }}>
        {/* Search — full width on every screen size */}
        <div className="relative">
          <svg
            className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(244, 255, 255, 0.7)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('programs.searchPlaceholder')} ${genre ? (lang === 'fa' ? genre.nameFa : genre.name) : t('programs.allPrograms')}...`}
            style={{
              /* Glass search box matching the theme */
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              padding: '11px 36px 11px 16px',
              width: '100%',
              fontFamily: 'inherit',
              color: '#f0fdf4',
              outline: 'none',
              fontSize: '15px',
            }}
          />
        </div>

        {/* Actions row — view toggle + multi-select + Islamic filter */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <button
              onClick={() => setView('grid')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'grid' ? { background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', color: 'white' } : { color: 'rgba(244, 255, 255, 0.7)' }}
              aria-label="نمایش شبکه‌ای"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'list' ? { background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', color: 'white' } : { color: 'rgba(244, 255, 255, 0.7)' }}
              aria-label="نمایش لیستی"
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
            title="فقط برنامه‌های مرتبط با کشورهای اسلامی"
            style={islamicOnly ? {
              background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.4)',
            } : {
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
            }}
          >
            🌍 اسلامی
          </button>

          {canEdit && (
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex-1"
              style={selectionMode ? {
                background: 'rgba(13, 124, 74, 0.15)',
                border: '1px solid rgba(13, 124, 74, 0.3)',
                color: '#54D9C0',
              } : {
                background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              {selectionMode ? `✓ ${t('common.ok')} (${selectedIds.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')})` : t('programs.selectMultiple')}
            </button>
          )}
          {!canEdit && (
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium flex-1 text-center"
              style={{
                background: 'rgba(107, 143, 122, 0.08)',
                color: 'rgba(244, 255, 255, 0.7)',
                border: '1px solid rgba(107, 143, 122, 0.2)',
              }}
              title="برای افزودن یا ویرایش برنامه‌ها با حساب مدیر یا ویراستار وارد شوید"
            >
              🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید
            </div>
          )}
        </div>

        {/* Filters — two horizontally scrollable rows (no chaotic wrapping on mobile) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm flex-shrink-0" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>اندازه:</span>
            {[
              { key: 'all', label: 'همه' },
              { key: 'بزرگ/لوکس', label: 'بزرگ/لوکس' },
              { key: 'متوسط/استاندارد', label: 'متوسط' },
              { key: 'کوچک/اقتصادی', label: 'کوچک' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterSize(f.key)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                style={filterSize === f.key ? {
                  background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm flex-shrink-0" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>سبک:</span>
            {[
              { key: 'all', label: 'همه' },
              { key: 'مدرن', label: 'مدرن' },
              { key: 'ترکیبی', label: 'ترکیبی' },
              { key: 'مینیمال', label: 'مینیمال' },
              { key: 'کلاسیک/سنتی', label: 'کلاسیک' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStyle(f.key)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                style={filterStyle === f.key ? {
                  background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  color: 'rgba(255, 255, 255, 0.9)',
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
            <span style={{ color: '#54D9C0' }} className="font-medium text-sm">
              {selectedIds.length.toLocaleString('fa-IR')} برنامه انتخاب شده
            </span>
            <button
              onClick={handleUploadSelected}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)' }}
            >
              📱 انتشار
            </button>
            <button
              onClick={handlePDF}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)' }}
            >
              📄 PDF
            </button>
            <button
              onClick={handleExcel}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 12px rgba(0, 107, 80, 0.4)' }}
            >
              📊 Excel
            </button>
            <button
              onClick={() => { setSelectedIds([]); setSelectionMode(false); }}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              لغو
            </button>
          </div>
        )}
      </div>

      {/* Genre breadcrumb bar — elegant pill chips with color identity dots */}
      {genre && genres && genres.length > 0 && (
        <div className="mb-4">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              scrollSnapType: 'x proximity',
              paddingBottom: '8px',
            }}
          >
            {genres.filter(g => g.id !== 'decor' && g.id !== 'psa' && g.id !== 'deepobs' && g.id !== 'ads').map(g => {
              const isActive = g.id === genre.id;
              const rgb = hexToRgb(g.color);
              return (
                <button
                  key={g.id}
                  onClick={() => onGenreSelect?.(g)}
                  className="group flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                  style={isActive ? {
                    // Active: solid genre color with gradient + glow
                    background: `linear-gradient(135deg, ${g.color} 0%, rgba(${rgb}, 0.85) 100%)`,
                    color: '#ffffff',
                    border: `1px solid rgba(${rgb}, 0.6)`,
                    boxShadow: `0 4px 16px ${g.color}66, 0 0 0 2px rgba(${rgb}, 0.15), inset 0 1px 0 rgba(255,255,255,0.25)`,
                    scrollSnapAlign: 'center',
                  } : {
                    // Rest: dark frosted glass with a colored dot indicator
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(12px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    scrollSnapAlign: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      // Hover: subtle color tint + glow, with the genre's own color bleeding through
                      e.currentTarget.style.background = `linear-gradient(135deg, rgba(${rgb}, 0.35) 0%, rgba(${rgb}, 0.15) 100%)`;
                      e.currentTarget.style.borderColor = `rgba(${rgb}, 0.5)`;
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.boxShadow = `0 4px 16px ${g.color}40, 0 0 0 2px rgba(${rgb}, 0.1)`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      // Make the dot brighter on hover
                      const dot = e.currentTarget.querySelector('.genre-dot') as HTMLElement | null;
                      if (dot) {
                        dot.style.transform = 'scale(1.3)';
                        dot.style.boxShadow = `0 0 8px ${g.color}`;
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.35)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      const dot = e.currentTarget.querySelector('.genre-dot') as HTMLElement | null;
                      if (dot) {
                        dot.style.transform = 'scale(1)';
                        dot.style.boxShadow = 'none';
                      }
                    }
                  }}
                >
                  {/* Color identity dot — shows the genre's color at rest, glows on hover */}
                  <span
                    className="genre-dot inline-block rounded-full transition-all"
                    style={isActive ? {
                      width: '6px', height: '6px',
                      background: '#ffffff',
                      boxShadow: '0 0 6px rgba(255,255,255,0.8)',
                    } : {
                      width: '6px', height: '6px',
                      background: g.color,
                      boxShadow: `0 0 4px rgba(${rgb}, 0.5)`,
                    }}
                  />
                  {g.nameFa}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredShows.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          <p>{t('programs.noResults')}</p>
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

      {filteredShows.length > displayCount && (
        <div className="text-center mt-8">
          <button
            onClick={() => setDisplayCount(c => c + 60)}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 14px rgba(13, 124, 74, 0.3)',
              cursor: 'pointer',
            }}
          >
            {lang === 'fa'
              ? `نمایش بیشتر (${(filteredShows.length - displayCount).toLocaleString('fa-IR')} برنامه باقی‌مانده)`
              : `Show more (${filteredShows.length - displayCount} remaining)`
            }
          </button>
          <p className="text-xs mt-2" style={{ color: 'rgba(244, 255, 255, 0.6)' }}>
            {lang === 'fa'
              ? `نمایش ${Math.min(displayCount, filteredShows.length).toLocaleString('fa-IR')} از ${filteredShows.length.toLocaleString('fa-IR')} برنامه`
              : `Showing ${Math.min(displayCount, filteredShows.length)} of ${filteredShows.length}`
            }
          </p>
        </div>
      )}
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
          <>
            <img
              src={thumb.image}
              alt={show.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // Image failed to load (likely 404 from API) — fall back to the gradient placeholder.
                // Hide the <img> so the parent's background gradient shows through.
                (e.target as HTMLImageElement).style.display = 'none';
                // Also show the show name overlay so users still see what the program is.
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const overlay = parent.querySelector('.fallback-name-overlay') as HTMLElement | null;
                  if (overlay) overlay.style.display = 'flex';
                }
              }}
            />
            {/* Fallback overlay (hidden by default, shown if image fails to load) */}
            <div className="fallback-name-overlay absolute inset-0 items-center justify-center p-4" style={{ display: 'none' }}>
              <div className="text-center">
                <div
                  className="text-2xl font-black mb-1"
                  style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)', direction: 'rtl', textAlign: 'center' }}
                >
                  {show.name.length > 25 ? show.name.substring(0, 23) + '...' : show.name}
                </div>
                <div
                  className="text-xs font-medium px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'rgba(255,255,255,0.25)', color: 'white', backdropFilter: 'blur(8px)' }}
                >
                  {show.style}
                </div>
              </div>
            </div>
            {/* Dark gradient at bottom so the name is readable on the image */}
            <div className="absolute inset-x-0 bottom-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)', padding: '24px 12px 8px' }}>
              <div className="text-sm font-bold" style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)', direction: 'rtl', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {show.name}
              </div>
            </div>
          </>
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
                  style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)', direction: 'rtl', textAlign: 'center' }}
                >
                  {show.name.length > 25 ? show.name.substring(0, 23) + '...' : show.name}
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
              background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
            style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
          >
            {show.style}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}>
              👥 تماشاگر
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2" style={{ direction: 'rtl', textAlign: 'right', color: '#f0fdf4' }}>
          {show.name}
        </h3>

        <p className="text-xs line-clamp-2 mb-3" style={{ color: '#99f6e4' }}>
          {show.summary && show.summary !== '—' ? show.summary : show.category}
        </p>

        {/* Section-specific genre tags (emerald badges) */}
        {genreTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
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

        <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          <span className="truncate" title={show.category}>
            {show.category.replace(/^\d+\.\s*/, '').substring(0, 18)}
          </span>
          <span className="font-bold" style={{ color: '#54D9C0' }}>#{show.num.toLocaleString('fa-IR')}</span>
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
            style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
          >
            {show.style}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(13, 124, 74, 0.1)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.25)' }}>
            {show.size}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(13, 124, 74, 0.1)', color: '#54D9C0' }}>
              👥
            </span>
          )}
          {isUploaded && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124, 58, 237, 0.3)', color: '#c4b5fd' }}>
              ☁
            </span>
          )}
        </div>
        <h3 className="font-bold text-sm mb-1 truncate" style={{ direction: 'rtl', textAlign: 'right', color: '#f0fdf4' }}>{show.name}</h3>
        <p className="text-xs truncate" style={{ color: '#99f6e4' }}>{show.summary && show.summary !== '—' ? show.summary : show.category}</p>
        {(genreTags.length > 0 || userTags.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
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
        <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>شماره</div>
        <div className="font-bold text-sm" style={{ color: '#54D9C0' }}>#{show.num.toLocaleString('fa-IR')}</div>
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
  const { t } = useLang();
  const thumb = getShowThumbnail(show);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Close on Escape — disabled while the delete-confirmation dialog is open
  // so the user must explicitly choose "بله" or "خیر".
  useEscapeKey(onClose, confirmDelete);
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
                  👥 با تماشاگر
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ direction: 'ltr', textAlign: 'right', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {show.name}
            </h2>
            <p className="text-sm opacity-90">برنامهٔ شمارهٔ {show.num.toLocaleString('fa-IR')}</p>
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
            <h4 className="font-bold mb-2" style={{ color: '#f0fdf4' }}>دربارهٔ برنامه</h4>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.8 }}>{show.descriptionFa}</p>
          </div>

          {/* Video links gallery */}
          {show.videos && show.videos.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>
                🎬 ویدیوهای برنامه
                <span className="text-xs font-normal mr-2" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
                  ({show.videos.length.toLocaleString('fa-IR')} ویدیو)
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
                        background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
                          style={{ color: 'rgba(255, 255, 255, 0.9)', direction: 'ltr', textAlign: 'left' }}
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
            <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>دسترسی مستقیم</h4>
            <div className="flex flex-wrap gap-2">
              <a
                href={show.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)', textDecoration: 'none' }}
              >
                ▶ تماشا در یوتیوب
              </a>
              <a
                href={show.imdb}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', textDecoration: 'none' }}
              >
                🎬 صفحهٔ IMDb
              </a>
              <a
                href={show.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)', textDecoration: 'none' }}
              >
                📖 ویکی‌پدیا
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
              📱 انتشار در شبکه‌های اجتماعی
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(show)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
              >
                ✏ ویرایش
              </button>
            )}
            <button
              onClick={() => onExport(show, 'pdf')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            >
              📄 گزارش PDF
            </button>
            <button
              onClick={() => onExport(show, 'excel')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
            >
              📊 گزارش Excel
            </button>
            {canEdit && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
              >
                🗑 حذف برنامه
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
                این برنامه حذف شود؟ (قابل بازگشت نیست)
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(107, 143, 122, 0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122, 0.3)' }}
                >
                  انصراف
                </button>
                <button
                  onClick={() => { onDelete(show.num); onClose(); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white' }}
                >
                  بله، حذف کن
                </button>
              </div>
            </div>
          )}

          {/* Decor details */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>مشخصات دکور و صحنه</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField label="دسته‌بندی" value={show.category} />
              <DetailField label="سبک دکور" value={show.style} />
              <DetailField label="اندازهٔ استودیو" value={show.size} />
              <DetailField label="تماشاگر" value={show.viewers} />
              <DetailField label="سبک دکور" value={show.style} />
              <DetailField label="جلوه‌ها" value={show.effects} />
              <DetailField label="چیدمان" value={show.layout} />
              <DetailField label="نورپردازی" value={show.lighting} />
              <DetailField label="عناصر دکور" value={show.elements} />
              <DetailField label="مواد" value={show.materials} />
              <div className="sm:col-span-2">
                <DetailField label="رنگ‌آمیزی" value={show.colors} />
              </div>
            </div>
          </div>

          {/* Decor summary */}
          {show.summary && show.summary !== '—' && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: `${thumb.accent}10`, border: `1px solid ${thumb.accent}25` }}>
              <h4 className="font-bold mb-2" style={{ color: '#f0fdf4' }}>خلاصهٔ دکور</h4>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.7 }}>{show.summary}</p>
            </div>
          )}

          {/* Tags section — user-defined tags + detected Islamic countries */}
          {((show.tags && show.tags.length > 0) || countries.length > 0 || show.country) && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>🏷 برچسب‌ها</h4>
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
                  <span className="text-xs font-bold" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>🌍 کشورهای شناسایی‌شده:</span>
                  {countries.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-md font-medium"
                      style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {show.country && (
                <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
                  کشور مبدا (وارد شده): <strong style={{ color: '#f0fdf4' }}>{show.country}</strong>
                </div>
              )}
            </div>
          )}

          {/* 🔗 Related programs — computed from allShows via findRelated */}
          {related.length > 0 && (
            <div className="mt-6" style={{ overflow: 'visible' }}>
              <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>🔗 برنامه‌های مرتبط</h4>
              <div className="flex items-center gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
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
      <div className="text-xs font-bold mb-1" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>{label}</div>
      <div className="text-sm" style={{ color: '#f0fdf4' }}>{value || '—'}</div>
    </div>
  );
}

// ============================================
// ADD/EDIT VIEW
// ============================================
function AddEditView({ talkShows, onSave, editingShow, setEditingShow, onDone, showToast, presetCategory, presetGenre, genres = GENRES }: {
  talkShows: TalkShow[];
  onSave: (show: TalkShow, isEdit: boolean) => Promise<void> | void;
  editingShow: TalkShow | null;
  setEditingShow: (s: TalkShow | null) => void;
  onDone: () => void;
  showToast: (msg: string) => void;
  presetCategory?: string;
  presetGenre?: Genre | null;
  genres?: Genre[];
}) {
  const { t } = useLang();
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
      decorIncluded: false,
      tags: [],
    }
  );
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatePreview, setTranslatePreview] = useState<Record<string, string> | null>(null);

  // Translate text fields to Persian via the /api/translate endpoint.
  // The endpoint is server-side only (the SDK key never reaches the client).
  // We show a PREVIEW first — the user can review, edit, or discard before
  // the translation is applied to the form.
  const handleTranslate = async () => {
    setTranslating(true);
    setTranslatePreview(null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        // Permission-guarded route (add_shows/edit_shows) — without the Bearer
        // token the server always replied 403 and translation silently failed.
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ fields: form }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(`خطای ترجمه: ${data.error}`);
      } else if (data.translations) {
        // Only show fields that actually changed (different from original).
        const changed: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.translations as Record<string,string>)) {
          if (v !== (form as Record<string, unknown>)[k]) changed[k] = v;
        }
        if (Object.keys(changed).length === 0) {
          showToast('متن از قبل فارسی است — چیزی برای ترجمه نیست.');
        } else {
          setTranslatePreview(changed);
          showToast(`${Object.keys(changed).length} فیلد ترجمه شد — پیش‌نمایش را بررسی کنید.`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'خطای ناشناخته';
      showToast('خطا در ارتباط با سرویس ترجمه: ' + msg);
    } finally {
      setTranslating(false);
    }
  };

  const applyTranslation = () => {
    if (!translatePreview) return;
    setForm((prev) => ({ ...prev, ...translatePreview }));
    setTranslatePreview(null);
    showToast('ترجمه اعمال شد. برای ذخیره، دکمه ذخیره را بزنید.');
  };

  const cancelTranslation = () => {
    setTranslatePreview(null);
    showToast('ترجمه لغو شد — هیچ تغییری اعمال نشد.');
  };

  const handleAutoFetch = async () => {
    if (!fetchUrl) {
      showToast(t('add.autoFetchNoUrl'));
      return;
    }
    setFetching(true);
    try {
      const res = await fetch('/api/fetch-show-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: fetchUrl }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(`خطا: ${data.error || 'دریافت اطلاعات ناموفق بود'}`);
        return;
      }

      const info = data.info || {};
      if (editingShow) {
        // Editing an existing program from an external page is image-only.
        // Existing curated metadata must never be replaced by imported text.
        if (!info.image || typeof info.image !== 'string') {
          showToast('از این لینک تصویر قابل دریافت نبود؛ اطلاعات فعلی برنامه بدون تغییر ماند.');
          return;
        }
        const existingImages = Array.isArray(form.images) ? form.images : [];
        if (existingImages.includes(info.image)) {
          showToast('این تصویر قبلاً به برنامه اضافه شده است.');
          return;
        }
        if (existingImages.length >= 8) {
          showToast('حداکثر ۸ تصویر برای هر برنامه قابل ثبت است.');
          return;
        }
        setForm({ ...form, images: [...existingImages, info.image] });
        showToast('تصویر اضافه شد؛ سایر اطلاعات برنامه بدون تغییر ماند.');
        return;
      }

      // On creation, fill available fields without overwriting user-entered data.
      const updated = { ...form };
      if (info.title && !updated.name) updated.name = info.title;
      if (info.description && !updated.descriptionFa) {
        updated.descriptionFa = info.description;
        if (!updated.summary) updated.summary = info.description.substring(0, 200);
      }
      if (info.image) {
        const existingImages = updated.images || [];
        if (!existingImages.includes(info.image) && existingImages.length < 8) {
          updated.images = [...existingImages, info.image];
        }
      }
      if (info.country && !updated.country) updated.country = info.country;
      if (info.imdbUrl && !updated.imdb) updated.imdb = info.imdbUrl;
      if (info.wikiUrl && !updated.wikipedia) updated.wikipedia = info.wikiUrl;
      try {
        const sourceUrl = new URL(fetchUrl);
        const sourceHost = sourceUrl.hostname.toLowerCase();
        if (!updated.imdb && (sourceHost === 'imdb.com' || sourceHost.endsWith('.imdb.com'))) updated.imdb = sourceUrl.href;
        if (!updated.wikipedia && (sourceHost === 'wikipedia.org' || sourceHost.endsWith('.wikipedia.org'))) updated.wikipedia = sourceUrl.href;
      } catch {
        // The API validates source URLs; do not persist malformed fallback values.
      }
      if (updated.name && !updated.youtube) {
        updated.youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(updated.name)}`;
      }
      if (updated.name && !updated.socialPost) {
        updated.socialPost = `🎬 ${updated.name}\n\n📝 ${updated.descriptionFa || ''}\n\n#بانک_رسانه #تاک_شو`;
      }
      setForm(updated);
      showToast(t('add.autoFetchSuccess'));
    } catch (error) {
      console.error('[show-import] failed:', error);
      showToast(t('add.autoFetchError'));
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      showToast(t('add.field.required'));
      return;
    }

    // Prevent duplicate entries regardless of whether the admin used an
    // IMDb/Wikipedia import or entered the record manually. Compare normalized
    // Persian/Arabic titles and stable IMDb title IDs; exclude the record being
    // edited so ordinary edits are never blocked.
    const normalizeShowName = (value: string) => value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[ۀة]/g, 'ه')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u200c\u200d\uFEFF]/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const imdbId = (value?: string) => value?.match(/\btt\d+\b/i)?.[0]?.toLowerCase() || '';
    const candidateName = normalizeShowName(form.name);
    const candidateImdb = imdbId(form.imdb || '') || imdbId(fetchUrl);
    const duplicate = talkShows.find(existing => {
      if (editingShow && existing.num === editingShow.num) return false;
      const sameName = normalizeShowName(existing.name) === candidateName;
      const existingImdb = imdbId(existing.imdb);
      return sameName || (!!candidateImdb && !!existingImdb && candidateImdb === existingImdb);
    });
    if (duplicate) {
      const mainGenre = duplicate.category?.split('|').map(value => value.trim()).filter(Boolean)[0] || 'نامشخص';
      showToast(`این برنامه قبلاً در آرشیو ثبت شده است؛ ژانر اصلی: «${mainGenre}». ثبت مجدد امکان‌پذیر نیست.`);
      return;
    }

    // Create a clean copy — never mutate state directly.
    const finalForm = { ...form };

    // Auto-generate links if not set
    if (!finalForm.youtube && finalForm.name) {
      finalForm.youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(finalForm.name)}`;
    }
    if (!finalForm.imdb && finalForm.name) {
      finalForm.imdb = `https://www.imdb.com/find?q=${encodeURIComponent(finalForm.name)}`;
    }
    if (!finalForm.wikipedia && finalForm.name) {
      finalForm.wikipedia = `https://fa.wikipedia.org/w/index.php?search=${encodeURIComponent(finalForm.name)}`;
    }
    if (!finalForm.descriptionFa) {
      finalForm.descriptionFa = 'برنامهٔ گفتگومی تلویزیونی با مصاحبه، بحث و بررسی موضوعات متنوع.';
    }
    if (!finalForm.socialPost) {
      finalForm.socialPost = `🎬 ${finalForm.name}

📝 ${finalForm.descriptionFa}

#بانک_رسانه #تاک‌شو`;
    }
    // Ensure images and tags arrays exist
    if (!finalForm.images) finalForm.images = [];
    if (!finalForm.tags) finalForm.tags = [];

    // Update state with the final form
    setForm(finalForm);

    try {
      if (editingShow) await onSave(finalForm as TalkShow, true);
      else await onSave(finalForm as TalkShow, false);
      onDone();
    } catch {
      // The parent displays the server error; keep the form open for correction.
    }
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#f0fdf4' }}>
          {editingShow ? 'ویرایش برنامه' : 'افزودن برنامهٔ جدید'}
        </h1>
        <p style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          {editingShow ? `ویرایش برنامهٔ شمارهٔ ${editingShow.num.toLocaleString('fa-IR')}` : 'فرم زیر را پر کنید'}
        </p>
      </header>

      <div className="premium-glass p-6 space-y-4">
        {/* Auto-fetch from IMDb/Wikipedia */}
        <div className="p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)' }}>
          <h4 className="font-bold mb-2" style={{ color: '#f0fdf4' }}>⚡ دریافت خودکار اطلاعات</h4>
          <p className="text-xs mb-3" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            لینک IMDb یا ویکی‌پدیا برنامه را وارد کنید تا نام، توضیحات، تصویر و سایر اطلاعات خودکار دریافت شود.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              placeholder="https://www.imdb.com/title/... یا https://fa.wikipedia.org/..."
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74,0.15)',
                background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#f0fdf4',
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
              {fetching ? '⏳ در حال دریافت...' : '⚡ دریافت'}
            </button>
          </div>
        </div>

        {/* 🌐 Translate to Persian — server-side LLM translation.
            Shows a preview before applying. Original title, URLs, and other
            protected fields are preserved by the API. */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)' }}
        >
          <h4 className="font-bold mb-2" style={{ color: '#f0fdf4' }}>🌐 ترجمه هوشمند به فارسی</h4>
          <p className="text-xs mb-3" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            توضیحات، خلاصه و سایر فیلدهای متنی برنامه به فارسی روان ترجمه می‌شوند. عنوان اصلی و لینک‌ها تغییر نمی‌کنند. نتیجه را قبل از ذخیره بررسی می‌کنید.
          </p>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="btn-enter-premium"
            style={{ padding: '10px 24px', fontSize: '14px', whiteSpace: 'nowrap' }}
          >
            {translating ? '⏳ در حال ترجمه...' : '🌐 ترجمه به فارسی'}
          </button>

          {/* Preview dialog — shown after translation completes */}
          {translatePreview && (
            <div
              className="mt-4 p-4 rounded-xl"
              style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(99, 102, 241, 0.4)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-bold text-sm" style={{ color: '#c7d2fe' }}>
                  📝 پیش‌نمایش ترجمه ({Object.keys(translatePreview).length} فیلد)
                </h5>
                <div className="flex gap-2">
                  <button
                    onClick={cancelTranslation}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#f0fdf4' }}
                  >
                    لغو
                  </button>
                  <button
                    onClick={applyTranslation}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{ background: 'rgba(99, 102, 241, 0.8)', color: 'white' }}
                  >
                    ✓ اعمال ترجمه
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(translatePreview).map(([field, translated]) => {
                  const original = (form as Record<string, unknown>)[field];
                  const fieldName = field === 'summary' ? 'خلاصه' :
                                    field === 'descriptionFa' ? 'توضیحات فارسی' :
                                    field === 'elements' ? 'عناصر' :
                                    field === 'materials' ? 'مواد' :
                                    field === 'colors' ? 'رنگ‌ها' :
                                    field === 'lighting' ? 'نورپردازی' :
                                    field === 'layout' ? 'چیدمان' :
                                    field === 'style' ? 'سبک' :
                                    field === 'effects' ? 'افکت‌ها' :
                                    field === 'viewers' ? 'تماشاگران' :
                                    field === 'size' ? 'سایز' : field;
                  return (
                    <div key={field} className="p-2 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      <div className="text-xs font-bold mb-1" style={{ color: '#a5b4fc' }}>{fieldName}</div>
                      <div className="text-xs mb-1" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
                        <span className="opacity-60">اصلی:</span> {String(original || '').substring(0, 80)}{String(original || '').length > 80 ? '...' : ''}
                      </div>
                      <div className="text-xs" style={{ color: '#f0fdf4' }}>
                        <span className="opacity-60">ترجمه:</span> {translated.substring(0, 80)}{translated.length > 80 ? '...' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <FormField label="نام برنامه *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} placeholder="مثلاً: BBC Breakfast" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="دسته‌بندی"
            value={form.category || ''}
            onChange={v => setForm({ ...form, category: v })}
            options={genres.map(g => ({ value: g.nameFa, label: g.nameFa }))}
          />
          <FormField label="کشور مبدا" value={form.country || ''} onChange={v => setForm({ ...form, country: v })} placeholder="مثلاً: ایران، ترکیه" />
          <label className="flex items-center gap-3 rounded-xl p-3 sm:col-span-2" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(255,255,255,0.22)', color: '#f0fdf4', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.decorIncluded ?? (editingShow ? hasDecor(editingShow) : false)} onChange={e => setForm({ ...form, decorIncluded: e.target.checked })} />
            <span><strong>قرار دادن در ژانر «دکور برنامه‌ها»</strong><span className="block text-xs opacity-75 mt-1">فقط با انتخاب این گزینه، برنامه در بخش دکور نمایش داده می‌شود.</span></span>
          </label>

          <FormSelect
            label="اندازهٔ استودیو"
            value={form.size || ''}
            onChange={v => setForm({ ...form, size: v })}
            options={[
              { value: 'بزرگ/لوکس', label: 'بزرگ/لوکس' },
              { value: 'متوسط/استاندارد', label: 'متوسط/استاندارد' },
              { value: 'کوچک/اقتصادی', label: 'کوچک/اقتصادی' },
            ]}
          />
          <FormSelect
            label="تماشاگر"
            value={form.viewers || ''}
            onChange={v => setForm({ ...form, viewers: v })}
            options={[
              { value: 'با تماشاگر', label: 'با تماشاگر' },
              { value: 'بدون تماشاگر', label: 'بدون تماشاگر' },
              { value: 'نامشخص', label: 'نامشخص' },
            ]}
          />
          <FormSelect
            label="سبک دکور"
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
            label="نورپردازی"
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

        <FormField label="عناصر دکور" value={form.elements || ''} onChange={v => setForm({ ...form, elements: v })} placeholder="مثلاً: plants, screens/monitors" />
        <FormField label="مواد" value={form.materials || ''} onChange={v => setForm({ ...form, materials: v })} placeholder="مثلاً: wood, glass, metal" />
        <FormField label="رنگ‌آمیزی" value={form.colors || ''} onChange={v => setForm({ ...form, colors: v })} placeholder="مثلاً: red, blue, white" />

        {/* Persian description */}
        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>دربارهٔ برنامه (فارسی)</label>
          <textarea
            value={form.descriptionFa || ''}
            onChange={(e) => setForm({ ...form, descriptionFa: e.target.value })}
            placeholder="توضیحات فارسی دربارهٔ برنامه — چه برنامه‌ای است، چه محتوایی دارد..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(13, 124, 74, 0.15)',
              background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: '#f0fdf4',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>خلاصهٔ دکور</label>
          <textarea
            value={form.summary || ''}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="توضیحات کامل دکور و صحنهٔ برنامه..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(13, 124, 74, 0.15)',
              background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: '#f0fdf4',
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
        />

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            className="btn-enter-premium"
            style={{ padding: '12px 32px', fontSize: '15px' }}
          >
            {editingShow ? '✓ بروزرسانی' : '+ افزودن برنامه'}
          </button>
          <button
            onClick={() => { setEditingShow(null); onDone(); }}
            className="px-6 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(107, 143, 122, 0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122, 0.3)' }}
          >
            انصراف
          </button>
        </div>
      </div>
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
      <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>{label}</label>
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
          background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: '#f0fdf4',
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
      <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(13, 124, 74, 0.15)',
          background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: '#f0fdf4',
          colorScheme: 'dark',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#07372f', color: '#f0fdf4' }}>{o.label}</option>
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
  const [urlInput, setUrlInput] = useState('');
  const [failedUrls, setFailedUrls] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to the latest images array so async FileReader callbacks always see current state
  const imagesRef = useRef<string[]>(images);
  // eslint-disable-next-line react-hooks/refs -- Async FileReader callbacks need the latest render's image list.
  imagesRef.current = images;
  const MAX_IMAGES = 8;

  // Heuristic: detect whether a URL points to a direct image file (vs. an HTML
  // page like a Wikipedia article URL). The user often pastes a Wikipedia/
  // IMDb article URL expecting auto-extraction — warn them to use the
  // "دریافت خودکار" box above for that, or to paste a direct image link here.
  function looksLikeDirectImage(url: string): boolean {
    const u = url.toLowerCase();
    // data: URLs are always valid images (base64-encoded).
    if (u.startsWith('data:image/')) return true;
    // Direct image extensions in the path (before any query/hash).
    try {
      const path = new URL(url).pathname.toLowerCase();
      if (/\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?|#|$)/.test(path)) return true;
    } catch {}
    // Known image hosts that serve images directly even without extension.
    if (/upload\.wikimedia\.org|\.wikimedia\.org|\.wpimg\.cn|\.imdb-img|m\.media-amazon\.com/.test(u)) return true;
    return false;
  }

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (images.length >= MAX_IMAGES) {
      showToast(`حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')} تصویر مجاز است`);
      return;
    }
    if (images.includes(trimmed)) {
      showToast('این تصویر قبلاً اضافه شده');
      return;
    }
    // Warn (but still allow) if the URL doesn't look like a direct image.
    // Many users paste a Wikipedia article URL here expecting the system to
    // extract the cover image (which is what the auto-fetch box above does).
    if (!looksLikeDirectImage(trimmed)) {
      showToast('⚠ این لینک مستقیم تصویر نیست — برای استخراج از صفحهٔ ویکی‌پدیا/IMDb از کادر «دریافت خودکار اطلاعات» بالاتر استفاده کنید. با این حال لینک اضافه شد؛ در صورت نمایش‌نشدن، آدرس تصویر مستقیم را بچسبانید.');
    } else {
      showToast(`✓ تصویر اضافه شد (${(images.length + 1).toLocaleString('fa-IR')} از ${MAX_IMAGES.toLocaleString('fa-IR')})`);
    }
    onChange([...images, trimmed]);
    setUrlInput('');
  };

  const compressImageFile = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('فایل انتخاب‌شده تصویر نیست');
    if (file.size > 25 * 1024 * 1024) throw new Error('حجم تصویر اولیه نباید بیشتر از ۲۵ مگابایت باشد');

    // createImageBitmap applies EXIF orientation where supported. The scale
    // calculation preserves the original aspect ratio; no stretching/cropping.
    const bitmap = await createImageBitmap(file);
    try {
      const maxWidth = 1200;
      const maxHeight = 1800;
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('امکان پردازش تصویر وجود ندارد');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);

      const encode = (type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تبدیل تصویر ناموفق بود')), type, quality);
      });
      let output = await encode('image/webp', 0.84);
      let mime = output.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      if (output.size > 1.2 * 1024 * 1024) {
        output = await encode(mime, 0.74);
      }
      if (output.size > 1.8 * 1024 * 1024) {
        output = await encode(mime, 0.66);
      }
      if (output.size > 2.5 * 1024 * 1024) {
        throw new Error('حجم تصویر پس از فشرده‌سازی هنوز زیاد است؛ تصویر کوچک‌تری انتخاب کنید');
      }
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('خواندن تصویر ناموفق بود'));
        reader.onerror = () => reject(new Error('خواندن تصویر ناموفق بود'));
        reader.readAsDataURL(output);
      });
    } finally {
      bitmap.close();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const remaining = Math.max(0, MAX_IMAGES - imagesRef.current.length);
    const toAdd = fileArr.slice(0, remaining);
    if (toAdd.length < fileArr.length) {
      showToast(`فقط ${toAdd.length.toLocaleString('fa-IR')} تصویر اضافه می‌شود (حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')})`);
    }

    // Process sequentially so order is deterministic and memory use stays low.
    for (const file of toAdd) {
      try {
        const result = await compressImageFile(file);
        const current = imagesRef.current;
        if (current.length < MAX_IMAGES && !current.includes(result)) {
          onChange([...current, result]);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : `خطا در پردازش تصویر: ${file.name}`);
      }
    }
    showToast('تصاویر بهینه شدند؛ نسبت تصویر حفظ شده و حجم فایل کاهش یافته است.');
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
        <h4 className="font-bold" style={{ color: '#f0fdf4' }}>
          🖼 تصاویر برنامه
          <span className="text-xs font-normal mr-2" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            ({images.length.toLocaleString('fa-IR')} از {MAX_IMAGES.toLocaleString('fa-IR')})
          </span>
        </h4>
        {images.length > 0 && (
          <span className="text-xs" style={{ color: '#54D9C0' }}>تصویر اول = کاور</span>
        )}
      </div>

      {/* URL input + file upload */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          placeholder="لینک مستقیم تصویر (مثلاً ...jpg یا png) را اینجا بچسبانید..."
          disabled={images.length >= MAX_IMAGES}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(13, 124, 74,0.25)',
            // Use a SOLID white background so the typed URL is clearly visible.
            // The previous semi-transparent 0.8 alpha over the dark premium-glass
            // produced a near-white background that competed with the #f0fdf4
            // light text → made the typed URL nearly invisible (user reported
            // "با لینک عکس رو اضافه نمیکنه اصلا" because they couldn't see what
            // they pasted).
            background: images.length >= MAX_IMAGES ? 'rgba(220, 230, 220, 0.85)' : 'rgb(255, 255, 255)',
            // DARK text on white background for maximum readability of the URL.
            color: '#0d2818',
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            fontSize: '13px',
            fontWeight: 500,
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
          + افزودن لینک
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
          📁 آپلود فایل
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
          <p className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            هنوز تصویری اضافه نشده. می‌تونید لینک بچسبانید یا فایل آپلود کنید.
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
                onLoad={() => {
                  // Image loaded successfully — clear any previous failure flag.
                  setFailedUrls((prev) => {
                    if (!prev.has(idx)) return prev;
                    const next = new Set(prev);
                    next.delete(idx);
                    return next;
                  });
                }}
                onError={(e) => {
                  // Image failed to load. Show a clear "broken image" indicator
                  // instead of just dimming the broken <img> — the previous
                  // opacity:0.3 made the slot look like an empty placeholder,
                  // which is why users thought "nothing was added".
                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                  setFailedUrls((prev) => new Set(prev).add(idx));
                }}
              />
              {/* Broken-image overlay — only shown when this specific slot
                  failed to load. Displays the URL snippet so the user can see
                  WHAT link failed (and copy/fix it). */}
              {failedUrls.has(idx) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center"
                  style={{ background: 'rgba(127, 29, 29, 0.85)', color: '#fee2e2' }}
                  dir="ltr"
                >
                  <div className="text-2xl mb-1">⚠️</div>
                  <div className="text-[10px] font-bold mb-1" dir="rtl">تصویر بارگذاری نشد</div>
                  <div className="text-[9px] font-mono opacity-80 break-all line-clamp-2" title={img}>
                    {img.length > 40 ? img.slice(0, 40) + '…' : img}
                  </div>
                </div>
              )}
              {/* Cover badge */}
              {idx === 0 && (
                <span
                  className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded-md font-bold"
                  style={{ background: '#10b981', color: 'white' }}
                >
                  کاور
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
                  title="به چپ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => removeImage(idx)}
                  className="p-1.5 rounded-lg"
                  style={{ background: 'rgba(220,38,38,0.9)', color: 'white' }}
                  title="حذف"
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
                  title="به راست"
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
                color: '#54D9C0',
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
// LOCAL VIDEO CLIP EDITOR — browser-native trim/transcode, max 30 seconds
// ============================================
function VideoClipEditor({ onAdd }: { onAdd: (dataUrl: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const chooseFile = (next: File | null) => {
    setError('');
    if (!next) return;
    if (!next.type.startsWith('video/')) { setError('لطفاً یک فایل ویدیویی انتخاب کنید.'); return; }
    if (next.size > 200 * 1024 * 1024) { setError('حجم فایل ورودی نباید بیشتر از ۲۰۰ مگابایت باشد.'); return; }
    setPreviewUrl(URL.createObjectURL(next));
    setFile(next);
  };

  const formatTime = (value: number) => {
    const n = Math.max(0, Math.floor(value || 0));
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  };

  const exportClip = async () => {
    const video = videoRef.current;
    if (!video || !previewUrl || busy) return;
    const clipLength = end - start;
    if (!(clipLength > 0) || clipLength > 30.001) {
      setError('مدت کلیپ باید بیشتر از صفر و حداکثر ۳۰ ثانیه باشد.');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || typeof video.captureStream !== 'function') {
      setError('ویرایش و خروجی ویدیو در این نسخه از مرورگر پشتیبانی نمی‌شود.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      video.pause();
      video.currentTime = start;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('بارگذاری فریم ویدیو بیش از حد طول کشید.')), 10000);
        video.onseeked = () => { window.clearTimeout(timeout); resolve(); };
        video.onerror = () => { window.clearTimeout(timeout); reject(new Error('خواندن فایل ویدیو ناموفق بود.')); };
      });
      const stream = video.captureStream();
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('کدک WebM در این سیستم پشتیبانی نمی‌شود.');
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1000000,
        audioBitsPerSecond: 96000,
      });
      const chunks: BlobPart[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('پردازش ویدیو با خطا متوقف شد.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      recorder.start(250);
      await video.play();
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
          resolve();
        }, Math.ceil(clipLength * 1000) + 1200);
        const check = () => {
          if (video.currentTime >= end || video.ended) {
            window.clearTimeout(timer);
            video.pause();
            if (recorder.state !== 'inactive') recorder.stop();
            resolve();
          }
        };
        video.addEventListener('timeupdate', check);
        video.addEventListener('ended', check, { once: true });
        recorder.addEventListener('stop', () => {
          window.clearTimeout(timer);
          video.removeEventListener('timeupdate', check);
        }, { once: true });
      });
      const blob = await finished;
      stream.getTracks().forEach(track => track.stop());
      if (!blob.size) throw new Error('فایل خروجی خالی است؛ دوباره تلاش کنید.');
      if (blob.size > 8 * 1024 * 1024) throw new Error('حجم خروجی بیش از ۸ مگابایت شد. بازه کوتاه‌تری انتخاب کنید یا فایل سبک‌تری بدهید.');
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('ذخیره فایل پردازش‌شده ناموفق بود.'));
        reader.readAsDataURL(blob);
      });
      onAdd(dataUrl);
      setFile(null);
      setPreviewUrl('');
      setDuration(0);
      setStart(0);
      setEnd(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پردازش ویدیو ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <strong className="text-sm" style={{ color: '#d1fae5' }}>✂️ ویرایش ویدیو از سیستم (حداکثر ۳۰ ثانیه)</strong>
        <label className="px-3 py-2 rounded-lg text-xs font-bold cursor-pointer" style={{ background: '#0d7c4a', color: 'white' }}>
          انتخاب فایل ویدیو
          <input type="file" accept="video/*" onChange={e => chooseFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
        </label>
      </div>
      {file && previewUrl && (
        <div className="space-y-3">
          <video ref={videoRef} src={previewUrl} controls playsInline preload="metadata" onLoadedMetadata={e => {
            const d = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
            setDuration(d); setStart(0); setEnd(Math.min(30, d));
          }} style={{ width: '100%', maxHeight: 260, borderRadius: 10, background: '#000', objectFit: 'contain' }} />
          <div className="text-xs" style={{ color: '#d1fae5' }}>
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB · مدت اصلی {formatTime(duration)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: '#d1fae5' }}>شروع: {formatTime(start)}
              <input type="range" min={0} max={Math.max(0, duration)} step={0.1} value={start} onChange={e => {
                const value = Number(e.target.value); setStart(value); if (end - value > 30) setEnd(value + 30); if (value >= end) setEnd(Math.min(duration, value + 1));
              }} className="w-full" />
            </label>
            <label className="text-xs" style={{ color: '#d1fae5' }}>پایان: {formatTime(end)}
              <input type="range" min={0} max={Math.max(0, duration)} step={0.1} value={end} onChange={e => setEnd(Number(e.target.value))} className="w-full" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: end > start && end - start <= 30 ? '#6ee7b7' : '#fca5a5' }}>مدت خروجی: {formatTime(end - start)} / ۰۰:۳۰</span>
            <button type="button" onClick={exportClip} disabled={busy || end <= start || end - start > 30} className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: '#059669', color: 'white' }}>
              {busy ? 'در حال پردازش ویدیو…' : 'پردازش و افزودن کلیپ'}
            </button>
            <button type="button" onClick={() => { setFile(null); setPreviewUrl(''); setError(''); }} disabled={busy} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,.12)', color: '#d1fae5' }}>انصراف</button>
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(209,250,229,.75)' }}>خروجی WebM با حفظ نسبت تصویر و نرخ بیت کنترل‌شده ساخته می‌شود؛ فایل اصلی تغییر نمی‌کند. حداکثر حجم خروجی ۸ مگابایت است.</p>
        </div>
      )}
      {error && <p role="alert" className="text-xs mt-2" style={{ color: '#fca5a5' }}>{error}</p>}
    </div>
  );
}

// ============================================
// VIDEO LINKS EDITOR — multiple video URLs per show
// ============================================
function VideoLinksEditor({ videos, youtube, onVideosChange, onYoutubeChange }: {
  videos: string[];
  youtube: string;
  onVideosChange: (vids: string[]) => void;
  onYoutubeChange: (url: string) => void;
}) {
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
      <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>
        🎬 ویدیوهای برنامه
        <span className="text-xs font-normal mr-2" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          ({videos.length.toLocaleString('fa-IR')} ویدیو)
        </span>
      </h4>

      {/* Main YouTube search link field (auto-generated) */}
      <div className="mb-3">
        <label className="text-xs font-bold mb-1 block" style={{ color: '#99f6e4' }}>لینک جستجوی یوتیوب (خودکار)</label>
        <input
          type="text"
          value={youtube}
          onChange={(e) => onYoutubeChange(e.target.value)}
          placeholder="https://www.youtube.com/results?search_query=..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(13, 124, 74,0.15)',
            background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            color: '#f0fdf4',
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            fontSize: '12px',
          }}
        />
      </div>

      <VideoClipEditor onAdd={(dataUrl) => onVideosChange([...videos, dataUrl])} />

      {/* Add video URL */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())}
          placeholder="لینک ویدیو (یوتیوب، آپارات، Vimeo، تلگرام و...) را بچسبانید"
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(13, 124, 74,0.15)',
            background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            color: '#f0fdf4',
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
          + افزودن ویدیو
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
                style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(13, 124, 74, 0.1)' }}
              >
                {/* Thumbnail or icon */}
                <div
                  className="w-16 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: thumb ? '#000' : `${platform.color}20` }}
                >
                  {url.startsWith('data:video/') ? (
                    <video src={url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : thumb ? (
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
                    style={{ color: 'rgba(255, 255, 255, 0.9)', direction: 'ltr', textAlign: 'left' }}
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
                  style={{ background: 'rgba(13, 124, 74,0.1)', color: '#54D9C0' }}
                  title="باز کردن"
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
                  title="حذف"
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
  const [input, setInput] = useState('');

  const commit = (next: string[]) => {
    // De-duplicate + trim. Empty strings are dropped.
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const t of next) {
      const s = (t || '').trim();
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

  const togglePreset = (t: string) => {
    const exists = tags.some(x => x.toLowerCase() === t.toLowerCase());
    if (exists) {
      onChange(tags.filter(x => x.toLowerCase() !== t.toLowerCase()));
    } else {
      commit([...tags, t]);
    }
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
      <h4 className="font-bold mb-2" style={{ color: '#f0fdf4' }}>
        🏷 برچسب‌ها
        <span className="text-xs font-normal mr-2" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          ({tags.length.toLocaleString('fa-IR')} برچسب)
        </span>
      </h4>
      <p className="text-xs mb-3" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
        برچسب‌ها را با کاما (، یا ,) جدا کنید — مثلاً: مدرن، گرم، چوبی
      </p>

      {/* Comma-separated input + Add button */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(); } }}
          placeholder="مدرن، گرم، چوبی..."
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            color: '#f0fdf4',
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
          + افزودن
        </button>
      </div>

      {/* Removable pill list */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {tags.map((t, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1"
              style={{ background: 'rgba(124, 58, 237, 0.18)', color: '#6d28d9', border: '1px solid rgba(124, 58, 237, 0.3)' }}
            >
              #{t}
              <button
                onClick={() => removeTag(i)}
                aria-label={`حذف ${t}`}
                className="hover:opacity-70"
                style={{ color: '#7c3aed', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                title="حذف"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs px-2 py-1 rounded-md font-medium"
            style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.25)' }}
            title="پاک کردن همه"
          >
            پاک کردن همه
          </button>
        </div>
      )}

      {/* Preset quick-add buttons (from the genre's presetTags) */}
      {presetTags && presetTags.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: '#99f6e4' }}>برچسب‌های پیشنهادی این ژانر:</div>
          <div className="flex items-center gap-2 flex-wrap">
            {presetTags.map(t => {
              const selected = tags.some(x => x.toLowerCase() === t.toLowerCase());
              return (
                <button
                  key={t}
                  onClick={() => togglePreset(t)}
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
                  {selected ? '✓ ' : '+ '}{t}
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
  '#10b981', '#10b981', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0d7c4a',
];

function AddGenreModal({ onClose, onSave, editingGenre }: {
  onClose: () => void;
  onSave: (g: Genre) => void;
  editingGenre?: Genre | null;
}) {
  useEscapeKey(onClose);
  const isEditing = !!editingGenre;
  const [name, setName] = useState(editingGenre?.nameFa ?? '');
  const [description, setDescription] = useState(editingGenre?.description ?? '');
  const [color, setColor] = useState(editingGenre?.color ?? GENRE_COLOR_PRESETS[0]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = editingGenre?.id ?? ('custom-' + Date.now().toString(36));
    const g: Genre = {
      id,
      key: editingGenre?.key ?? id,
      nameFa: trimmed,
      name: trimmed,
      color,
      description: description.trim() || '',
      filterFn: (s: TalkShow) => s.category.includes(trimmed),
      isCustom: true,
      tags: editingGenre?.tags ?? DEFAULT_GENRE_TAGS,
      presetTags: editingGenre?.presetTags ?? [],
      searchFields: editingGenre?.searchFields ?? (['name', 'summary', 'category', 'descriptionFa'] as (keyof TalkShow)[]),
    };
    onSave(g);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#f0fdf4' }}>{isEditing ? '✏️ ویرایش ژانر' : '+ افزودن ژانر جدید'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>نام ژانر *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: مستند، انیمیشن، کودک..."
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74, 0.15)',
                background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#f0fdf4',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه دربارهٔ این ژانر..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 124, 74, 0.15)',
                background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#f0fdf4',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>رنگ ژانر</label>
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
            <div className="text-xs font-bold mb-1" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>پیش‌نمایش:</div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              ></span>
              <strong style={{ color: '#f0fdf4' }}>{name || '—'}</strong>
            </div>
            <p className="text-xs mt-1" style={{ color: '#99f6e4' }}>{description || 'توضیحات...'}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-enter-premium flex-1"
              style={{ opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
            >
              ✓ {isEditing ? 'به‌روزرسانی ژانر' : 'ذخیره ژانر'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122,0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122,0.3)' }}
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DELETE GENRE CONFIRM — confirms removal of a custom genre
// ============================================
function DeleteGenreConfirm({ genre, count, onClose, onConfirm }: {
  genre: Genre;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.4)' }}
          >
            <svg className="w-7 h-7" style={{ color: '#fca5a5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#f0fdf4' }}>حذف ژانر</h2>
          <p className="text-sm mb-1" style={{ color: 'rgba(244, 255, 255, 0.8)' }}>
            آیا از حذف ژانر «<strong style={{ color: genre.color }}>{genre.nameFa}</strong>» مطمئن هستید؟
          </p>
          <p className="text-xs mb-6" style={{ color: 'rgba(244, 255, 255, 0.6)' }}>
            این ژانر {count > 0 ? `${count.toLocaleString('fa-IR')} برنامه` : 'هیچ برنامه‌ای'} را در بر می‌گیرد. حذف ژانر، خود برنامه‌ها را پاک نمی‌کند.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
                color: '#ffffff',
                border: '1px solid rgba(220, 38, 38, 0.5)',
                boxShadow: '0 4px 14px rgba(185, 28, 28, 0.4)',
              }}
            >
              ✓ بله، حذف شود
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122, 0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122, 0.3)' }}
            >
              انصراف
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
  const { t, lang } = useLang();
  useEscapeKey(onClose);
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
          <h2 className="text-xl font-bold" style={{ color: '#f0fdf4' }}>📱 انتشار در شبکه‌های اجتماعی</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform selection */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>انتخاب پلتفرم</h4>
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
            <h4 className="font-bold mb-3" style={{ color: '#f0fdf4' }}>پیش‌نمایش پست</h4>
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
                  background: 'rgba(255, 255, 255, 0.10)',
                  color: '#f0fdf4',
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
                    <div className="text-sm font-bold" style={{ color: '#f0fdf4' }}>📡 ارسال مستقیم به {selectedPlatform}</div>
                    <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
                      {botConfig
                        ? `ربات ${botConfig.platform === 'telegram' ? 'تلگرام' : 'بله'} پیکربندی شده — مقصد: ${botConfig.chatId}`
                        : 'برای ارسال مستقیم، ابتدا توکن ربات و شناسهٔ کانال را وارد کنید'}
                    </div>
                  </div>
                  <button
                    onClick={onOpenBotConfig}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{ background: 'rgba(13, 124, 74,0.12)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74,0.3)' }}
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
                style={{ background: 'rgba(107, 143, 122,0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122,0.3)' }}
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
  const { t } = useLang();
  useEscapeKey(onClose);
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
      // SECURITY: previously this used a GET request with the token in the
      // query string (?token=...), which leaks the bot token into server
      // access logs, browser history, and any proxy in between. Now we
      // send the token in the POST body (encrypted in transit via HTTPS)
      // and use the {verify:true} flag to tell the backend to just validate
      // the token, not send a message.
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('bankresaneh_token') : '';
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
        },
        body: JSON.stringify({ platform, token, verify: true }),
      });
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
          <h2 className="text-xl font-bold" style={{ color: '#f0fdf4' }}>⚙ تنظیمات ربات انتشار</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Intro help */}
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)', color: '#99f6e4' }}>
            برای ارسال مستقیم پست‌ها به کانال یا گروه، یک ربات بسازید و آن را ادمین مقصد کنید:
            <ul className="mt-2 space-y-1 text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
              <li>• تلگرام: ربات <code style={{ direction: 'ltr' }}>@BotFather</code> → /newbot</li>
              <li>• بله: ربات <code style={{ direction: 'ltr' }}>@BotFather@</code> → ساخت ربات جدید</li>
              <li>• سپس ربات را به کانال/گروه ادمین کنید</li>
            </ul>
          </div>

          {/* Platform picker */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>پلتفرم</label>
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
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>توکن ربات (Bot Token)</label>
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
                  background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  color: '#f0fdf4',
                  fontFamily: 'monospace',
                  outline: 'none',
                  textAlign: 'left',
                }}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="px-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(107, 143, 122,0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122,0.3)' }}
              >
                {showToken ? '🙈 پنهان' : '👁 نمایش'}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#f0fdf4' }}>شناسهٔ مقصد (Chat ID)</label>
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
                background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#f0fdf4',
                fontFamily: 'monospace',
                outline: 'none',
                textAlign: 'left',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
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
function ExportPreviewModal({ shows, format, onClose, onDownload, title, subtitle, organization }: {
  shows: TalkShow[];
  format: 'pdf' | 'excel';
  onClose: () => void;
  onDownload: () => void;
  title?: string;
  subtitle?: string;
  organization?: string;
}) {
  const { t, lang } = useLang();
  useEscapeKey(onClose);
  const [downloading, setDownloading] = useState(false);

  // Resolve the effective report metadata — caller-provided overrides win,
  // otherwise we fall back to the canonical defaults used by the API.
  const reportTitle = title || t('reports.report1Title');
  const reportSubtitle = subtitle || t('app.tagline');

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (format === 'pdf') {
        // Call API to generate professional PDF report — pass through any
        // caller-provided overrides so the rendered PDF matches the preview.
        const res = await fetch('/api/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ shows, title, subtitle, organization }),
        });
        if (res.ok) {
          const html = await res.text();
          // Open in new window for print-to-PDF
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            setTimeout(() => { w.print(); }, 1000);
          }
        }
      } else {
        // Excel: generate proper XLSX using SheetJS-style XML
        const headers = ['شماره', 'نام برنامه', 'دسته‌بندی', 'منبع', 'اندازه', 'تماشاگر', 'سبک', 'جلوه‌ها', 'چیدمان', 'عناصر', 'متریال', 'رنگ‌آمیزی', 'نورپردازی', 'توضیحات'];
        const rows = shows.map((s, i) => [
          i + 1,
          s.name,
          (s.category || '').replace(/^\d+\.\s*/, ''),
          s.source || '',
          s.size || '',
          s.viewers || '',
          s.style || '',
          s.effects || '',
          s.layout || '',
          s.elements || '',
          s.materials || '',
          s.colors || '',
          s.lighting || '',
          (s.descriptionFa || s.summary || '').substring(0, 500),
        ]);
        // Generate HTML table that Excel can open as .xls
        const htmlTable = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1"><tr>${headers.map(h => `<th style="background:#10b981;color:white;font-weight:bold;padding:8px;">${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px;border:1px solid #ddd;">${String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
        const blob = new Blob(['\ufeff' + htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bankresane-${Date.now()}.xls`;
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
          <h2 className="text-xl font-bold" style={{ color: '#f0fdf4' }}>
            {format === 'pdf' ? '📄 ' + t('export.previewPDF') : '📊 ' + t('export.previewExcel')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
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
                <div className="text-sm" style={{ color: '#99f6e4' }}>{t('export.programCount')}</div>
                <div className="text-2xl font-bold" style={{ color: '#54D9C0' }}>{shows.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#99f6e4' }}>{t('export.format')}</div>
                <div className="text-2xl font-bold" style={{ color: format === 'pdf' ? '#dc2626' : '#0d7c4a' }}>{format.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#99f6e4' }}>{t('export.date')}</div>
                <div className="text-2xl font-bold" style={{ color: '#f0fdf4' }}>{new Date().toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
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
                <div style={{ color: 'rgba(134, 239, 172, 0.6)', fontSize: '11px', letterSpacing: '4px', marginBottom: '12px' }}>{t('app.title')}</div>
                <div style={{ marginBottom: '10px', filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.5))' }}>
                  {/* Real program logo instead of a generic film/tv SVG icon. */}
                  <img
                    src="/banke-rasane-logo.png"
                    alt={t('app.title')}
                    style={{ width: '64px', height: 'auto', display: 'inline-block', borderRadius: '10px' }}
                  />
                </div>
                <h3 className="text-xl font-black mb-2" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>{reportTitle}</h3>
                <p className="text-xs" style={{ color: 'rgba(134, 239, 172, 0.8)' }}>{reportSubtitle}</p>
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
                  {lang === 'fa' ? 'ساختار گزارش (۸ بخش) — هر بخش شامل توضیحات کامل' : 'Report structure (8 sections) — each with full descriptions'}
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
                        style={{ background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', border: '1px solid rgba(255, 255, 255, 0.3)', color: 'white', boxShadow: '0 2px 6px rgba(13, 124, 74, 0.3)' }}
                      >
                        {s.n.toLocaleString('fa-IR')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{s.icon}</span>
                          <span className="text-xs font-bold" style={{ color: '#1a2e1a' }}>{s.t}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: '#4a5d52', fontSize: '10.5px' }}>
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample program card preview */}
              <div className="p-4" style={{ background: 'white', borderTop: '1px solid rgba(13, 124, 74, 0.3)' }}>
                <div className="text-xs font-bold mb-2" style={{ color: '#0d7c4a' }}>{lang === 'fa' ? 'نمونه کارت برنامه (از بخش ۶)' : 'Sample program card (from section 6)'}</div>
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
                      {shows[0]?.name || (lang === 'fa' ? 'نمونه برنامه' : 'Sample program')}
                    </span>
                    <span className="text-xs" style={{ color: '#4a5d52' }}>شناسه: ۱</span>
                  </div>
                  <div className="p-2 flex gap-2">
                    <div
                      className="w-12 h-9 rounded flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)' }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(13, 124, 74,0.1)', color: '#0d7c4a', fontSize: '9px' }}>
                          {shows[0]?.style || 'مدرن'}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(13, 124, 74,0.1)', color: '#0d7c4a', fontSize: '9px' }}>
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
                <div className="p-2 text-center text-xs" style={{ background: '#fef9e7', color: '#8a6d1a' }}>
                  در گزارش کامل، ۸۰ برنامهٔ نخست به‌صورت تفصیلی و همهٔ {shows.length.toLocaleString('fa-IR')} برنامه در نمایهٔ الفبایی
                </div>
              )}
            </div>
          )}

          {/* Excel preview */}
          {format === 'excel' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              <div className="p-3 text-center" style={{ background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', border: '1px solid rgba(255, 255, 255, 0.3)', color: 'white' }}>
                <div className="text-lg font-bold">بانک رسانه — خروجی Excel</div>
                <div className="text-xs opacity-80">{shows.length.toLocaleString('fa-IR')} برنامه</div>
              </div>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="w-full" style={{ fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f5efe0', zIndex: 1 }}>
                    <tr>
                      <th className="text-right p-2 font-bold" style={{ color: '#0d7c4a' }}>#</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#0d7c4a' }}>نام</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#0d7c4a' }}>دسته</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#0d7c4a' }}>سبک</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#0d7c4a' }}>اندازه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shows.slice(0, 50).map((s, i) => (
                      <tr key={s.num} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                        <td className="p-2" style={{ color: '#4a5d52' }}>{(i + 1).toLocaleString('fa-IR')}</td>
                        <td className="p-2 font-medium" style={{ color: '#1a2e1a', direction: 'ltr', textAlign: 'right' }}>{s.name}</td>
                        <td className="p-2" style={{ color: '#4a5d52' }}>{s.category.replace(/^\d+\.\s*/, '').substring(0, 20)}</td>
                        <td className="p-2" style={{ color: '#4a5d52' }}>{s.style}</td>
                        <td className="p-2" style={{ color: '#4a5d52' }}>{s.size}</td>
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
              {downloading ? t('common.loading') : `⬇ ${format === 'pdf' ? t('export.downloadPDF') : t('export.downloadExcel')}`}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122,0.15)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(107, 143, 122,0.3)' }}
            >
              {t('common.cancel')}
            </button>
          </div>
          {format === 'pdf' && (
            <p className="mt-3 text-xs text-center" style={{ color: 'rgba(244, 255, 255, 0.7)', lineHeight: 1.7 }}>
              گزارش شامل ۸ بخش است: صفحهٔ عنوان، فهرست مطالب، خلاصهٔ اجرایی، روش تحقیق، نمای آماری، تحلیل ژانرها، تحلیل دکور، و معرفی تفصیلی برنامه‌ها.<br />
              {lang === 'fa' ? 'پس از کلیک روی دانلود، پنجره چاپ باز می‌شود — مقاس «A4» و «Save as PDF» را انتخاب کنید.' : 'After clicking download, the print dialog opens — select A4 size and "Save as PDF".'}
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
  onExport: (shows: TalkShow[], format: 'pdf' | 'excel', meta?: { title?: string; subtitle?: string; organization?: string }) => void;
}) {
  const { t, lang } = useLang();
  const stats = {
    total: talkShows.length,
    text: talkShows.filter(s => s.source === 'متن').length,
    uploaded: uploadedShows.length,
    genres: new Set(talkShows.map(s => s.category)).size,
    withImages: talkShows.filter(s => s.images && s.images.length > 0).length,
  };

  // ---------- Report defaults (title/subtitle/organization) ----------
  // Loaded once from /api/settings/report so the admin can edit them once
  // and every subsequent PDF export picks them up automatically.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rTitle, setRTitle] = useState('');
  const [rSubtitle, setRSubtitle] = useState('');
  const [rOrg, setROrg] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);          // cache-buster for the logo <img>
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Load persisted report defaults once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings/report', { headers: { ...authHeaders() } });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setRTitle(data.title || '');
        setRSubtitle(data.subtitle || '');
        setROrg(data.organization || '');
      } catch { /* ignore — fields stay empty and the API falls back to its own defaults */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: rTitle, subtitle: rSubtitle, organization: rOrg }),
      });
      if (res.ok) {
        showToast(t('reports.settingsSaved'));
      } else {
        showToast(t('reports.settingsError'));
      }
    } catch {
      showToast('خطا در ارتباط با سرور');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // NOTE: no Content-Type here — the browser must set the multipart
      // boundary; we only attach the Bearer token.
      const res = await fetch('/api/settings/logo', { method: 'POST', headers: { ...authHeaders() }, body: fd });
      if (res.ok) {
        setLogoVersion(v => v + 1);    // force <img> to reload from new file
        showToast(t('reports.logoUpdated'));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || t('reports.logoUploadError'));
      }
    } catch {
      showToast('خطا در ارتباط با سرور');
    } finally {
      setUploadingLogo(false);
    }
  };

  const reports = [
    { id: 1, title: t('reports.report1Title'), type: 'pdf', count: stats.total, date: '۱۴۰۴/۰۸/۲۵' },
    { id: 2, title: t('reports.report2Title'), type: 'excel', count: stats.uploaded, date: '۱۴۰۴/۰۸/۲۵' },
  ];

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#f0fdf4' }}>{t('reports.title')}</h1>
        <p style={{ color: 'rgba(244, 255, 255, 0.7)' }}>{t('reports.subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#10b981' }}>{stats.total.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
          <div style={{ color: '#99f6e4' }} className="text-sm">{t('reports.total')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#7c3aed' }}>{stats.uploaded.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
          <div style={{ color: '#99f6e4' }} className="text-sm">{t('reports.uploaded')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#dc2626' }}>{stats.genres.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
          <div style={{ color: '#99f6e4' }} className="text-sm">{t('reports.genres')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#2563eb' }}>{stats.withImages.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>
          <div style={{ color: '#99f6e4' }} className="text-sm">{t('reports.withImages')}</div>
        </div>
      </div>

      <div className="premium-glass overflow-hidden">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.1)' }}>
          <h3 className="font-bold" style={{ color: '#f0fdf4' }}>{t('reports.available')}</h3>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            style={{
              background: settingsOpen ? 'rgba(16, 185, 129, 0.18)' : 'rgba(13, 124, 74, 0.1)',
              color: settingsOpen ? '#10b981' : '#54D9C0',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('reports.reportSettings')}
          </button>
        </div>

        {/* ---------- Report settings panel (collapsible) ---------- */}
        {settingsOpen && (
          <div className="p-5" style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.1)', background: 'rgba(13, 124, 74, 0.04)' }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Logo upload — left column */}
              <div className="flex flex-col items-center justify-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(13, 124, 74, 0.2)' }}>
                <div className="text-xs font-bold w-full text-right" style={{ color: '#54D9C0' }}>{t('reports.reportLogo')}</div>
                <div
                  className="w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(16, 185, 129, 0.35)' }}
                >
                  {/* logoVersion cache-busts so a freshly uploaded logo re-renders
                      immediately instead of serving the browser-cached old file. */}
                  <img
                    key={logoVersion}
                    src={`/uploads/logo.png?v=${logoVersion}`}
                    alt={t('reports.reportLogo')}
                    style={{ width: '72px', height: 'auto', objectFit: 'contain' }}
                    onError={(e) => {
                      // Fall back to the default program logo if no custom logo exists yet.
                      (e.currentTarget as HTMLImageElement).src = '/banke-rasane-logo.png';
                    }}
                  />
                </div>
                <label
                  className="text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                  style={{
                    background: uploadingLogo ? 'rgba(115, 115, 115, 0.2)' : 'rgba(16, 185, 129, 0.18)',
                    color: uploadingLogo ? 'rgba(244,255,255,0.5)' : '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {uploadingLogo ? t('reports.uploading') : t('reports.uploadLogo')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLogo(f);
                      e.target.value = '';   // allow re-selecting same file
                    }}
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-center" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
                  PNG/JPG/WebP — حداکثر ۵ مگابایت<br />
                  {t('reports.logoHint')}
                </p>
              </div>

              {/* Text defaults — right two columns */}
              <div className="lg:col-span-2 space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: '#54D9C0' }}>{t('reports.reportTitle')}</label>
                  <input
                    type="text"
                    value={rTitle}
                    onChange={(e) => setRTitle(e.target.value)}
                    placeholder="گزارش جامع آرشیو برنامه‌های تلویزیونی"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      color: '#f0fdf4',
                      border: '1px solid rgba(13, 124, 74, 0.3)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: '#54D9C0' }}>{t('reports.reportSubtitle')}</label>
                  <input
                    type="text"
                    value={rSubtitle}
                    onChange={(e) => setRSubtitle(e.target.value)}
                    placeholder="بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      color: '#f0fdf4',
                      border: '1px solid rgba(13, 124, 74, 0.3)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: '#54D9C0' }}>{t('reports.organization')}</label>
                  <input
                    type="text"
                    value={rOrg}
                    onChange={(e) => setROrg(e.target.value)}
                    placeholder="بانک رسانه"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      color: '#f0fdf4',
                      border: '1px solid rgba(13, 124, 74, 0.3)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="text-sm px-4 py-2 rounded-lg transition-colors"
                    style={{
                      background: savingSettings ? 'rgba(115, 115, 115, 0.2)' : '#10b981',
                      color: savingSettings ? 'rgba(244,255,255,0.5)' : '#ffffff',
                      fontWeight: 700,
                    }}
                  >
                    {savingSettings ? t('reports.saving') : '✓ ' + t('reports.saveSettings')}
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
                  این مقادیر به‌عنوان متن پیش‌فرض روی کاور گزارش PDF نمایش داده می‌شوند و برای همهٔ خروجی‌های بعدی اعمال می‌شوند.
                </p>
              </div>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(13, 124, 74, 0.08)', borderBottom: '1px solid rgba(13, 124, 74, 0.2)' }}>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#99f6e4' }}>#</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#99f6e4' }}>{t('reports.reportTitle')}</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: '#99f6e4' }}>{t('reports.type')}</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#99f6e4' }}>{t('reports.count')}</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: '#99f6e4' }}>{t('reports.date')}</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#99f6e4' }}>{t('reports.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, idx) => (
              <tr
                key={r.id}
                style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.08)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13, 124, 74, 0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="p-4 text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>{(idx + 1).toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm font-medium" style={{ color: '#f0fdf4' }}>{r.title}</td>
                <td className="p-4 hidden sm:table-cell">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={r.type === 'pdf'
                      ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                      : { background: 'rgba(13, 124, 74, 0.15)', color: '#54D9C0' }
                    }
                  >
                    {r.type === 'pdf' ? 'PDF' : 'Excel'}
                  </span>
                </td>
                <td className="p-4 text-sm" style={{ color: '#99f6e4' }}>{r.count.toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm hidden sm:table-cell" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>{r.date}</td>
                <td className="p-4">
                  <button
                    className="text-sm hover:underline"
                    style={{ color: '#10b981' }}
                    onClick={() => {
                      let shows: TalkShow[] = [];
                      if (r.id === 1) shows = talkShows;
                      else if (r.id === 2) shows = talkShows.filter(s => uploadedShows.includes(s.num));
                      if (shows.length === 0) { showToast(t('reports.noPrograms')); return; }
                      // Pass through the currently-edited defaults so the PDF
                      // preview + export reflect them even before saving.
                      onExport(shows, r.type === 'pdf' ? 'pdf' : 'excel', {
                        title: rTitle || undefined,
                        subtitle: rSubtitle || undefined,
                        organization: rOrg || undefined,
                      });
                    }}
                  >
                    {t('reports.download')}
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
// SETTINGS MODAL (admin only) — 3 tabs:
//   1. سرور — server URL field, test connection, save (setApiBase)
//   2. کاربران — list users, add user, delete user, change role
//   3. رمز عبور — change own password (old + new + confirm)
// ============================================
function SettingsModal({
  currentUser,
  onClose,
  showToast,
  onLogout,
  onPasswordChanged,
}: {
  currentUser: User;
  onClose: () => void;
  showToast: (msg: string) => void;
  onLogout: () => void;
  onPasswordChanged?: (user: User) => void;
}) {
  const { t } = useLang();
  const [tab, setTab] = useState<'profile' | 'users' | 'server' | 'report' | 'password' | 'activity'>('profile');

  const tabs = [
    { key: 'profile' as const,  label: t('settings.profile.edit'), icon: '👤' },
    { key: 'users' as const,    label: t('settings.users.title'),  icon: '👥' },
    { key: 'report' as const,   label: t('view.reports'),           icon: '📄' },
    { key: 'activity' as const, label: t('settings.activity.title'),icon: '📋' },
    { key: 'server' as const,   label: t('settings.server.title'),  icon: '🖥' },
    { key: 'password' as const, label: t('settings.password.title'),icon: '🔑' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full h-full"
        style={{
          width: '100%',
          maxWidth: '1000px',
          height: '100vh',
          maxHeight: '100vh',
          /* Liquid glass — same as header */
          background: 'linear-gradient(180deg, rgba(5, 80, 65, 0.95) 0%, rgba(0, 95, 75, 0.92) 50%, rgba(8, 110, 90, 0.9) 100%)',
          backdropFilter: 'blur(28px) saturate(135%)',
          WebkitBackdropFilter: 'blur(28px) saturate(135%)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — compact */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}
        >
          <h2 className="text-base font-bold" style={{ color: '#f0fdf4' }}>{t('settings.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('misc.close')}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs — compact, wrap to multiple rows if needed */}
        <div
          className="flex flex-wrap items-center gap-1 px-3 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                style={active ? {
                  background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0, 107, 80, 0.4)',
                } : {
                  color: 'rgba(255, 255, 255, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                <span style={{ fontSize: '13px' }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body — scrollable, fills ALL remaining height */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-5"
          style={{
            minHeight: 0,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.4) transparent',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tab === 'profile' && <ProfileTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'users' && <SettingsUsersTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'server' && <SettingsServerTab showToast={showToast} />}
          {tab === 'report' && <SettingsReportTab showToast={showToast} />}
          {tab === 'activity' && <SettingsActivityTab showToast={showToast} />}
          {tab === 'password' && <SettingsPasswordTab currentUser={currentUser} showToast={showToast} onPasswordChanged={onPasswordChanged} onLogout={onLogout} />}
        </div>
      </div>
    </div>
  );
}

// --- Tab: Profile (iPhone Contacts style) ---
function ProfileTab({ currentUser, showToast }: { currentUser: User; showToast: (msg: string) => void }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || '');
  const [deputy, setDeputy] = useState(currentUser.deputy || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [saving, setSaving] = useState(false);

  const roleLabels: Record<string, string> = { admin: 'مدیر سیستم', editor: 'ویراستار', viewer: 'بیننده' };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(getApiUrl('api/auth/me'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('bankresaneh_token')}` },
        body: JSON.stringify({ name, phone, jobTitle, deputy, avatar }),
      });
      if (res.ok) {
        showToast(t('settings.profile.saved'));
        setEditing(false);
      } else {
        showToast('خطا در بروزرسانی');
      }
    } catch {
      showToast('خطا در ارتباط با سرور');
    }
    setSaving(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Avatar — large square like iPhone Contacts */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative"
          style={{ width: '120px', height: '120px' }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              style={{
                width: '120px', height: '120px', borderRadius: '24px', objectFit: 'cover',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
            />
          ) : (
            <div
              style={{
                width: '120px', height: '120px', borderRadius: '24px',
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '48px', fontWeight: 900, color: '#fff',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
            >
              {(name || currentUser.username).charAt(0).toUpperCase()}
            </div>
          )}
          {editing && (
            <label
              style={{
                position: 'absolute', bottom: '-4px', right: '-4px',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.82-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        <div className="text-center">
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f0fdf4' }}>{name || currentUser.username}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>@{currentUser.username}</div>
        </div>
        <span
          style={{
            fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px',
            background: currentUser.role === 'admin' ? 'rgba(220, 38, 38, 0.3)' : currentUser.role === 'editor' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 185, 154, 0.3)',
            color: currentUser.role === 'admin' ? '#fca5a5' : currentUser.role === 'editor' ? '#fcd34d' : '#54D9C0',
          }}
        >
          {roleLabels[currentUser.role] || currentUser.role}
        </span>
      </div>

      {/* Info fields — iPhone Contacts style rows */}
      <div className="space-y-3">
        <ProfileField
          icon="👤"
          label="نام نمایشی"
          value={name}
          isEditing={editing}
          onChange={setName}
          placeholder="نام و نام خانوادگی"
        />
        <ProfileField
          icon="📱"
          label="شماره همراه"
          value={phone}
          isEditing={editing}
          onChange={setPhone}
          placeholder="0912xxxxxxx"
          dir="ltr"
        />
        <ProfileField
          icon="💼"
          label="عنوان شغلی"
          value={jobTitle}
          isEditing={editing}
          onChange={setJobTitle}
          placeholder="مثلاً: تهیه‌کننده"
        />
        <ProfileField
          icon="🏢"
          label="معاونت"
          value={deputy}
          isEditing={editing}
          onChange={setDeputy}
          placeholder="مثلاً: معاونت برنامه"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: '12px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: '#fff', fontWeight: 700, fontSize: '14px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'در حال ذخیره...' : '✓ ذخیره'}
            </button>
            <button
              onClick={() => { setEditing(false); setName(currentUser.name || ''); setPhone(currentUser.phone || ''); setJobTitle(currentUser.jobTitle || ''); setDeputy(currentUser.deputy || ''); setAvatar(currentUser.avatar || ''); }}
              style={{
                flex: 1, padding: '12px', borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)', fontWeight: 700, fontSize: '14px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
              }}
            >
              انصراف
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#f0fdf4', fontWeight: 700, fontSize: '14px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              cursor: 'pointer',
            }}
          >
            ✏️ ویرایش پروفایل
          </button>
        )}
      </div>
    </div>
  );
}

// Reusable profile field — iPhone Contacts style row
function ProfileField({ icon, label, value, isEditing, onChange, placeholder, dir }: {
  icon: string;
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '2px' }}>{label}</div>
        {isEditing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            dir={dir}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: '#f0fdf4', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
              padding: 0,
            }}
          />
        ) : (
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0fdf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir={dir}>
            {value || '—'}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab: Report Settings — analytics dashboard + PDF report defaults ---
function SettingsReportTab({ showToast }: { showToast: (msg: string) => void }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bankresaneh_report_defaults');
      if (saved) {
        const obj = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(obj.title || '');
         
        setSubtitle(obj.subtitle || '');
      } else {
         
        setTitle('گزارش جامع برنامه‌های تلویزیونی');
         
        setSubtitle('مرجع جامع برنامه‌های تلویزیونی بین‌المللی');
      }
    } catch {}
     
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReportLoading(true);
    api.getAnalyticsReport(days)
      .then(data => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const handleSave = () => {
    try {
      localStorage.setItem('bankresaneh_report_defaults', JSON.stringify({ title, subtitle }));
      showToast(t('reports.settingsSaved'));
    } catch {
      showToast(t('reports.settingsError'));
    }
  };

  if (loading) return null;

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '16px',
    padding: '16px',
  };
  const statStyle: React.CSSProperties = {
    fontSize: '28px', fontWeight: 800, color: '#5eead4', lineHeight: 1.1,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px',
  };

  return (
    <div className="space-y-5">
      {/* Analytics dashboard */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f0fdf4', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> گزارش فعالیت و تحلیل
        </h3>

        {/* Days selector */}
        <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>بازه زمانی:</span>
          {[7, 30, 90, 365].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={days === d ? {
                background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
              } : {
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {d === 365 ? 'یک سال' : d === 90 ? 'سه ماه' : d === 30 ? 'یک ماه' : 'یک هفته'}
            </button>
          ))}
        </div>

        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            در حال بارگذاری گزارش…
          </div>
        ) : !report ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            گزارشی در دسترس نیست.
          </div>
        ) : (
          <>
            {/* Top stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div style={cardStyle}>
                <div style={statStyle}>{(report.totals?.views || 0).toLocaleString('fa-IR')}</div>
                <div style={labelStyle}>👁 مشاهده برنامه</div>
              </div>
              <div style={cardStyle}>
                <div style={statStyle}>{(report.totals?.pdfExports || 0).toLocaleString('fa-IR')}</div>
                <div style={labelStyle}>📄 خروجی PDF</div>
              </div>
              <div style={cardStyle}>
                <div style={statStyle}>{(report.totals?.publishes || 0).toLocaleString('fa-IR')}</div>
                <div style={labelStyle}>📤 منتشر شده</div>
              </div>
              <div style={cardStyle}>
                <div style={statStyle}>{(report.onlineCount || 0).toLocaleString('fa-IR')}</div>
                <div style={labelStyle}>🟢 آنلاین اکنون</div>
              </div>
            </div>

            {/* Online users list */}
            {report.onlineUsers && report.onlineUsers.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#5eead4', marginBottom: '8px' }}>
                  🟢 کاربران آنلاین ({report.onlineCount.toLocaleString('fa-IR')} نفر)
                </div>
                <div className="space-y-1" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {report.onlineUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '16px' }}>{u.role === 'admin' ? '👑' : u.role === 'editor' ? '✏️' : '👁'}</span>
                        <span style={{ color: '#f0fdf4', fontWeight: 600, fontSize: '13px' }}>{u.name || u.username}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>@{u.username}</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                        {u.lastSeenSecondsAgo < 60 ? 'هم‌اکنون' : `${Math.floor(u.lastSeenSecondsAgo / 60).toLocaleString('fa-IR')} دقیقه پیش`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily active chart (simple bars) */}
            {report.dailyActive && report.dailyActive.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#5eead4', marginBottom: '12px' }}>
                  📅 کاربران فعال روزانه
                </div>
                <div className="flex items-end gap-1" style={{ height: '80px' }}>
                  {report.dailyActive.slice(-14).map((d: any, i: number) => {
                    const max = Math.max(...report.dailyActive.map((x: any) => x.users), 1);
                    const h = Math.max(4, (d.users / max) * 70);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: '20px' }}>
                        <div style={{
                          width: '100%', height: `${h}px`,
                          background: 'linear-gradient(180deg, #22B99A 0%, #006B50 100%)',
                          borderRadius: '4px 4px 0 0', opacity: 0.8,
                        }} title={`${d.day}: ${d.users} نفر`} />
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {d.day.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Incomplete programs */}
            {report.incompletePrograms && report.incompletePrograms.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
                  ⚠️ برنامه‌های ناقص ({report.incompleteCount.toLocaleString('fa-IR')} از {(report.totalShows || 0).toLocaleString('fa-IR')} برنامه)
                </div>
                <div className="space-y-1" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {report.incompletePrograms.slice(0, 50).map((s: any) => (
                    <div key={s.num} className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#f0fdf4', fontWeight: 600, fontSize: '13px' }}>
                        #{s.num.toLocaleString('fa-IR')} — {s.name || '(بدون نام)'}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.missing.map((m: string) => (
                          <span key={m} style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                            background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                          }}>
                            {m === 'name' ? 'نام' :
                             m === 'summary' ? 'خلاصه' :
                             m === 'descriptionFa' ? 'توضیح فارسی' :
                             m === 'materials' ? 'مواد' :
                             m === 'style' ? 'سبک' :
                             m === 'colors' ? 'رنگ‌ها' :
                             m === 'layout' ? 'چیدمان' : m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {report.incompleteCount > 50 && (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '8px' }}>
                      و {(report.incompleteCount - 50).toLocaleString('fa-IR')} برنامه دیگر…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top viewed shows */}
            {report.topShows && report.topShows.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#5eead4', marginBottom: '8px' }}>
                  🔥 پربازدیدترین برنامه‌ها
                </div>
                <div className="space-y-1">
                  {report.topShows.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', minWidth: '18px' }}>
                          {(i + 1).toLocaleString('fa-IR')}.
                        </span>
                        <span style={{ color: '#f0fdf4', fontSize: '13px' }}>#{s.num.toLocaleString('fa-IR')}</span>
                      </div>
                      <span style={{ color: '#5eead4', fontWeight: 700, fontSize: '13px' }}>
                        {s.views.toLocaleString('fa-IR')} بازدید
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top exported shows */}
            {report.topExports && report.topExports.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#5eead4', marginBottom: '8px' }}>
                  📄 بیشترین خروجی (PDF/Excel)
                </div>
                <div className="space-y-1">
                  {report.topExports.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', minWidth: '18px' }}>
                          {(i + 1).toLocaleString('fa-IR')}.
                        </span>
                        <span style={{ color: '#f0fdf4', fontSize: '13px' }}>#{s.num.toLocaleString('fa-IR')}</span>
                      </div>
                      <span style={{ color: '#5eead4', fontWeight: 700, fontSize: '13px' }}>
                        {s.exports.toLocaleString('fa-IR')} خروجی
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PDF report defaults */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f0fdf4', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📄</span> تنظیمات پیش‌فرض گزارش PDF
        </h3>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', display: 'block', marginBottom: '6px' }}>
            عنوان پیش‌فرض گزارش
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#f0fdf4', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
        <div className="mt-3">
          <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', display: 'block', marginBottom: '6px' }}>
            زیرعنوان پیش‌فرض گزارش
          </label>
          <textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#f0fdf4', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            }}
          />
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
          این عنوان‌ها در گزارش‌های PDF و Excel به‌صورت پیش‌فرض استفاده می‌شوند.
        </p>
        <button
          onClick={handleSave}
          className="mt-3"
          style={{
            width: '100%', padding: '12px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)',
            color: '#fff', fontWeight: 700, fontSize: '14px',
            border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          }}
        >
          ✓ ذخیره تنظیمات
        </button>
      </div>
    </div>
  );
}

// --- Tab: Server URL ---
function SettingsServerTab({ showToast }: { showToast: (msg: string) => void }) {
  const { t } = useLang();
  const [url, setUrl] = useState(() => getApiBase());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

   


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
        <h3 className="text-base font-bold mb-1" style={{ color: '#f0fdf4' }}>🖥 آدرس سرور API</h3>
        <p className="text-sm mb-3" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          آدرس سرویس API که این برنامه به آن متصل می‌شود. پیش‌فرض: <code dir="ltr" style={{ background: 'rgba(13, 124, 74,0.1)', padding: '2px 6px', borderRadius: '6px', color: '#54D9C0' }}>http://localhost:3002</code>
        </p>
        <input
          type="text"
          dir="ltr"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
          placeholder="http://localhost:3002"
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(13, 124, 74, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#f0fdf4',
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
              ? { background: 'rgba(13, 124, 74, 0.12)', color: '#54D9C0', border: '1px solid rgba(13, 124, 74, 0.3)' }
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
            background: 'linear-gradient(135deg, #006B50 0%, #22B99A 100%)', border: '1px solid rgba(255, 255, 255, 0.3)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(13, 124, 74, 0.3)',
          }}
        >
          ✓ ذخیره آدرس
        </button>
      </div>

      <div
        className="p-3 rounded-xl text-xs"
        style={{ background: 'rgba(13, 124, 74, 0.05)', border: '1px solid rgba(13, 124, 74, 0.15)', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.7 }}
      >
        <strong>راهنما:</strong> آدرس وارد شده باید ریشهٔ سرویس API باشد (بدون مسیرهای <code dir="ltr">/api/...</code>).
        اگر از گیتوی Caddy استفاده می‌کنید، می‌توانید آدرس نسبی وارد کنید. پس از ذخیره، توکن فعلی شما معتبر می‌ماند.
      </div>
    </div>
  );
}

// --- Permissions Panel — checkbox for each permission ---
const PERMISSION_LABELS: Record<string, { fa: string; en: string }> = {
  manage_users:    { fa: 'مدیریت کاربران',      en: 'Manage users' },
  create_admins:   { fa: 'ساخت مدیر جدید',       en: 'Create admins' },
  suspend_users:   { fa: 'تعلیق کاربران',        en: 'Suspend users' },
  add_shows:       { fa: 'افزودن برنامه',        en: 'Add programs' },
  edit_shows:      { fa: 'ویرایش برنامه',        en: 'Edit programs' },
  delete_shows:    { fa: 'حذف برنامه',           en: 'Delete programs' },
  manage_genres:   { fa: 'مدیریت ژانرها',        en: 'Manage genres' },
  manage_settings: { fa: 'مدیریت تنظیمات',       en: 'Manage settings' },
  view_activity:   { fa: 'مشاهده گزارش فعالیت',  en: 'View activity log' },
  export_reports:  { fa: 'خروجی گزارش',          en: 'Export reports' },
};

function PermissionsPanel({ user, currentUser, onSaved }: {
  user: User;
  currentUser: User;
  onSaved: (permissions: string[]) => void;
}) {
  const { t, lang } = useLang();
  const [perms, setPerms] = useState<Set<string>>(new Set(user.permissions || []));
  const [saving, setSaving] = useState(false);

  const toggle = (perm: string) => {
    const next = new Set(perms);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    setPerms(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUser(user.id, { permissions: Array.from(perms) });
      onSaved(Array.from(perms));
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Super admins have all permissions and cannot be modified
  const isSuper = user.isSuperAdmin;

  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-xs font-bold mb-2" style={{ color: '#54D9C0' }}>
        {lang === 'fa' ? 'اختیارات دسترسی' : 'Permissions'}
        {isSuper && <span className="mr-2 text-[10px]" style={{ color: '#10b981' }}>({lang === 'fa' ? 'مدیر اصلی — همه اختیارات' : 'Super admin — all permissions'})</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.keys(PERMISSION_LABELS).map(perm => {
          const label = lang === 'fa' ? PERMISSION_LABELS[perm].fa : PERMISSION_LABELS[perm].en;
          const checked = isSuper || perms.has(perm);
          return (
            <label
              key={perm}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
              style={{
                background: checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                opacity: isSuper ? 0.6 : 1,
                cursor: isSuper ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isSuper}
                onChange={() => !isSuper && toggle(perm)}
                style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
              />
              <span className="text-xs" style={{ color: checked ? '#10b981' : 'rgba(244, 255, 255, 0.7)' }}>
                {label}
              </span>
            </label>
          );
        })}
      </div>
      {!isSuper && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: saving ? 'rgba(107, 143, 122, 0.3)' : '#0d7c4a',
            color: '#ffffff',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '⏳ ...' : (lang === 'fa' ? '✓ ذخیره اختیارات' : '✓ Save permissions')}
        </button>
      )}
    </div>
  );
}

// --- Tab 2: Users management ---
function SettingsUsersTab({ currentUser, showToast }: { currentUser: User; showToast: (msg: string) => void }) {
  const { t } = useLang();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', name: '', jobTitle: '', deputy: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (e: any) {
      setError(e?.message || t('toast.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.getUsers().then((list) => {
      if (!cancelled) {
        setUsers(list);
        setError(null);
      }
    }).catch((e: any) => {
      if (!cancelled) setError(e?.message || t('toast.loadingError'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [t]);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      showToast(t('settings.username'));
      return;
    }
    if (newUser.password.length < 8) {
      showToast(t('settings.password.tooShort'));
      return;
    }
    setCreating(true);
    try {
      await api.createUser({
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role,
        name: newUser.name,
        jobTitle: newUser.jobTitle,
        deputy: newUser.deputy,
        phone: newUser.phone,
      });
      showToast(`${t('settings.users.created')}: ${newUser.username}`);
      setNewUser({ username: '', password: '', role: 'viewer', name: '', jobTitle: '', deputy: '', phone: '' });
      await load();
    } catch (e: any) {
      showToast(e?.message || 'خطا در ایجاد کاربر');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser.id) {
      showToast(t('settings.users.cannotDeleteSelf'));
      return;
    }
    if (u.isSuperAdmin) {
      showToast(t('settings.users.cannotDeleteSuper'));
      return;
    }
    if (!confirm(`کاربر «${u.username}» حذف شود؟`)) return;
    try {
      await api.deleteUser(u.id);
      showToast(t('settings.users.deleted'));
      await load();
    } catch (e: any) {
      showToast(e?.message || t('toast.error'));
    }
  };

  const handleChangeRole = async (u: User, newRole: string) => {
    if (newRole === u.role) return;
    if (u.isSuperAdmin) { showToast(t('settings.users.cannotChangeSuper')); return; }
    try {
      await api.updateUser(u.id, { role: newRole });
      showToast(`${t('settings.users.roleChanged')}: ${u.username} → ${newRole}`);
      await load();
    } catch (e: any) {
      showToast(e?.message || t('toast.error'));
    }
  };

  const handleToggleSuspend = async (u: User) => {
    const newActive = u.isActive === false ? true : false;
    try {
      await api.updateUser(u.id, { isActive: newActive });
      showToast(newActive ? `کاربر «${u.username}» فعال شد` : `کاربر «${u.username}» معلق شد`);
      await load();
    } catch (e: any) {
      showToast(e?.message || t('toast.error'));
    }
  };

  const roleLabel: Record<string, string> = { admin: 'مدیر', editor: 'ویراستار', viewer: 'بیننده' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#f0fdf4' }}>👥 مدیریت کاربران</h3>
        <p className="text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          افزودن، حذف یا تغییر نقش کاربران سیستم. نقش‌ها: مدیر (دسترسی کامل)، ویراستار (افزودن/ویرایش برنامه‌ها)، بیننده (فقط مشاهده).
        </p>
      </div>

      {/* Add new user form */}
      <div
        className="p-4 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <h4 className="font-bold text-sm mb-3" style={{ color: '#f0fdf4' }}>＋ افزودن کاربر جدید</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            dir="ltr"
            placeholder="نام کاربری"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <input
            type="text"
            placeholder="نام نمایشی (نام و نام خانوادگی)"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
            }}
          />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              dir="ltr"
              placeholder="رمز عبور (حداقل ۸ کاراکتر)"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '10px 40px 10px 14px',
                fontSize: '14px',
                color: '#f0fdf4',
                outline: 'none',
                textAlign: 'left',
                direction: 'ltr',
                width: '100%',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#54D9C0', background: 'transparent' }}
              title={showPw ? 'پنهان کردن رمز' : 'نمایش رمز'}
              aria-label={showPw ? 'پنهان کردن رمز' : 'نمایش رمز'}
            >
              {showPw ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1.012 1.012 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          <input
            type="tel"
            dir="ltr"
            placeholder="شماره همراه (0912xxxxxxx)"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <input
            type="text"
            placeholder="عنوان شغلی (مثلاً: تهیه‌کننده)"
            value={newUser.jobTitle}
            onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
            }}
          />
          <input
            type="text"
            placeholder="معاونت (مثلاً: معاونت برنامه)"
            value={newUser.deputy}
            onChange={(e) => setNewUser({ ...newUser, deputy: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
            }}
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#f0fdf4',
              outline: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="viewer" style={{ background: '#0a1f14', color: '#f0fdf4' }}>بیننده (فقط مشاهده)</option>
            <option value="editor" style={{ background: '#0a1f14', color: '#f0fdf4' }}>ویراستار (افزودن/ویرایش)</option>
            <option value="admin" style={{ background: '#0a1f14', color: '#f0fdf4' }}>مدیر (دسترسی کامل)</option>
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

      {/* Users list */}
      <div>
        <h4 className="font-bold text-sm mb-2" style={{ color: '#f0fdf4' }}>
          کاربران فعلی ({users.length.toLocaleString('fa-IR')})
        </h4>
        {loading && (
          <div className="p-4 text-center text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>در حال بارگذاری...</div>
        )}
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl flex items-center gap-3 flex-wrap"
                style={{ background: u.isActive === false ? 'rgba(107, 143, 122, 0.08)' : 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', opacity: u.isActive === false ? 0.6 : 1 }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{
                    background: u.role === 'admin' ? 'rgba(220, 38, 38, 0.15)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(13, 124, 74, 0.15)',
                    color: u.role === 'admin' ? '#dc2626' : u.role === 'editor' ? '#d97706' : '#0d7c4a',
                    border: `1px solid ${u.role === 'admin' ? 'rgba(220, 38, 38, 0.35)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(13, 124, 74, 0.35)'}`,
                  }}
                >
                  {(u.name || u.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2" style={{ color: '#f0fdf4' }} title={u.username}>
                    {u.name || u.username}
                    {u.isSuperAdmin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>👑 مدیر اصلی</span>
                    )}
                    {u.isActive === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(107, 143, 122, 0.2)', color: '#94a8c0', border: '1px solid rgba(107, 143, 122, 0.35)' }}>معلق</span>
                    )}
                    {u.id === currentUser.id && (
                      <span className="text-xs font-normal" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>(شما)</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.7)' }} dir="ltr">@{u.username}</div>
                  {u.permissions && u.permissions.length > 0 && u.role === 'admin' && !u.isSuperAdmin && (
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
                      اختیارات: {u.permissions.length} مورد
                    </div>
                  )}
                </div>
                {/* Role selector — disabled for super admin */}
                <select
                  value={u.role}
                  onChange={(e) => handleChangeRole(u, e.target.value)}
                  disabled={u.id === currentUser.id || u.isSuperAdmin}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '13px',
                    color: '#f0fdf4',
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: (u.id === currentUser.id || u.isSuperAdmin) ? 'not-allowed' : 'pointer',
                    opacity: (u.id === currentUser.id || u.isSuperAdmin) ? 0.6 : 1,
                  }}
                  title={u.isSuperAdmin ? t('settings.users.cannotChangeSuper') : u.id === currentUser.id ? 'نمی‌توانید نقش خودتان را تغییر دهید' : 'تغییر نقش'}
                >
                  <option value="viewer" style={{ background: '#0a1f14', color: '#f0fdf4' }}>بیننده</option>
                  <option value="editor" style={{ background: '#0a1f14', color: '#f0fdf4' }}>ویراستار</option>
                  <option value="admin" style={{ background: '#0a1f14', color: '#f0fdf4' }}>مدیر</option>
                </select>
                {/* Suspend/Activate button — only for admins, not for super admin or self */}
                {currentUser.isSuperAdmin && u.role === 'admin' && !u.isSuperAdmin && u.id !== currentUser.id && (
                  <button
                    onClick={() => handleToggleSuspend(u)}
                    className="p-2 rounded-lg transition-colors flex-shrink-0"
                    style={{
                      color: u.isActive === false ? '#10b981' : '#f59e0b',
                      background: u.isActive === false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${u.isActive === false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      cursor: 'pointer',
                    }}
                    title={u.isActive === false ? 'فعال‌سازی کاربر' : 'تعلیق کاربر'}
                  >
                    {u.isActive === false ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                  </button>
                )}
                {/* Delete button — disabled for super admin and self */}
                <button
                  onClick={() => handleDelete(u)}
                  disabled={u.id === currentUser.id || u.isSuperAdmin}
                  className="p-2 rounded-lg transition-colors flex-shrink-0"
                  style={{
                    color: (u.id === currentUser.id || u.isSuperAdmin) ? 'rgba(107, 143, 122, 0.4)' : '#dc2626',
                    background: (u.id === currentUser.id || u.isSuperAdmin) ? 'transparent' : 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    cursor: (u.id === currentUser.id || u.isSuperAdmin) ? 'not-allowed' : 'pointer',
                    opacity: (u.id === currentUser.id || u.isSuperAdmin) ? 0.4 : 1,
                  }}
                  title={u.isSuperAdmin ? t('settings.users.cannotDeleteSuper') : u.id === currentUser.id ? 'نمی‌توانید خودتان را حذف کنید' : `حذف ${u.username}`}
                  aria-label={`حذف کاربر ${u.username}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              {/* Permissions panel for admins (super admin can edit, others see read-only) */}
              {u.role === 'admin' && currentUser.isSuperAdmin && !u.isSuperAdmin && (
                <PermissionsPanel
                  user={u}
                  currentUser={currentUser}
                  onSaved={(perms) => {
                    showToast(perms.length > 0 ? `اختیارات ذخیره شد (${perms.length} مورد)` : 'تمام اختیارات لغو شد');
                    load();
                  }}
                />
              )}
              {/* Read-only permissions display for non-super-admin viewers */}
              {u.role === 'admin' && !currentUser.isSuperAdmin && u.permissions && u.permissions.length > 0 && (
                <div className="w-full mt-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="text-[10px] font-bold mb-1" style={{ color: '#54D9C0' }}>اختیارات:</div>
                  <div className="flex flex-wrap gap-1">
                    {u.permissions.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        {PERMISSION_LABELS[p]?.fa || p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab: Activity Log ---
function SettingsActivityTab({ showToast }: { showToast: (msg: string) => void }) {
  const { t } = useLang();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getActivity(100).then((data) => {
      if (!cancelled) setLogs(data);
    }).catch(() => {
      // Non-admin users may not have access to the activity log.
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const actionLabels: Record<string, string> = {
    create_user: 'ساخت کاربر',
    update_user: 'ویرایش کاربر',
    delete_user: 'حذف کاربر',
    suspend_user: 'تعلیق کاربر',
    activate_user: 'فعال‌سازی کاربر',
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#f0fdf4' }}>📋 گزارش فعالیت</h3>
        <p className="text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          آخرین تغییرات اعمال‌شده توسط کاربران سیستم.
        </p>
      </div>

      {loading && (
        <div className="p-4 text-center text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>در حال بارگذاری...</div>
      )}

      {!loading && logs.length === 0 && (
        <div className="p-4 text-center text-sm" style={{ color: 'rgba(244, 255, 255, 0.5)' }}>
          هیچ فعالیتی ثبت نشده است.
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl flex items-start gap-3"
              style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                style={{
                  background: log.action?.includes('delete') ? 'rgba(220, 38, 38, 0.15)' :
                              log.action?.includes('create') ? 'rgba(16, 185, 129, 0.15)' :
                              log.action?.includes('suspend') ? 'rgba(245, 158, 11, 0.15)' :
                              'rgba(13, 124, 74, 0.15)',
                  color: log.action?.includes('delete') ? '#dc2626' :
                         log.action?.includes('create') ? '#10b981' :
                         log.action?.includes('suspend') ? '#f59e0b' :
                         '#54D9C0',
                }}
              >
                {log.action?.includes('delete') ? '🗑' :
                 log.action?.includes('create') ? '➕' :
                 log.action?.includes('suspend') ? '⏸' :
                 log.action?.includes('activate') ? '▶' : '✏'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: '#f0fdf4' }}>
                  {actionLabels[log.action] || log.action}
                </div>
                <div className="text-xs" style={{ color: 'rgba(244, 255, 255, 0.6)' }}>
                  {log.details}
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(244, 255, 255, 0.4)' }}>
                  {log.username} • {formatTime(log.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab 3: Change password ---
function SettingsPasswordTab({
  currentUser,
  showToast,
  onPasswordChanged,
  onLogout,
}: {
  currentUser: User;
  showToast: (msg: string) => void;
  onPasswordChanged?: (user: User) => void;
  onLogout: () => void;
}) {
  const { t } = useLang();
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
      const result = await api.changePassword(oldPw, newPw);
      // The API now returns a fresh token + updated user object. If we got
      // them, we can keep the session alive — no re-login needed. This
      // fixes the 401 "Unauthorized" errors that happened when the old
      // token was invalidated but the frontend hadn't logged out yet.
      if (result?.user && onPasswordChanged) {
        showToast('رمز با موفقیت تغییر کرد.');
        onPasswordChanged(result.user);
      } else {
        // Fallback (older API): session was invalidated, must re-login.
        showToast('رمز با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.');
        setTimeout(() => { onLogout(); }, 1500);
      }
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      showToast(e?.message || 'خطا در تغییر رمز');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(13, 124, 74, 0.25)',
    borderRadius: '12px',
    padding: '12px 48px 12px 16px',
    color: '#f0fdf4',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'left',
    direction: 'ltr',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#f0fdf4' }}>🔑 تغییر رمز عبور</h3>
        <p className="text-sm" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>
          رمز عبور خود را تغییر دهید. پس از تغییر، تمام نشست‌های فعال شما باطل شده و باید دوباره وارد شوید.
        </p>
      </div>

      <div
        className="p-3 rounded-xl text-sm flex items-center gap-2"
        style={{ background: 'rgba(13, 124, 74, 0.08)', border: '1px solid rgba(13, 124, 74, 0.2)', color: '#54D9C0' }}
      >
        <span>👤 حساب فعلی:</span>
        <strong>{currentUser.name || currentUser.username}</strong>
        <span dir="ltr" style={{ color: 'rgba(244, 255, 255, 0.7)' }}>@{currentUser.username}</span>
      </div>

      {[
        { label: 'رمز فعلی', val: oldPw, set: setOldPw },
        { label: 'رمز جدید', val: newPw, set: setNewPw },
        { label: 'تکرار رمز جدید', val: confirmPw, set: setConfirmPw },
      ].map((f, i) => (
        <div key={i}>
          <label className="block text-sm font-bold mb-2" style={{ color: '#f0fdf4' }}>{f.label}</label>
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10"
              style={{ color: 'rgba(255, 255, 255, 0.9)', background: 'transparent' }}
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
