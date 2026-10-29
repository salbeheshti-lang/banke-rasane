'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { api, setApiBase, getApiBase, User } from '@/lib/api';
import { rankSearchShows } from '@/lib/search';

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
  name: string;
  color: string;
  description: string;
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
    color: '#10b981', description: 'همهٔ ۵۶۰ برنامه با تحلیل دکور و صحنه', filterFn: () => true,
    tags: DEFAULT_GENRE_TAGS,
    presetTags: ['مدرن', 'مینیمال', 'چوب', 'تکنولوژی', 'گرم', 'لوکس', 'تاریک', 'روشن'],
    searchFields: ['name', 'summary', 'materials', 'colors'],
  },
  {
    id: 'interview', key: 'interview', nameFa: 'تاک‌شوی مصاحبه‌محور', name: 'Interview',
    color: '#0d9488', description: '۱۰۲ برنامه', filterFn: s => s.category.includes('مصاحبه'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.viewers],
    presetTags: ['مصاحبه اختصاصی', 'مهمان ویژه', 'تکنولوژی', 'استودیو', 'مدرن', 'گریل'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'comedy', key: 'comedy', nameFa: 'تاک‌شوی طنز و کمدی', name: 'Comedy',
    color: '#db2777', description: '۸۹ برنامه', filterFn: s => s.category.includes('طنز'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['طنز', 'استندآپ', 'شخصیت‌محور', 'استودیوی رنگارنگ', 'پویا'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'news', key: 'news', nameFa: 'تاک‌شوی سیاسی و خبری', name: 'News/Politics',
    color: '#dc2626', description: '۶۸ برنامه', filterFn: s => s.category.includes('خبری') || s.category.includes('سیاسی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['خبری', 'تحلیل سیاسی', 'مهمان سیاسی', 'رسمی', 'مدرن'],
    searchFields: ['name', 'summary', 'descriptionFa', 'category'],
  },
  {
    id: 'lifestyle', key: 'lifestyle', nameFa: 'تاک‌شوی تخصصی و سبک زندگی', name: 'Lifestyle',
    color: '#16a34a', description: '۵۴ برنامه', filterFn: s => s.category.includes('تخصصی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['سبک زندگی', 'آشپزی', 'سلامت', 'مد', 'منزل', 'طبیعت'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'cultural', key: 'cultural', nameFa: 'تاک‌شوی فرهنگی، هنری', name: 'Cultural',
    color: '#b45309', description: '۵۲ برنامه', filterFn: s => s.category.includes('فرهنگی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['فرهنگی', 'هنری', 'سنتی', 'تاریخی', 'موسیقی'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'celebrity', key: 'celebrity', nameFa: 'تاک‌شوی گروهی سلبریتی‌ها', name: 'Celebrity',
    color: '#7c3aed', description: '۴۲ برنامه', filterFn: s => s.category.includes('سلبریتی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.size],
    presetTags: ['سلبریتی', 'گروهی', 'مهمان‌محور', 'سرگرمی', 'لوکس'],
    searchFields: ['name', 'summary', 'style', 'size'],
  },
  {
    id: 'panel', key: 'panel', nameFa: 'تاک‌شوی پنلی و میزگرد', name: 'Panel',
    color: '#2563eb', description: '۲۳ برنامه', filterFn: s => s.category.includes('پنلی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.size],
    presetTags: ['پنل', 'میزگرد', 'چندمهمانه', 'بحث', 'تخصصی'],
    searchFields: ['name', 'summary', 'category', 'layout'],
  },
  {
    id: 'morning', key: 'morning', nameFa: 'تاک‌شوی روزانه/صبحگاهی', name: 'Morning Show',
    color: '#f59e0b', description: '۲۰ برنامه', filterFn: s => s.category.includes('صبحگاهی'),
    tags: [TAG_LIBRARY.size, TAG_LIBRARY.viewers],
    presetTags: ['صبحگاهی', 'روزانه', 'پویا', 'با تماشاگر', 'موسیقی زنده'],
    searchFields: ['name', 'summary', 'category', 'viewers'],
  },
  {
    id: 'reality', key: 'reality', nameFa: 'ریلیتی شو / مسابقه', name: 'Reality/Competition',
    color: '#ea580c', description: '۱۹ برنامه', filterFn: s => s.category.includes('مسابقه') || s.category.includes('رئالیتی'),
    tags: [TAG_LIBRARY.effects, TAG_LIBRARY.style],
    presetTags: ['مسابقه', 'رئالیتی', 'داورمحور', 'پیروز', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'night', key: 'night', nameFa: 'تاک‌شوی شبانه', name: 'Late Night',
    color: '#6366f1', description: '۱۵ برنامه', filterFn: s => s.category.includes('شبانه'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['شبانه', 'تاریک', 'کمدی', 'مصاحبه کوتاه', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'lighting'],
  },
  {
    id: 'entertainment', key: 'entertainment', nameFa: 'صنعت سرگرمی / پشت‌صحنه', name: 'Entertainment',
    color: '#c026d3', description: '۱۳ برنامه', filterFn: s => s.category.includes('سرگرمی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['سرگرمی', 'پشت‌صحنه', 'گوینده', 'مدرن', 'تعاملی'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'location', key: 'location', nameFa: 'موقعیت‌محور / خارج از استودیو', name: 'On-Location',
    color: '#92400e', description: '۱۲ برنامه', filterFn: s => s.category.includes('موقعیت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['موقعیت‌محور', 'بیرون از استودیو', 'میدانی', 'طبیعت', 'شهری'],
    searchFields: ['name', 'summary', 'category', 'materials'],
  },
  {
    id: 'digital', key: 'digital', nameFa: 'تاک‌شوی دیجیتال / اینترنتی', name: 'Digital',
    color: '#10b981', description: '۱۰ برنامه', filterFn: s => s.category.includes('دیجیتال'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['دیجیتال', 'اینترنتی', 'استریم', 'تعاملی', 'مدرن'],
    searchFields: ['name', 'summary', 'style', 'effects'],
  },
  {
    id: 'relationships', key: 'relationships', nameFa: 'تاک‌شوی روابط و تعارض', name: 'Relationships',
    color: '#be185d', description: '۸ برنامه', filterFn: s => s.category.includes('روابط'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.layout],
    presetTags: ['روابط', 'تعارض', 'خانوادگی', 'گفتگومحور', 'صمیمی'],
    searchFields: ['name', 'summary', 'style', 'layout'],
  },
  {
    id: 'radio', key: 'radio', nameFa: 'تاک‌شوی رادیویی / صوتی', name: 'Radio/Audio',
    color: '#5a6b4a', description: '۶ برنامه', filterFn: s => s.category.includes('رادیویی'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.effects],
    presetTags: ['رادیویی', 'صوتی', 'گفتگو', 'مدرن', 'استودیویی'],
    searchFields: ['name', 'summary', 'layout', 'effects'],
  },
  {
    id: 'human', key: 'human', nameFa: 'تاک‌شوی انسانی و داستان‌محور', name: 'Human Stories',
    color: '#0369a1', description: '۵ برنامه', filterFn: s => s.category.includes('انسانی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.materials],
    presetTags: ['انسانی', 'داستان‌محور', 'مصاحبه عمیق', 'صمیمی', 'مستندگونه'],
    searchFields: ['name', 'summary', 'style', 'materials'],
  },
  {
    id: 'psa', key: 'psa', nameFa: 'PSA (پیام خدمت عمومی)', name: 'Public Service Announcement',
    color: '#10b981', description: 'پیام‌های آگاهی‌بخش و خدمت عمومی',
    filterFn: s => s.category.includes('PSA') || s.category.includes('پیام خدمت'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['خدمت عمومی', 'آگاهی‌بخش', 'آموزشی', 'اجتماعی', 'کوتاه'],
    searchFields: ['name', 'summary', 'category', 'descriptionFa'],
  },
  {
    id: 'deepobs', key: 'deepobs', nameFa: 'پایش تحلیلی', name: 'Deep Observation',
    color: '#7c3aed', description: 'تحلیل و رصد عمیق برنامه‌ها',
    filterFn: s => s.category.includes('پایش تحلیلی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting, TAG_LIBRARY.materials],
    presetTags: ['تحلیلی', 'رصد عمیق', 'بررسی تخصصی', 'مقایسه‌ای', 'تفصیلی'],
    searchFields: ['name', 'summary', 'descriptionFa', 'materials'],
  },
  {
    id: 'funeral', key: 'funeral', nameFa: 'سوگواری و خاکسپاری', name: 'Funeral Coverage',
    color: '#64748b', description: 'پوشش خبری مراسم خاکسپاری و سوگواری شخصیت‌ها',
    filterFn: s => s.category.includes('خاکسپاری') || s.category.includes('سوگواری'),
    tags: [],
    presetTags: ['رسمی', 'مذهبی', 'دولتی', 'مردمی', 'سنتی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'war', key: 'war', nameFa: 'برنامه‌های جنگ و بحران', name: 'War & Conflict',
    color: '#991b1b', description: 'برنامه‌های تلویزیونی با موضوع جنگ و منازعات',
    filterFn: s => s.category.includes('جنگ') || s.category.includes('بحران'),
    tags: [],
    presetTags: ['مستند جنگ', 'تحلیل نظامی', 'خبری', 'بیانیه'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'debate', key: 'debate', nameFa: 'مناظرات انتخاباتی', name: 'Electoral Debates',
    color: '#1e40af', description: 'مناظرات و بحث‌های انتخاباتی',
    filterFn: s => s.category.includes('مناظره') || s.category.includes('انتخابات'),
    tags: [],
    presetTags: ['ریاست جمهوری', 'پارلمانی', 'محلی', 'حزبی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'ads', key: 'ads', nameFa: 'آگهی‌های تبلیغاتی', name: 'Advertisements',
    color: '#ea580c', description: 'تبلیغات و آگهی‌های تجاری',
    filterFn: s => s.category.includes('آگهی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.colors],
    presetTags: ['تبلیغاتی', 'تجاری', 'برندمحور', 'جذاب', 'کوتاه'],
    searchFields: ['name', 'summary', 'category', 'colors'],
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
  // Navigation history so every view can navigate back to the previous one
  const [viewStack, setViewStack] = useState<Array<{ view: typeof currentView; genre: Genre | null }>>([]);
  // Real authenticated user (null = logged out → show login screen)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Settings modal (admin only)
  const [showSettings, setShowSettings] = useState(false);
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
      />

      <DrawerMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentView={currentView}
        onNavigate={handleNavigate}
        onGenreSelect={handleGenreSelect}
        onLogout={handleLogout}
        onOpenSettings={() => { setShowSettings(true); setDrawerOpen(false); }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        talkShows={talkShows}
        genres={genres}
      />

      <main key={currentView} className={`animate-view-enter ${isMobile ? 'p-4 pt-20 pb-28' : 'p-8 pt-24'}`}>
        {currentView === 'dashboard' && <Dashboard onGenreClick={(g) => navigate('genre', g)} talkShows={talkShows} uploadedCount={uploadedShows.length} onAdd={() => { setPresetCategory(undefined); setPresetGenre(null); setEditingShow(null); navigate('add'); }} canEdit={canEdit} isAdmin={isAdmin} genres={genres} onAddGenre={handleAddGenre} />}
        {currentView === 'programs' && <ProgramsView talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} />}
        {currentView === 'genre' && selectedGenre && <ProgramsView genre={selectedGenre} talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} onAdd={() => handleAddFromGenre(selectedGenre)} />}
        {currentView === 'reports' && <ReportsView talkShows={talkShows} uploadedShows={uploadedShows} showToast={showToast} onExport={(shows, format) => setExportPreview({ shows, format })} />}
        {currentView === 'add' && canEdit && <AddEditView talkShows={talkShows} onSave={handleSaveShow} editingShow={editingShow} setEditingShow={setEditingShow} onDone={() => { setEditingShow(null); setSelectedGenre(null); setPresetCategory(undefined); setPresetGenre(null); setCurrentView('programs'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }} showToast={showToast} presetCategory={presetCategory} presetGenre={presetGenre} genres={genres} />}
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

      {/* Settings modal (admin only) — server URL, users, change password */}
      {showSettings && isAdmin && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          showToast={showToast}
          onLogout={handleLogout}
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
      setError('نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      onLogin(data.user);
    } catch (err: any) {
      setError(err?.message || 'ورود ناموفق بود');
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
              alt="بانک رسانه"
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
              نام کاربری
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
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#f0fdf4',
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
              رمز عبور
            </label>
            <div className="relative">
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
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  borderRadius: '12px',
                  padding: '12px 48px 12px 16px',
                  color: '#f0fdf4',
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
                aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                disabled={loading}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors"
                style={{ color: '#86efac', background: 'transparent' }}
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
                  <span>در حال ورود...</span>
                </>
              ) : (
                <>
                  <span>ورود به برنامه</span>
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
            نسخه ۲.۰.۰ • بانک اطلاعاتی برنامه‌های تلویزیونی
          </p>
          <p style={{ color: 'rgba(134, 239, 172, 0.45)' }} className="text-xs mt-2">
            نام کاربری پیش‌فرض: <span dir="ltr">admin</span> / رمز: <span dir="ltr">admin</span>
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
function TopAppBar({ onMenuClick, isMobile, currentView, onBack, canGoBack }: {
  onMenuClick: () => void;
  isMobile: boolean;
  currentView: string;
  onBack: () => void;
  canGoBack: boolean;
}) {
  const viewTitles: Record<string, string> = {
    dashboard: 'آرشیو تخصصی برنامه‌های تلویزیونی',
    programs: 'همهٔ برنامه‌ها',
    genre: 'برنامه‌های ژانر',
    reports: 'گزارش‌ها',
    add: 'افزودن / ویرایش برنامه',
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40"
      style={{
        background: 'linear-gradient(180deg, #0a1f14 0%, #0d2218 100%)',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(13, 124, 74, 0.1)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
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
          aria-label="باز کردن منو"
          className="flex flex-col justify-center items-center p-2.5 rounded-xl transition-all"
          style={{
            background: 'rgba(13, 124, 74, 0.08)',
            border: '1px solid rgba(13, 124, 74, 0.2)',
            color: '#0d7c4a',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(13, 124, 74, 0.08)',
            minWidth: '44px',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(13, 124, 74, 0.15)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(13, 124, 74, 0.08)';
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
            alt="بانک رسانه"
            width={isMobile ? 90 : 130}
            height={isMobile ? 24 : 34}
            priority
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(13, 124, 74, 0.25))',
              flexShrink: 0,
            }}
          />
          {!isMobile && (
            <div
              className="flex flex-col"
              style={{ borderRight: '1px solid rgba(13, 124, 74, 0.15)', paddingRight: '12px' }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '15px', textShadow: '0 1px 4px rgba(0,0,0,0.5)', lineHeight: 1.2 }}>
                {viewTitles[currentView] || 'بانک رسانه'}
              </span>
              <span style={{ color: '#8a8a7a', fontSize: '11px', marginTop: '2px' }}>
                نسخه ۲.۰.۰
              </span>
            </div>
          )}
        </div>

        {/* Left placeholder: back button (when there is history), else status badge */}
        <div style={{ minWidth: '44px', display: 'flex', justifyContent: 'flex-end' }}>
          {canGoBack ? (
            <button
              onClick={onBack}
              aria-label="بازگشت به صفحهٔ قبل"
              title="بازگشت به صفحهٔ قبل"
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
              {!isMobile && <span>بازگشت</span>}
            </button>
          ) : isMobile ? (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(13, 124, 74, 0.1)',
                color: '#0d7c4a',
                border: '1px solid rgba(13, 124, 74, 0.2)',
              }}
            >
              بانک رسانه
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
              <span style={{ color: '#5a6b4a', fontSize: '12px' }}>متصل</span>
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
  currentUser: User | null;
  isAdmin: boolean;
  talkShows: TalkShow[];
  genres?: Genre[];
}) {
  const [genresExpanded, setGenresExpanded] = useState(true);

  const navItems = [
    { key: 'dashboard', label: 'آرشیو', icon: 'home', desc: 'صفحهٔ اصلی و ژانرها' },
    { key: 'programs', label: 'همهٔ برنامه‌ها', icon: 'grid', desc: 'لیست کامل ۵۶۰ برنامه' },
    { key: 'add', label: 'افزودن برنامه', icon: 'plus', desc: 'افزودن یا ویرایش برنامه' },
    { key: 'reports', label: 'گزارش‌ها', icon: 'reports', desc: 'آمار و خروجی' },
  ] as const;

  // Don't render anything if not open — keeps DOM clean
  if (!open) return null;

  const roleLabel: Record<string, string> = {
    admin: 'مدیر سیستم',
    editor: 'ویراستار',
    viewer: 'بیننده',
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
          background: 'rgba(10, 25, 18, 0.85)',
          backdropFilter: 'blur(30px) saturate(160%)',
          WebkitBackdropFilter: 'blur(30px) saturate(160%)',
          backdropFilter: 'blur(30px) saturate(140%)',
          WebkitBackdropFilter: 'blur(30px) saturate(140%)',
          borderLeft: '1px solid rgba(13, 124, 74, 0.15)',
          boxShadow: '-16px 0 56px rgba(0, 0, 0, 0.1), inset 1px 0 0 rgba(255, 255, 255, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header — logo + close */}
        <div
          className="p-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.1)' }}
        >
          <Image
            src="/banke-rasane-logo.png"
            alt="بانک رسانه"
            width={130}
            height={34}
            priority
            style={{ filter: 'drop-shadow(0 2px 8px rgba(13, 124, 74, 0.25))' }}
          />
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#8a8a7a' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a8a7a'; }}
            title="بستن منو"
            aria-label="بستن منو"
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
                    color: '#0d7c4a',
                    boxShadow: '0 2px 8px rgba(13, 124, 74, 0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
                  } : {
                    border: '1px solid transparent',
                    color: '#1a2e1a',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(13, 124, 74, 0.06)';
                      e.currentTarget.style.color = '#0d7c4a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#1a2e1a';
                    }
                  }}
                >
                  <NavIcon name={item.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs" style={{ color: '#8a8a7a', marginTop: '2px' }}>{item.desc}</div>
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
              <span>ژانرها ({genres.length})</span>
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
                      style={{ color: '#1a2e1a' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${g.color}25`;
                        e.currentTarget.style.color = g.color;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#1a2e1a';
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                        style={{
                          backgroundColor: g.color,
                          boxShadow: `0 0 10px ${g.color}`,
                        }}
                      ></div>
                      <span className="text-sm flex-1 text-right truncate">{g.nameFa}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: `${g.color}30`, color: g.color }}
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
          className="p-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(13, 124, 74, 0.1)' }}
        >
          {currentUser && (
            <div
              className="mb-2 p-3 rounded-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(13, 124, 74, 0.12)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(13, 124, 74, 0.15) 0%, rgba(13, 124, 74, 0.05) 100%)',
                    color: '#0d7c4a',
                    border: '1px solid rgba(13, 124, 74, 0.3)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: '#0d7c4a' }} title={currentUser.username}>
                    {currentUser.name || currentUser.username}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                      style={{
                        background: currentUser.role === 'admin' ? 'rgba(220, 38, 38, 0.25)' : currentUser.role === 'editor' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(13, 124, 74, 0.25)',
                        color: currentUser.role === 'admin' ? '#fca5a5' : currentUser.role === 'editor' ? '#fcd34d' : '#0d7c4a',
                      }}
                    >
                      {roleLabel[currentUser.role] || currentUser.role}
                    </span>
                    <span className="text-xs" style={{ color: '#8a8a7a' }} dir="ltr">
                      @{currentUser.username}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings button — admin only */}
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full mb-1"
              style={{ color: '#1a2e1a' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(13, 124, 74, 0.08)';
                e.currentTarget.style.color = '#0d7c4a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#1a2e1a';
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-sm">⚙ تنظیمات</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full"
            style={{ color: '#1a2e1a' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#1a2e1a';
            }}
          >
            <NavIcon name="exit" />
            <span className="font-medium text-sm">خروج از حساب</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
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
              background: 'linear-gradient(180deg, #0a1f14 0%, #0d2218 100%)',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(26px) saturate(160%)',
              WebkitBackdropFilter: 'blur(26px) saturate(160%)',
              borderTop: '1px solid rgba(13, 124, 74, 0.15)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              paddingBottom: '32px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: '#1a2e1a' }}>ژانرها ({genres.length})</h3>
              <button
                onClick={() => setShowGenres(false)}
                className="p-2 rounded-lg"
                style={{ color: '#8a8a7a', background: 'rgba(255, 255, 255, 0.6)' }}
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
                        <div className="text-sm font-bold truncate" style={{ color: '#1a2e1a' }}>{g.nameFa}</div>
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
            background: 'linear-gradient(180deg, #0a1f14 0%, #0d2218 100%)',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            border: '1px solid rgba(13, 124, 74, 0.15)',
            borderRadius: '22px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            padding: '8px',
          }}
        >
          <MobileNavBtn label="منو" icon="menu" active={false} onClick={onOpenDrawer} highlight />
          <MobileNavBtn label="آرشیو" icon="home" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          <MobileNavBtn label="برنامه‌ها" icon="grid" active={currentView === 'programs'} onClick={() => onNavigate('programs')} />
          <MobileNavBtn label="ژانرها" icon="genre" active={showGenres} onClick={() => setShowGenres(!showGenres)} highlight />
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
        background: active ? 'linear-gradient(135deg, rgba(13, 124, 74, 0.18) 0%, rgba(13, 124, 74, 0.08) 100%)' : 'transparent',
        border: active ? '1px solid rgba(13, 124, 74, 0.35)' : '1px solid transparent',
        minWidth: '56px',
      }}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke={active ? '#0d7c4a' : highlight ? '#0d7c4a' : '#8a8a7a'}
        viewBox="0 0 24 24"
        style={{ filter: active ? 'drop-shadow(0 0 6px rgba(13, 124, 74, 0.4))' : 'none' }}
      >
        {icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
        {icon === 'grid' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
        {icon === 'genre' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
        {icon === 'plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
        {icon === 'exit' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
        {icon === 'menu' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
      </svg>
      <span className="text-xs font-medium" style={{ color: active ? '#10b981' : highlight ? '#0d7c4a' : '#8a8a7a' }}>
        {label}
      </span>
    </button>
  );
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ onGenreClick, talkShows, uploadedCount, onAdd, canEdit, isAdmin, genres = GENRES, onAddGenre }: {
  onGenreClick: (g: Genre) => void;
  talkShows: TalkShow[];
  uploadedCount: number;
  onAdd: () => void;
  canEdit: boolean;
  isAdmin?: boolean;
  genres?: Genre[];
  onAddGenre?: (g: Genre) => void;
}) {
  const [showAddGenre, setShowAddGenre] = useState(false);
  const stats = [
    { label: 'کل برنامه‌ها', value: talkShows.length, color: '#10b981', icon: 'film' },
    { label: 'ژانرها', value: genres.length, color: '#2563eb', icon: 'tag' },
    { label: 'آپلود شده در فضای مجازی', value: uploadedCount, color: '#7c3aed', icon: 'cloud' },
    { label: 'با تصویر', value: talkShows.filter(s => s.images && s.images.length > 0).length, color: '#db2777', icon: 'image' },
  ];

  return (
    <>
      <header className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl font-bold" style={{ color: '#1a2e1a' }}>آرشیو تخصصی برنامه‌های تلویزیونی</h1>
          <span
            className="text-sm px-3 py-1 rounded-full"
            style={{ background: 'rgba(13, 124, 74, 0.1)', color: '#0d7c4a' }}
          >
            بانک رسانه
          </span>
        </div>
        <p style={{ color: '#8a8a7a' }}>
          بانک اطلاعاتی {talkShows.length.toLocaleString('fa-IR')} برنامهٔ تلویزیونی در {genres.length} ژانر
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => {
          return (
            <div
              key={i}
              className="premium-card animate-card-enter"
              style={{
                animationDelay: `${i * 80}ms`,
                ['--card-accent-color' as string]: s.color,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${s.color}22`,
                    color: s.color,
                    border: `1px solid ${s.color}55`,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <StatIcon name={s.icon} />
                </div>
                <span className="text-sm font-medium" style={{ color: '#5a6b4a' }}>{s.label}</span>
              </div>
              <div className="text-3xl font-black" style={{ color: '#1a2e1a' }}>
                {s.value.toLocaleString('fa-IR')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>ژانرها</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onAddGenre && (
            <button
              onClick={() => setShowAddGenre(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'rgba(13, 124, 74, 0.12)',
                color: '#0d7c4a',
                border: '1px solid rgba(13, 124, 74, 0.3)',
              }}
            >
              + افزودن ژانر
            </button>
          )}
          {canEdit && (
            <button
              onClick={onAdd}
              className="btn-enter-premium text-sm"
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              + افزودن برنامه
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
            >
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
                    {count.toLocaleString('fa-IR')}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>برنامه</div>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1" style={{ color: '#ffffff' }}>{g.nameFa}</h3>
              <p className="text-sm mt-3" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>{g.description}</p>
              <div className="mt-4 flex items-center text-sm font-bold" style={{ color: g.color }}>
                مشاهده و جستجو
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

function StatIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
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
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterSize, setFilterSize] = useState('all');
  const [filterViewers, setFilterViewers] = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [islamicOnly, setIslamicOnly] = useState(false);
  const [serverSearchShows, setServerSearchShows] = useState<TalkShow[] | null>(null);
  const [serverSearchPage, setServerSearchPage] = useState(1);
  const [serverSearchMeta, setServerSearchMeta] = useState<{ total: number; totalPages: number; page: number } | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const canUseServerSearch = !genre && filterSize === 'all' && filterViewers === 'all' && filterStyle === 'all' && !islamicOnly;

  useEffect(() => {
    if (!search.trim() || !canUseServerSearch) {
      setServerSearchShows(null);
      setServerSearchMeta(null);
      setServerSearchPage(1);
      setServerSearchLoading(false);
      return;
    }
    let cancelled = false;
    setServerSearchShows(null);
    setServerSearchMeta(null);
    setServerSearchLoading(true);
    const timer = setTimeout(() => {
      api.searchShows({ query: search, page: serverSearchPage, limit: 30 })
        .then(result => {
          if (cancelled) return;
          if (result.pagination.total === 0) {
            // Preserve typo-tolerant local fallback when the indexed search has no hit.
            setServerSearchShows(null);
            setServerSearchMeta(null);
            return;
          }
          const localByNum = new Map(talkShows.map(show => [show.num, show]));
          setServerSearchShows(result.shows.map(show => localByNum.get(show.num) || (show as unknown as TalkShow)));
          setServerSearchMeta(result.pagination);
        })
        .catch(() => {
          if (!cancelled) { setServerSearchShows(null); setServerSearchMeta(null); }
        })
        .finally(() => { if (!cancelled) setServerSearchLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, serverSearchPage, canUseServerSearch, talkShows]);

  useEffect(() => { setServerSearchPage(1); }, [search]);

  const filteredShows = useMemo(() => {
    let shows = [...(search.trim() && canUseServerSearch && serverSearchShows !== null ? serverSearchShows : talkShows)];
    if (genre) shows = shows.filter(genre.filterFn);
    if (filterSize !== 'all') shows = shows.filter(s => s.size === filterSize);
    if (filterViewers !== 'all') shows = shows.filter(s => s.viewers === filterViewers);
    if (filterStyle !== 'all') shows = shows.filter(s => s.style === filterStyle);
    if (islamicOnly) shows = shows.filter(s => detectCountries(s).length > 0);
    if (search.trim()) {
      // Ranked, Persian-normalized search. Genre fields get a small relevance boost,
      // while common metadata is also searched to avoid hiding useful records.
      shows = rankSearchShows(
        shows,
        search,
        (genre?.searchFields || ['name', 'summary', 'category']) as string[],
      );
    }
    return shows;
  }, [talkShows, genre, search, filterSize, filterViewers, filterStyle, islamicOnly, canUseServerSearch, serverSearchShows]);

  const handleUploadSelected = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    onPublish(selectedShows);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handlePDF = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    onExport(selectedShows, 'pdf');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleExcel = () => {
    const selectedShows = filteredShows.filter(s => selectedIds.includes(s.num));
    onExport(selectedShows, 'excel');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const gc = genre?.color || '#10b981';

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#1a2e1a' }}>
          {genre ? genre.nameFa : 'همهٔ برنامه‌ها'}
        </h1>
        <p style={{ color: '#8a8a7a' }}>
          {filteredShows.length.toLocaleString('fa-IR')} برنامه
          {genre && ` • ${genre.description}`}
        </p>
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
                <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: '#1a2e1a' }}>{genre.nameFa}</h2>
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
              <p style={{ color: '#5a6b4a' }} className="text-sm mt-1">{genre.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & toolbar — mobile-friendly: full-width search, actions row, horizontally scrollable filter chips */}
      <div className="premium-glass p-3 sm:p-4 mb-6 space-y-3">
        {/* Search — full width on every screen size */}
        <div className="relative">
          <svg
            className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#8a8a7a' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`جستجو در ${genre ? genre.nameFa : 'همهٔ برنامه‌ها'}...`}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(13, 124, 74, 0.15)',
              borderRadius: '12px',
              padding: '11px 36px 11px 16px',
              width: '100%',
              fontFamily: 'inherit',
              color: '#1a2e1a',
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
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(13, 124, 74, 0.15)',
            }}
          >
            <button
              onClick={() => setView('grid')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'grid' ? { background: '#10b981', color: 'white' } : { color: '#5a6b4a' }}
              aria-label="نمایش شبکه‌ای"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'list' ? { background: '#10b981', color: 'white' } : { color: '#5a6b4a' }}
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
              background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
              color: 'white',
              border: '1px solid rgba(13, 124, 74, 0.5)',
            } : {
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#5a6b4a',
              border: '1px solid rgba(13, 124, 74, 0.15)',
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
                color: '#0d7c4a',
              } : {
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(13, 124, 74, 0.15)',
                color: '#5a6b4a',
              }}
            >
              {selectionMode ? `✓ انتخاب (${selectedIds.length.toLocaleString('fa-IR')})` : 'انتخاب چندتایی'}
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
              title="برای افزودن یا ویرایش برنامه‌ها با حساب مدیر یا ویراستار وارد شوید"
            >
              🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید
            </div>
          )}
        </div>

        {/* Filters — two horizontally scrollable rows (no chaotic wrapping on mobile) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm flex-shrink-0" style={{ color: '#8a8a7a' }}>اندازه:</span>
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
                  background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#5a6b4a',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm flex-shrink-0" style={{ color: '#8a8a7a' }}>سبک:</span>
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
                  background: 'linear-gradient(135deg, #0d7c4a 0%, #0a6b40 100%)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#5a6b4a',
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
              {selectedIds.length.toLocaleString('fa-IR')} برنامه انتخاب شده
            </span>
            <button
              onClick={handleUploadSelected}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)' }}
            >
              📱 انتشار در شبکه‌های اجتماعی
            </button>
            <button
              onClick={handlePDF}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            >
              📄 گزارش PDF
            </button>
            <button
              onClick={handleExcel}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
            >
              📊 گزارش Excel
            </button>
            <button
              onClick={() => { setSelectedIds([]); setSelectionMode(false); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122, 0.3)' }}
            >
              لغو
            </button>
          </div>
        )}
      </div>

      {serverSearchLoading && search.trim() && canUseServerSearch && (
        <div className="text-center py-3 text-sm" style={{ color: '#0d7c4a' }}>در حال جست‌وجو در آرشیو…</div>
      )}
      {filteredShows.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#8a8a7a' }}>
          <p>برنامه‌ای یافت نشد</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredShows.slice(0, 60).map(s => (
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
          {filteredShows.slice(0, 60).map(s => (
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

      {search.trim() && canUseServerSearch && serverSearchMeta && serverSearchMeta.totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" disabled={serverSearchPage <= 1 || serverSearchLoading}
            onClick={() => setServerSearchPage(page => Math.max(1, page - 1))}
            className="px-4 py-2 rounded-xl border disabled:opacity-40"
            style={{ borderColor: '#b7d8c2', color: '#0d7c4a' }}>قبلی</button>
          <span className="text-sm" style={{ color: '#5a6b4a' }}>
            صفحه {serverSearchMeta.page.toLocaleString('fa-IR')} از {serverSearchMeta.totalPages.toLocaleString('fa-IR')} • {serverSearchMeta.total.toLocaleString('fa-IR')} نتیجه
          </span>
          <button type="button" disabled={serverSearchPage >= serverSearchMeta.totalPages || serverSearchLoading}
            onClick={() => setServerSearchPage(page => Math.min(serverSearchMeta.totalPages, page + 1))}
            className="px-4 py-2 rounded-xl border disabled:opacity-40"
            style={{ borderColor: '#b7d8c2', color: '#0d7c4a' }}>بعدی</button>
        </div>
      ) : filteredShows.length > 60 ? (
        <div className="text-center mt-8" style={{ color: '#8a8a7a' }}>
          <p className="text-sm">نمایش ۶۰ برنامه از {filteredShows.length.toLocaleString('fa-IR')} • برای مشاهده همه، جستجو را فیلتر کنید</p>
        </div>
      ) : null}
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
        <div className="text-xs" style={{ color: '#8a8a7a' }}>شماره</div>
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
            <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>دربارهٔ برنامه</h4>
            <p style={{ color: '#5a6b4a', lineHeight: 1.8 }}>{show.descriptionFa}</p>
          </div>

          {/* Video links gallery */}
          {show.videos && show.videos.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>
                🎬 ویدیوهای برنامه
                <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
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
                          style={{ color: '#5a6b4a', direction: 'ltr', textAlign: 'left' }}
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
            <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>دسترسی مستقیم</h4>
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
                style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
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
              style={{ background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a', border: '1px solid rgba(13, 124, 74, 0.3)' }}
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
                  style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122, 0.3)' }}
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
            <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>مشخصات دکور و صحنه</h4>
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
              <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>خلاصهٔ دکور</h4>
              <p style={{ color: '#5a6b4a', lineHeight: 1.7 }}>{show.summary}</p>
            </div>
          )}

          {/* Tags section — user-defined tags + detected Islamic countries */}
          {((show.tags && show.tags.length > 0) || countries.length > 0 || show.country) && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>🏷 برچسب‌ها</h4>
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
                  <span className="text-xs font-bold" style={{ color: '#8a8a7a' }}>🌍 کشورهای شناسایی‌شده:</span>
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
                <div className="text-xs" style={{ color: '#8a8a7a' }}>
                  کشور مبدا (وارد شده): <strong style={{ color: '#1a2e1a' }}>{show.country}</strong>
                </div>
              )}
            </div>
          )}

          {/* 🔗 Related programs — computed from allShows via findRelated */}
          {related.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>🔗 برنامه‌های مرتبط</h4>
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
      <div className="text-xs font-bold mb-1" style={{ color: '#8a8a7a' }}>{label}</div>
      <div className="text-sm" style={{ color: '#1a2e1a' }}>{value || '—'}</div>
    </div>
  );
}

// ============================================
// ADD/EDIT VIEW
// ============================================
function AddEditView({ talkShows, onSave, editingShow, setEditingShow, onDone, showToast, presetCategory, presetGenre, genres = GENRES }: {
  talkShows: TalkShow[];
  onSave: (show: TalkShow, isEdit: boolean) => void;
  editingShow: TalkShow | null;
  setEditingShow: (s: TalkShow | null) => void;
  onDone: () => void;
  showToast: (msg: string) => void;
  presetCategory?: string;
  presetGenre?: Genre | null;
  genres?: Genre[];
}) {
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
      showToast('لینک IMDb یا ویکی‌پدیا را وارد کنید');
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
        showToast(`خطا: ${data.error}`);
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
        showToast('اطلاعات با موفقیت دریافت شد');
      }
    } catch (e) {
      showToast('خطا در دریافت اطلاعات');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = () => {
    if (!form.name) {
      showToast('نام برنامه الزامی است');
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
          {editingShow ? 'ویرایش برنامه' : 'افزودن برنامهٔ جدید'}
        </h1>
        <p style={{ color: '#8a8a7a' }}>
          {editingShow ? `ویرایش برنامهٔ شمارهٔ ${editingShow.num.toLocaleString('fa-IR')}` : 'فرم زیر را پر کنید'}
        </p>
      </header>

      <div className="premium-glass p-6 space-y-4">
        {/* Auto-fetch from IMDb/Wikipedia */}
        <div className="p-4 rounded-xl" style={{ background: 'rgba(13, 124, 74,0.06)', border: '1px solid rgba(13, 124, 74,0.15)' }}>
          <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>⚡ دریافت خودکار اطلاعات</h4>
          <p className="text-xs mb-3" style={{ color: '#8a8a7a' }}>
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
              {fetching ? '⏳ در حال دریافت...' : '⚡ دریافت'}
            </button>
          </div>
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
          <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>دربارهٔ برنامه (فارسی)</label>
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
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#1a2e1a',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>خلاصهٔ دکور</label>
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
            style={{ background: 'rgba(107, 143, 122, 0.15)', color: '#5a6b4a', border: '1px solid rgba(107, 143, 122, 0.3)' }}
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
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to the latest images array so async FileReader callbacks always see current state
  const imagesRef = useRef<string[]>(images);
  imagesRef.current = images;
  const MAX_IMAGES = 8;

  const addUrl = () => {
    if (!urlInput.trim()) return;
    if (images.length >= MAX_IMAGES) {
      showToast(`حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')} تصویر مجاز است`);
      return;
    }
    if (images.includes(urlInput.trim())) {
      showToast('این تصویر قبلاً اضافه شده');
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
      showToast(`فقط ${toAdd.length.toLocaleString('fa-IR')} تصویر اضافه شد (حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')})`);
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
        showToast(`خطا در خواندن فایل: ${file.name}`);
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
        <h4 className="font-bold" style={{ color: '#1a2e1a' }}>
          🖼 تصاویر برنامه
          <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
            ({images.length.toLocaleString('fa-IR')} از {MAX_IMAGES.toLocaleString('fa-IR')})
          </span>
        </h4>
        {images.length > 0 && (
          <span className="text-xs" style={{ color: '#0d7c4a' }}>تصویر اول = کاور</span>
        )}
      </div>

      {/* URL input + file upload */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          placeholder="لینک تصویر را اینجا بچسبانید..."
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
          <p className="text-xs" style={{ color: '#8a8a7a' }}>
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
      <h4 className="font-bold mb-3" style={{ color: '#1a2e1a' }}>
        🎬 ویدیوهای برنامه
        <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
          ({videos.length.toLocaleString('fa-IR')} ویدیو)
        </span>
      </h4>

      {/* Main YouTube search link field (auto-generated) */}
      <div className="mb-3">
        <label className="text-xs font-bold mb-1 block" style={{ color: '#5a6b4a' }}>لینک جستجوی یوتیوب (خودکار)</label>
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
          placeholder="لینک ویدیو (یوتیوب، آپارات، Vimeo، تلگرام و...) را بچسبانید"
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
      <h4 className="font-bold mb-2" style={{ color: '#1a2e1a' }}>
        🏷 برچسب‌ها
        <span className="text-xs font-normal mr-2" style={{ color: '#8a8a7a' }}>
          ({tags.length.toLocaleString('fa-IR')} برچسب)
        </span>
      </h4>
      <p className="text-xs mb-3" style={{ color: '#8a8a7a' }}>
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
          <div className="text-xs font-bold mb-2" style={{ color: '#5a6b4a' }}>برچسب‌های پیشنهادی این ژانر:</div>
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

function AddGenreModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (g: Genre) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(GENRE_COLOR_PRESETS[0]);

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
          <h2 className="text-xl font-bold" style={{ color: '#1a2e1a' }}>+ افزودن ژانر جدید</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#8a8a7a' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>نام ژانر *</label>
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
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>توضیحات</label>
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
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#1a2e1a',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#1a2e1a' }}>رنگ ژانر</label>
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
            <div className="text-xs font-bold mb-1" style={{ color: '#8a8a7a' }}>پیش‌نمایش:</div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              ></span>
              <strong style={{ color: '#1a2e1a' }}>{name || '—'}</strong>
            </div>
            <p className="text-xs mt-1" style={{ color: '#5a6b4a' }}>{description || 'توضیحات...'}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-enter-premium flex-1"
              style={{ opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
            >
              ✓ ذخیره ژانر
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
            setTimeout(() => { w.print(); }, 1000);
          }
        }
      } else {
        // Excel: generate CSV
        const headers = ['شماره', 'نام برنامه', 'دسته‌بندی', 'منبع', 'اندازه', 'تماشاگر', 'سبک', 'توضیحات'];
        const rows = shows.map((s, i) => [
          i + 1,
          s.name,
          (s.category || '').replace(/^\d+\.\s*/, ''),
          s.source || '',
          s.size || '',
          s.viewers || '',
          s.style || '',
          (s.descriptionFa || s.summary || '').substring(0, 200),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `banke-rasane-${Date.now()}.csv`;
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
                <div style={{ color: '#10b981', marginBottom: '10px', filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.5))' }}>
                  <svg viewBox="0 0 64 64" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block' }}>
                    <rect x="6" y="14" width="52" height="36" rx="4" />
                    <path d="M6 22h52M14 14v-4M50 14v-4M20 32l10 6-10 6z" />
                  </svg>
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
  const stats = {
    total: talkShows.length,
    text: talkShows.filter(s => s.source === 'متن').length,
    uploaded: uploadedShows.length,
  };

  const reports = [
    { id: 1, title: 'گزارش کامل همهٔ برنامه‌ها', type: 'pdf', count: stats.total, date: '۱۴۰۴/۰۸/۲۵' },
    { id: 2, title: 'گزارش برنامه‌های آپلود شده در فضای مجازی', type: 'excel', count: stats.uploaded, date: '۱۴۰۴/۰۸/۲۵' },
  ];

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#1a2e1a' }}>گزارش‌ها</h1>
        <p style={{ color: '#8a8a7a' }}>آمار و گزارش‌های بانک رسانه</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#10b981' }}>{stats.total.toLocaleString('fa-IR')}</div>
          <div style={{ color: '#5a6b4a' }} className="text-sm">کل برنامه‌ها</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#7c3aed' }}>{stats.uploaded.toLocaleString('fa-IR')}</div>
          <div style={{ color: '#5a6b4a' }} className="text-sm">آپلود شده</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#dc2626' }}>{stats.pdf.toLocaleString('fa-IR')}</div>
          <div style={{ color: '#5a6b4a' }} className="text-sm">ژانرها</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#2563eb' }}>{stats.web.toLocaleString('fa-IR')}</div>
          <div style={{ color: '#5a6b4a' }} className="text-sm">با تصویر</div>
        </div>
      </div>

      <div className="premium-glass overflow-hidden">
        <div className="p-5" style={{ borderBottom: '1px solid rgba(13, 124, 74, 0.1)' }}>
          <h3 className="font-bold" style={{ color: '#1a2e1a' }}>گزارش‌های موجود</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(13, 124, 74, 0.08)', borderBottom: '1px solid rgba(13, 124, 74, 0.2)' }}>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#5a6b4a' }}>#</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#5a6b4a' }}>عنوان</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: '#5a6b4a' }}>نوع</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#5a6b4a' }}>تعداد</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell" style={{ color: '#5a6b4a' }}>تاریخ</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#5a6b4a' }}>عملیات</th>
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
                <td className="p-4 text-sm" style={{ color: '#8a8a7a' }}>{(idx + 1).toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm font-medium" style={{ color: '#1a2e1a' }}>{r.title}</td>
                <td className="p-4 hidden sm:table-cell">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={r.type === 'pdf'
                      ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                      : { background: 'rgba(13, 124, 74, 0.15)', color: '#0d7c4a' }
                    }
                  >
                    {r.type === 'pdf' ? 'PDF' : 'Excel'}
                  </span>
                </td>
                <td className="p-4 text-sm" style={{ color: '#5a6b4a' }}>{r.count.toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm hidden sm:table-cell" style={{ color: '#8a8a7a' }}>{r.date}</td>
                <td className="p-4">
                  <button
                    className="text-sm hover:underline"
                    style={{ color: '#10b981' }}
                    onClick={() => {
                      let shows: TalkShow[] = [];
                      if (r.id === 1) shows = talkShows;
                      else if (r.id === 2) shows = talkShows.filter(s => uploadedShows.includes(s.num));
                      if (shows.length === 0) { showToast('برنامه‌ای برای این گزارش وجود ندارد'); return; }
                      onExport(shows, r.type === 'pdf' ? 'pdf' : 'excel');
                    }}
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
}: {
  currentUser: User;
  onClose: () => void;
  showToast: (msg: string) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<'server' | 'users' | 'password'>('server');

  const tabs = [
    { key: 'server' as const,   label: 'سرور',     icon: '🖥' },
    { key: 'users' as const,    label: 'کاربران',  icon: '👥' },
    { key: 'password' as const, label: 'رمز عبور', icon: '🔑' },
  ];

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
          background: 'rgba(255, 255, 255, 0.95)',
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ maxHeight: 'calc(90vh - 130px)' }}>
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
function SettingsUsersTab({ currentUser, showToast }: { currentUser: User; showToast: (msg: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', name: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (e: any) {
      setError(e?.message || 'خطا در بارگذاری کاربران');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  const roleLabel: Record<string, string> = { admin: 'مدیر', editor: 'ویراستار', viewer: 'بیننده' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#1a2e1a' }}>👥 مدیریت کاربران</h3>
        <p className="text-sm" style={{ color: '#8a8a7a' }}>
          افزودن، حذف یا تغییر نقش کاربران سیستم. نقش‌ها: مدیر (دسترسی کامل)، ویراستار (افزودن/ویرایش برنامه‌ها)، بیننده (فقط مشاهده).
        </p>
      </div>

      {/* Add new user form */}
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
            placeholder="رمز عبور (حداقل ۴ کاراکتر)"
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
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl flex items-center gap-3"
                style={{ background: 'white', border: '1px solid rgba(13, 124, 74, 0.15)' }}
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
                  <div className="font-bold text-sm" style={{ color: '#1a2e1a' }} title={u.username}>
                    {u.name || u.username}{' '}
                    {u.id === currentUser.id && (
                      <span className="text-xs font-normal" style={{ color: '#8a8a7a' }}>(شما)</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: '#8a8a7a' }} dir="ltr">@{u.username}</div>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => handleChangeRole(u, e.target.value)}
                  disabled={u.id === currentUser.id}
                  style={{
                    background: 'rgba(13, 124, 74, 0.05)',
                    border: '1px solid rgba(13, 124, 74, 0.2)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '13px',
                    color: '#1a2e1a',
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                    opacity: u.id === currentUser.id ? 0.6 : 1,
                  }}
                  title={u.id === currentUser.id ? 'نمی‌توانید نقش خودتان را تغییر دهید' : 'تغییر نقش'}
                >
                  <option value="viewer">بیننده</option>
                  <option value="editor">ویراستار</option>
                  <option value="admin">مدیر</option>
                </select>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={u.id === currentUser.id}
                  className="p-2 rounded-lg transition-colors flex-shrink-0"
                  style={{
                    color: u.id === currentUser.id ? 'rgba(107, 143, 122, 0.4)' : '#dc2626',
                    background: u.id === currentUser.id ? 'transparent' : 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                    opacity: u.id === currentUser.id ? 0.4 : 1,
                  }}
                  title={u.id === currentUser.id ? 'نمی‌توانید خودتان را حذف کنید' : `حذف ${u.username}`}
                  aria-label={`حذف کاربر ${u.username}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
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
    if (newPw.length < 4) {
      showToast('رمز جدید باید حداقل ۴ کاراکتر باشد');
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
