'use client';

import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import Image from 'next/image';
import { api, setApiBase, getApiBase, User } from '@/lib/api';

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
    color: '#00bcd4', description: 'همهٔ ۵۶۰ برنامه با تحلیل دکور و صحنه', filterFn: () => true,
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
    color: '#0097a7', description: '۱۰ برنامه', filterFn: s => s.category.includes('دیجیتال'),
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
    color: '#9CA3AF', description: '۶ برنامه', filterFn: s => s.category.includes('رادیویی'),
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
    color: '#0097a7', description: 'پیام‌های آگاهی‌بخش و خدمت عمومی',
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
    color: '#374151', description: 'پوشش خبری مراسم خاکسپاری و سوگواری شخصیت‌ها',
    filterFn: s => s.category.includes('خاکسپاری') || s.category.includes('سوگواری'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['رسمی', 'مذهبی', 'دولتی', 'مردمی', 'سنتی'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'war', key: 'war', nameFa: 'برنامه‌های جنگ و بحران', name: 'War & Conflict',
    color: '#991b1b', description: 'برنامه‌های تلویزیونی با موضوع جنگ و منازعات',
    filterFn: s => s.category.includes('جنگ') || s.category.includes('بحران') || s.category.includes('منازعه'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.effects],
    presetTags: ['مستند جنگ', 'تحلیل نظامی', 'خبری', 'بیانیه', 'مصاحبه'],
    searchFields: ['name', 'summary', 'descriptionFa'],
  },
  {
    id: 'debate', key: 'debate', nameFa: 'مناظرات انتخاباتی', name: 'Electoral Debates',
    color: '#1e40af', description: 'مناظرات و بحث‌های انتخاباتی',
    filterFn: s => s.category.includes('مناظره') || s.category.includes('انتخابات'),
    tags: [TAG_LIBRARY.layout, TAG_LIBRARY.viewers],
    presetTags: ['ریاست جمهوری', 'پارلمانی', 'محلی', 'حزبی', 'تلویزیونی'],
    searchFields: ['name', 'summary', 'descriptionFa', 'layout'],
  },
  {
    id: 'rural', key: 'rural', nameFa: 'برنامه‌های روستایی', name: 'Rural Programs',
    color: '#65a30d', description: 'برنامه‌های تلویزیونی حوزه روستا و کشاورزی',
    filterFn: s => s.category.includes('روستا') || s.category.includes('کشاورزی') || s.category.includes('دامداری') || s.category.includes('روستایی'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.elements],
    presetTags: ['کشاورزی', 'دامداری', 'گردشگری', 'زنان روستا', 'صنایع دستی', 'مهاجرت', 'آب‌آوری', 'محیط زیست'],
    searchFields: ['name', 'summary', 'descriptionFa', 'category'],
  },
  {
    id: 'prison', key: 'prison', nameFa: 'برنامه‌های حوزه زندان', name: 'Prison Programs',
    color: '#475569', description: 'برنامه‌های تلویزیونی با موضوع زندان و زندانیان',
    filterFn: s => s.category.includes('زندان') || s.category.includes('زندانی') || s.category.includes('بازپروری'),
    tags: [TAG_LIBRARY.style, TAG_LIBRARY.lighting],
    presetTags: ['مستند', 'درام', 'واقعیت‌نما', 'بازپروری', 'حقوقی', 'اجتماعی'],
    searchFields: ['name', 'summary', 'descriptionFa', 'category'],
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
  let primary = '#00bcd4';
  let secondary = '#0097a7';

  if (colorStr.includes('red') || colorStr.includes('قرمز')) primary = '#dc2626';
  else if (colorStr.includes('blue') || colorStr.includes('آبی')) primary = '#2563eb';
  else if (colorStr.includes('purple') || colorStr.includes('بنفش')) primary = '#7c3aed';
  else if (colorStr.includes('pink') || colorStr.includes('صورتی')) primary = '#db2777';
  else if (colorStr.includes('orange') || colorStr.includes('نارنجی')) primary = '#ea580c';
  else if (colorStr.includes('yellow') || colorStr.includes('زرد')) primary = '#f59e0b';
  else if (colorStr.includes('green') || colorStr.includes('سبز')) primary = '#00bcd4';
  else if (colorStr.includes('gold') || colorStr.includes('طلایی')) primary = '#b45309';
  else if (colorStr.includes('white') || colorStr.includes('سفید')) primary = '#102a43';

  if (colorStr.includes('wood') || colorStr.includes('چوب')) secondary = '#92400e';
  else if (colorStr.includes('dark') || colorStr.includes('تاریک')) secondary = '#0a1929';
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
  return { name: 'ویدیو', icon: '🎬', color: '#6B7280' };
}

// ============================================
// SHOW IMAGE GALLERY — displays all images for a show in modal
// ============================================
function ShowImageGallery({ images, showName }: { images: string[]; showName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>
        🖼 تصاویر برنامه
        <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
          ({images.length.toLocaleString('fa-IR')} تصویر)
        </span>
      </h4>

      {/* Main image */}
      <div
        className="rounded-xl overflow-hidden mb-3 relative cursor-pointer"
        style={{ aspectRatio: '16/9', background: '#f0f4f1', border: '1px solid #e0e8e4' }}
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
                border: idx === activeIdx ? '3px solid #00bcd4' : '2px solid #e0e8e4',
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

// ============================================
// i18n — Persian (default) / English UI strings.
// Program data (names, descriptions) stays in Persian; only chrome strings translate.
// ============================================
type Lang = 'fa' | 'en';

type StringKey =
  | 'app_title'
  | 'app_subtitle'
  | 'archive_title'
  | 'genres_section'
  | 'all_programs'
  | 'add_program'
  | 'search'
  | 'search_in'
  | 'reports'
  | 'settings'
  | 'logout'
  | 'dashboard'
  | 'bookmarks'
  | 'related_programs'
  | 'compare'
  | 'compare_mode'
  | 'compare_count'
  | 'multi_select'
  | 'multi_select_count'
  | 'grid_view'
  | 'list_view'
  | 'islamic'
  | 'has_image'
  | 'has_video'
  | 'programs_count'
  | 'no_programs'
  | 'no_programs_desc'
  | 'loading'
  | 'login'
  | 'login_btn'
  | 'username'
  | 'password'
  | 'show_password'
  | 'hide_password'
  | 'logging_in'
  | 'back'
  | 'menu'
  | 'close'
  | 'connected'
  | 'banke_rasane'
  | 'total_programs'
  | 'uploaded'
  | 'with_image'
  | 'version'
  | 'add_genre'
  | 'add_to_compare'
  | 'remove_from_compare'
  | 'add_to_bookmarks'
  | 'remove_from_bookmarks'
  | 'show_num'
  | 'about_program'
  | 'compare_two_programs'
  | 'clear_list'
  | 'close_btn'
  | 'difference'
  | 'help_diff'
  | 'program_first'
  | 'program_second'
  | 'field'
  | 'decor_programs'
  | 'preserved_genre'
  | 'genre_count_suffix'
  | 'no_access'
  | 'no_access_desc'
  | 'role_admin'
  | 'role_editor'
  | 'role_viewer'
  | 'settings_title'
  | 'page_x_of_y'
  | 'showing_x_y_of_z'
  | 'prev'
  | 'next'
  | 'cancel'
  | 'download'
  | 'total'
  | 'genre'
  | 'type'
  | 'date'
  | 'action'
  | 'title'
  | 'available_reports'
  | 'pdf'
  | 'excel'
  | 'all'
  | 'size_label'
  | 'style_label'
  | 'large_lux'
  | 'medium_std'
  | 'small_econ'
  | 'modern'
  | 'composite'
  | 'minimal'
  | 'classic'
  | 'switch_to_light'
  | 'switch_to_dark'
  | 'switch_to_en'
  | 'switch_to_fa'
  // ----- Added keys (full i18n) -----
  | 'enter_username_password'
  | 'login_failed'
  | 'default_user_hint'
  | 'nav_dashboard_desc'
  | 'nav_programs_desc'
  | 'nav_bookmarks_desc'
  | 'nav_add_desc'
  | 'nav_reports_desc'
  | 'dashboard_subtitle'
  | 'view_search'
  | 'islamic_only_desc'
  | 'has_image_only_desc'
  | 'has_video_only_desc'
  | 'view_only_desc'
  | 'selected'
  | 'publish_social'
  | 'pdf_report'
  | 'excel_report'
  | 'decor_classic_traditional'
  | 'decor_lux_decorative'
  | 'decor_unknown'
  | 'decor_neutral'
  | 'decor_warm'
  | 'decor_cold'
  | 'decor_dramatic'
  | 'with_audience'
  | 'without_audience'
  | 'program_no_label'
  | 'videos_of_program'
  | 'videos_count_suffix'
  | 'direct_access'
  | 'watch_on_youtube'
  | 'imdb_page'
  | 'wikipedia_page'
  | 'bookmarked'
  | 'bookmark_verb'
  | 'edit'
  | 'delete_program'
  | 'confirm_delete_question'
  | 'yes_delete'
  | 'decor_scene_specs'
  | 'category_label'
  | 'decor_style'
  | 'studio_size'
  | 'audience'
  | 'effects'
  | 'layout'
  | 'lighting'
  | 'decor_elements'
  | 'materials'
  | 'colors'
  | 'decor_summary'
  | 'tags_label'
  | 'detected_countries'
  | 'origin_country_entered'
  | 'program_name_required'
  | 'origin_country_label'
  | 'name_placeholder'
  | 'country_placeholder'
  | 'about_program_fa'
  | 'persian_description_placeholder'
  | 'decor_summary_placeholder'
  | 'program_images'
  | 'image_count_of'
  | 'first_image_cover'
  | 'compression_notice'
  | 'paste_image_url'
  | 'add_link'
  | 'upload_file'
  | 'no_images_yet'
  | 'cover_badge'
  | 'add_btn'
  | 'program_videos'
  | 'video_constraints'
  | 'select_video_file'
  | 'youtube_search_link'
  | 'paste_video_url'
  | 'add_video'
  | 'open_btn'
  | 'move_left'
  | 'move_right'
  | 'edit_program'
  | 'add_new_program'
  | 'edit_program_no'
  | 'fill_form_below'
  | 'auto_fetch_info'
  | 'auto_fetch_desc'
  | 'auto_fetch_placeholder'
  | 'fetching'
  | 'fetch_btn'
  | 'elements_placeholder'
  | 'materials_placeholder'
  | 'colors_placeholder'
  | 'update_btn'
  | 'add_program_btn'
  | 'add_genre_new'
  | 'genre_name_required'
  | 'genre_name_placeholder'
  | 'description_label'
  | 'description_placeholder'
  | 'genre_color_label'
  | 'preview_label'
  | 'save_genre'
  | 'publish_social_title'
  | 'select_platform'
  | 'post_preview'
  | 'direct_send_to'
  | 'bot_configured'
  | 'bot_config_required'
  | 'bot_settings'
  | 'configure_bot'
  | 'sending'
  | 'manual_publish_to'
  | 'select_platform_first'
  | 'bot_config_title'
  | 'bot_config_help_intro'
  | 'bot_config_help_tg'
  | 'bot_config_help_bale'
  | 'bot_config_help_admin'
  | 'platform_label'
  | 'telegram_label'
  | 'bale_label'
  | 'bot_token_label'
  | 'chat_id_label'
  | 'chat_id_help'
  | 'test_connection'
  | 'testing'
  | 'save_settings'
  | 'clear_btn'
  | 'hide_btn'
  | 'show_btn'
  | 'pdf_preview_title'
  | 'excel_preview_title'
  | 'program_count_label'
  | 'format_label'
  | 'report_title_full'
  | 'banke_rasane_archive'
  | 'programs_unit'
  | 'genre_category_unit'
  | 'report_structure'
  | 'section_exec_summary'
  | 'section_exec_summary_desc'
  | 'section_methodology'
  | 'section_methodology_desc'
  | 'section_stats_overview'
  | 'section_stats_overview_desc'
  | 'section_genre_analysis'
  | 'section_genre_analysis_desc'
  | 'section_decor_analysis'
  | 'section_decor_analysis_desc'
  | 'section_program_list'
  | 'section_program_list_desc'
  | 'section_conclusion'
  | 'section_conclusion_desc'
  | 'section_appendix'
  | 'section_appendix_desc'
  | 'sample_program_card'
  | 'sample_program'
  | 'identifier_label'
  | 'excel_banke_rasane'
  | 'name_col'
  | 'category_col'
  | 'generating'
  | 'download_file'
  | 'pdf_help_text'
  | 'print_dialog_help'
  | 'banke_rasane_stats_reports'
  | 'no_programs_for_report'
  | 'system_settings_title'
  | 'close_settings'
  | 'tab_server'
  | 'tab_users'
  | 'tab_password'
  | 'tab_audit'
  | 'api_server_url'
  | 'api_server_desc'
  | 'save_address'
  | 'server_help'
  | 'users_management'
  | 'users_management_desc'
  | 'add_new_user'
  | 'username_placeholder'
  | 'display_name_optional'
  | 'password_placeholder_min'
  | 'create_user'
  | 'creating'
  | 'current_users'
  | 'change_password_title'
  | 'change_password_desc'
  | 'current_account'
  | 'current_password'
  | 'new_password'
  | 'confirm_new_password'
  | 'password_mismatch'
  | 'change_password_btn'
  | 'audit_log_title'
  | 'audit_log_desc'
  | 'refresh'
  | 'action_create'
  | 'action_update'
  | 'action_delete'
  | 'program_hash'
  | 'program_created_log'
  | 'program_deleted_log'
  | 'field_log'
  | 'no_changes_recorded'
  | 'loading_users'
  | 'loading_history'
  | 'error_loading_users'
  | 'error_loading_history'
  | 'cannot_delete_self'
  | 'cannot_change_role_self'
  | 'help_label'
  | 'clear_compare_list'
  | 'values_differ'
  | 'name_program'
  | 'connection_ok'
  | 'connection_invalid_response'
  | 'connection_error'
  | 'server_url_saved'
  | 'user_created_toast'
  | 'user_deleted_toast'
  | 'user_role_changed_toast'
  | 'role_changed_self_toast'
  | 'fill_three_fields'
  | 'password_min_length'
  | 'passwords_dont_match'
  | 'password_must_differ'
  | 'password_changed_toast'
  | 'error_changing_password'
  | 'fetch_imdb_wiki_prompt'
  | 'fetch_error_toast'
  | 'fetch_success_toast'
  | 'name_required_toast'
  | 'max_images_toast'
  | 'image_duplicate_toast'
  | 'images_added_partial_toast'
  | 'image_compress_error_toast'
  | 'fetch_failed_toast'
  | 'delete_user_confirm'
  | 'tags_hint'
  | 'tags_placeholder'
  | 'preset_tags_hint'
  | 'clear_all'
  | 'banke_rasane_brand'
  | 'bot_token_required'
  | 'bot_test_ok'
  | 'bot_test_invalid'
  | 'bot_test_network_error'
  | 'bot_config_required_toast'
  | 'post_sent_to'
  | 'post_send_failed'
  | 'post_send_network_error'
  | 'edit_field'
  | 'archive_intro_subtitle'
  | 'archive_comprehensive_report'
  | 'report_sample_card_intro'
  | 'full_report_detailed_first'
  | 'social_card_brand'
  | 'social_card_programs_count'
  | 'social_card_more_count'
  | 'genre_preview_default'
  | 'genre_default_desc';

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  fa: {
    app_title: 'آرشیو تخصصی برنامه‌های تلویزیونی',
    app_subtitle: 'بانک اطلاعاتی برنامه‌های تلویزیونی',
    archive_title: 'آرشیو تخصصی برنامه‌های تلویزیونی',
    genres_section: 'ژانرها',
    all_programs: 'همهٔ برنامه‌ها',
    add_program: 'افزودن برنامه',
    search: 'جستجو',
    search_in: 'جستجو در',
    reports: 'گزارش‌ها',
    settings: 'تنظیمات',
    logout: 'خروج',
    dashboard: 'آرشیو',
    bookmarks: 'برنامه‌های نشان‌شده',
    related_programs: 'برنامه‌های مرتبط',
    compare: 'مقایسه',
    compare_mode: 'حالت مقایسه',
    compare_count: 'مقایسه',
    multi_select: 'انتخاب چندتایی',
    multi_select_count: 'انتخاب',
    grid_view: 'نمایش شبکه‌ای',
    list_view: 'نمایش لیستی',
    islamic: 'اسلامی',
    has_image: 'با تصویر',
    has_video: 'با ویدیو',
    programs_count: 'برنامه',
    no_programs: 'برنامه‌ای یافت نشد',
    no_programs_desc: 'با فیلترهای فعلی برنامه‌ای موجود نیست. فیلترها را تغییر دهید یا واژهٔ دیگری جستجو کنید.',
    loading: 'در حال بارگذاری...',
    login: 'ورود به برنامه',
    login_btn: 'ورود به برنامه',
    username: 'نام کاربری',
    password: 'رمز عبور',
    show_password: 'نمایش رمز',
    hide_password: 'پنهان کردن رمز',
    logging_in: 'در حال ورود...',
    back: 'بازگشت',
    menu: 'منو',
    close: 'بستن',
    connected: 'متصل',
    banke_rasane: 'بانک رسانه',
    total_programs: 'کل برنامه‌ها',
    uploaded: 'آپلود شده',
    with_image: 'با تصویر',
    version: 'نسخه ۲.۰.۰',
    add_genre: 'افزودن ژانر',
    add_to_compare: 'افزودن به مقایسه',
    remove_from_compare: 'حذف از مقایسه',
    add_to_bookmarks: 'افزودن به نشان‌شده‌ها',
    remove_from_bookmarks: 'حذف از نشان‌شده‌ها',
    show_num: 'شماره',
    about_program: 'دربارهٔ برنامه',
    compare_two_programs: 'مقایسهٔ دو برنامه',
    clear_list: 'پاک کردن',
    close_btn: 'بستن',
    difference: 'تفاوت',
    help_diff: 'ردیف‌هایی که با نشانگر «تفاوت» خروجی‌دار شده‌اند، در دو برنامه متفاوت هستند. مقادیر مشابه بدون تغییر باقی می‌مانند.',
    program_first: 'برنامهٔ اول',
    program_second: 'برنامهٔ دوم',
    field: 'فیلد',
    decor_programs: 'دکور برنامه‌ها',
    preserved_genre: 'ژانر',
    genre_count_suffix: 'برنامه',
    no_access: 'دسترسی غیرمجاز',
    no_access_desc: 'شما اجازهٔ افزودن یا ویرایش برنامه‌ها را ندارید. برای دسترسی کامل با حساب مدیر یا ویراستار وارد شوید.',
    role_admin: 'مدیر سیستم',
    role_editor: 'ویراستار',
    role_viewer: 'بیننده',
    settings_title: 'تنظیمات سیستم',
    page_x_of_y: 'صفحهٔ',
    showing_x_y_of_z: 'نمایش',
    prev: 'قبلی',
    next: 'بعدی',
    cancel: 'لغو',
    download: 'دانلود',
    total: 'کل',
    genre: 'ژانرها',
    type: 'نوع',
    date: 'تاریخ',
    action: 'عملیات',
    title: 'عنوان',
    available_reports: 'گزارش‌های موجود',
    pdf: 'PDF',
    excel: 'Excel',
    all: 'همه',
    size_label: 'اندازه:',
    style_label: 'سبک:',
    large_lux: 'بزرگ/لوکس',
    medium_std: 'متوسط',
    small_econ: 'کوچک',
    modern: 'مدرن',
    composite: 'ترکیبی',
    minimal: 'مینیمال',
    classic: 'کلاسیک',
    switch_to_light: 'تغییر به حالت روشن',
    switch_to_dark: 'تغییر به حالت تیره',
    switch_to_en: 'Switch to English',
    switch_to_fa: 'تغییر به فارسی',
    // ----- Added fa translations -----
    enter_username_password: 'نام کاربری و رمز عبور را وارد کنید',
    login_failed: 'ورود ناموفق بود',
    default_user_hint: 'نام کاربری پیش‌فرض: ',
    nav_dashboard_desc: 'صفحهٔ اصلی و ژانرها',
    nav_programs_desc: 'لیست کامل برنامه‌ها',
    nav_bookmarks_desc: 'برنامه‌هایی که نشان کرده‌اید',
    nav_add_desc: 'افزودن یا ویرایش برنامه',
    nav_reports_desc: 'آمار و خروجی',
    dashboard_subtitle: 'بانک اطلاعاتی {n} برنامهٔ تلویزیونی در {g} ژانر',
    view_search: 'مشاهده و جستجو',
    islamic_only_desc: 'فقط برنامه‌های مرتبط با کشورهای اسلامی',
    has_image_only_desc: 'فقط برنامه‌های دارای تصویر',
    has_video_only_desc: 'فقط برنامه‌های دارای ویدیو',
    view_only_desc: 'فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید',
    selected: 'برنامه انتخاب شده',
    publish_social: 'انتشار در شبکه‌های اجتماعی',
    pdf_report: 'گزارش PDF',
    excel_report: 'گزارش Excel',
    decor_classic_traditional: 'کلاسیک/سنتی',
    decor_lux_decorative: 'فاخر/تزئینی',
    decor_unknown: 'نامشخص',
    decor_neutral: 'خنثی',
    decor_warm: 'گرم',
    decor_cold: 'سرد',
    decor_dramatic: 'دراماتیک',
    with_audience: 'با تماشاگر',
    without_audience: 'بدون تماشاگر',
    program_no_label: 'برنامهٔ شمارهٔ',
    videos_of_program: 'ویدیوهای برنامه',
    videos_count_suffix: 'ویدیو',
    direct_access: 'دسترسی مستقیم',
    watch_on_youtube: 'تماشا در یوتیوب',
    imdb_page: 'صفحهٔ IMDb',
    wikipedia_page: 'ویکی‌پدیا',
    bookmarked: 'نشان‌شده',
    bookmark_verb: 'نشان کردن',
    edit: 'ویرایش',
    delete_program: 'حذف برنامه',
    confirm_delete_question: 'این برنامه حذف شود؟ (قابل بازگشت نیست)',
    yes_delete: 'بله، حذف کن',
    decor_scene_specs: 'مشخصات دکور و صحنه',
    category_label: 'دسته‌بندی',
    decor_style: 'سبک دکور',
    studio_size: 'اندازهٔ استودیو',
    audience: 'تماشاگر',
    effects: 'جلوه‌ها',
    layout: 'چیدمان',
    lighting: 'نورپردازی',
    decor_elements: 'عناصر دکور',
    materials: 'مواد',
    colors: 'رنگ‌آمیزی',
    decor_summary: 'خلاصهٔ دکور',
    tags_label: 'برچسب‌ها',
    detected_countries: 'کشورهای شناسایی‌شده:',
    origin_country_entered: 'کشور مبدا (وارد شده):',
    program_name_required: 'نام برنامه *',
    origin_country_label: 'کشور مبدا',
    name_placeholder: 'مثلاً: BBC Breakfast',
    country_placeholder: 'مثلاً: ایران، ترکیه',
    about_program_fa: 'دربارهٔ برنامه (فارسی)',
    persian_description_placeholder: 'توضیحات فارسی دربارهٔ برنامه — چه برنامه‌ای است، چه محتوایی دارد...',
    decor_summary_placeholder: 'توضیحات کامل دکور و صحنهٔ برنامه...',
    program_images: 'تصاویر برنامه',
    image_count_of: 'از',
    first_image_cover: 'تصویر اول = کاور',
    compression_notice: '📐 تصاویر آپلودی به‌صورت خودکار به حداکثر عرض ۱۲۸۰ پیکسل تغییر اندازه و با کیفیت JPEG ۸۰٪ فشرده می‌شوند.',
    paste_image_url: 'لینک تصویر را اینجا بچسبانید...',
    add_link: 'افزودن لینک',
    upload_file: 'آپلود فایل',
    no_images_yet: 'هنوز تصویری اضافه نشده. می‌تونید لینک بچسبانید یا فایل آپلود کنید.',
    cover_badge: 'کاور',
    add_btn: 'افزودن',
    program_videos: 'ویدیوهای برنامه',
    video_constraints: '🎞 ویدیوهای مستقیم: حداکثر ۳۰ ثانیه و ۵ مگابایت. ویدیوهای بلندتر را روی یوتیوب/آپارات بارگذاری کرده و لینک اضافه کنید.',
    select_video_file: '🎞 انتخاب فایل ویدیو',
    youtube_search_link: 'لینک جستجوی یوتیوب (خودکار)',
    paste_video_url: 'لینک ویدیو (یوتیوب، آپارات، Vimeo، تلگرام و...) را بچسبانید',
    add_video: 'افزودن ویدیو',
    open_btn: 'باز کردن',
    move_left: 'به چپ',
    move_right: 'به راست',
    edit_program: 'ویرایش برنامه',
    add_new_program: 'افزودن برنامهٔ جدید',
    edit_program_no: 'ویرایش برنامهٔ شمارهٔ {n}',
    fill_form_below: 'فرم زیر را پر کنید',
    auto_fetch_info: '⚡ دریافت خودکار اطلاعات',
    auto_fetch_desc: 'لینک IMDb یا ویکی‌پدیا برنامه را وارد کنید تا نام، توضیحات، تصویر و سایر اطلاعات خودکار دریافت شود.',
    auto_fetch_placeholder: 'https://www.imdb.com/title/... یا https://fa.wikipedia.org/...',
    fetching: '⏳ در حال دریافت...',
    fetch_btn: '⚡ دریافت',
    elements_placeholder: 'مثلاً: plants, screens/monitors',
    materials_placeholder: 'مثلاً: wood, glass, metal',
    colors_placeholder: 'مثلاً: red, blue, white',
    update_btn: '✓ بروزرسانی',
    add_program_btn: '+ افزودن برنامه',
    add_genre_new: '+ افزودن ژانر جدید',
    genre_name_required: 'نام ژانر *',
    genre_name_placeholder: 'مثلاً: مستند، انیمیشن، کودک...',
    description_label: 'توضیحات',
    description_placeholder: 'توضیح کوتاه دربارهٔ این ژانر...',
    genre_color_label: 'رنگ ژانر',
    preview_label: 'پیش‌نمایش:',
    save_genre: '✓ ذخیره ژانر',
    publish_social_title: '📱 انتشار در شبکه‌های اجتماعی',
    select_platform: 'انتخاب پلتفرم',
    post_preview: 'پیش‌نمایش پست',
    direct_send_to: '📡 ارسال مستقیم به {platform}',
    bot_configured: 'ربات {platform} پیکربندی شده — مقصد: {chatId}',
    bot_config_required: 'برای ارسال مستقیم، ابتدا توکن ربات و شناسهٔ کانال را وارد کنید',
    bot_settings: '⚙ تنظیمات ربات',
    configure_bot: '＋ پیکربندی ربات',
    sending: '⏳ در حال ارسال...',
    manual_publish_to: '📤 انتشار دستی در {platform}',
    select_platform_first: 'ابتدا پلتفرم را انتخاب کنید',
    bot_config_title: '⚙ تنظیمات ربات انتشار',
    bot_config_help_intro: 'برای ارسال مستقیم پست‌ها به کانال یا گروه، یک ربات بسازید و آن را ادمین مقصد کنید:',
    bot_config_help_tg: '• تلگرام: ربات @BotFather → /newbot',
    bot_config_help_bale: '• بله: ربات @BotFather@ → ساخت ربات جدید',
    bot_config_help_admin: '• سپس ربات را به کانال/گروه ادمین کنید',
    platform_label: 'پلتفرم',
    telegram_label: 'تلگرام',
    bale_label: 'بله',
    bot_token_label: 'توکن ربات (Bot Token)',
    chat_id_label: 'شناسهٔ مقصد (Chat ID)',
    chat_id_help: 'برای کانال: نام کاربری کانال (مثل @mychannel) یا Chat ID عددی. برای چت خصوصی: Chat ID عددی شما.',
    test_connection: '🔍 تست اتصال',
    testing: '⏳ در حال بررسی...',
    save_settings: '✓ ذخیره تنظیمات',
    clear_btn: '🗑 پاک کردن',
    hide_btn: '🙈 پنهان',
    show_btn: '👁 نمایش',
    pdf_preview_title: '📄 پیش‌نمایش گزارش PDF',
    excel_preview_title: '📊 پیش‌نمایش گزارش Excel',
    program_count_label: 'تعداد برنامه‌ها',
    format_label: 'فرمت',
    report_title_full: 'گزارش جامع آرشیو برنامه‌های تلویزیونی',
    banke_rasane_archive: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
    programs_unit: 'برنامه',
    genre_category_unit: 'دستهٔ ژانری',
    report_structure: 'ساختار گزارش (۸ بخش) — هر بخش شامل توضیحات کامل',
    section_exec_summary: 'خلاصه اجرایی',
    section_exec_summary_desc: 'مرور کلی آرشیو، حجم داده‌ها، یافته‌های کلیدی و نکات مهم برای تصمیم‌گیرندگان',
    section_methodology: 'روش جمع‌آوری داده',
    section_methodology_desc: 'توضیح منابع داده، فرایند طبقه‌بندی ژانری و رویکرد ترکیبی',
    section_stats_overview: 'نمای آماری کلی',
    section_stats_overview_desc: '۴ کارت آماری + ۵ نمودار میله‌ای: اندازه استودیو، سبک دکور، تماشاگر، نورپردازی، چیدمان',
    section_genre_analysis: 'تحلیل توزیع ژانرها',
    section_genre_analysis_desc: 'نمودار کامل توزیع + معرفی تفصیلی هر دسته با شمارش، درصد، و برنامه‌های شاخص',
    section_decor_analysis: 'تحلیل دکور و صحنه',
    section_decor_analysis_desc: '۴ نمودار: عناصر پرتکرار صحنه، مصالح، طیف رنگی، نورپردازی + یافته‌های تحلیلی',
    section_program_list: 'فهرست تفصیلی برنامه‌ها',
    section_program_list_desc: 'کارت کامل برای هر برنامه: تصویر، توضیحات فارسی، تگ‌ها، مشخصات دکور، خلاصه',
    section_conclusion: 'نتیجه‌گیری و پیشنهادها',
    section_conclusion_desc: 'جمع‌بندی یافته‌ها + ۵ پیشنهاد اجرایی + بخش امضا و تاریخ',
    section_appendix: 'پیوست: نمایهٔ الفبایی',
    section_appendix_desc: 'فهرست کامل همهٔ برنامه‌ها به ترتیب الفبایی با شماره و دستهٔ ژانری',
    sample_program_card: 'نمونه کارت برنامه (از بخش ۶)',
    sample_program: 'نمونه برنامه',
    identifier_label: 'شناسه:',
    excel_banke_rasane: 'بانک رسانه — خروجی Excel',
    name_col: 'نام',
    category_col: 'دسته',
    generating: '⏳ در حال تولید...',
    download_file: '⬇ دانلود فایل {format}',
    pdf_help_text: 'گزارش شامل ۸ بخش است: صفحهٔ عنوان، فهرست مطالب، خلاصهٔ اجرایی، روش تحقیق، نمای آماری، تحلیل ژانرها، تحلیل دکور، و معرفی تفصیلی برنامه‌ها.',
    print_dialog_help: 'پس از کلیک روی دانلود، پنجره چاپ باز می‌شود — مقاس «A4» و «Save as PDF» را انتخاب کنید.',
    banke_rasane_stats_reports: 'آمار و گزارش‌های بانک رسانه',
    no_programs_for_report: 'برنامه‌ای برای این گزارش وجود ندارد',
    system_settings_title: '⚙ تنظیمات سیستم',
    close_settings: 'بستن تنظیمات',
    tab_server: 'سرور',
    tab_users: 'کاربران',
    tab_password: 'رمز عبور',
    tab_audit: 'تاریخچه',
    api_server_url: '🖥 آدرس سرور API',
    api_server_desc: 'آدرس سرویس API که این برنامه به آن متصل می‌شود. پیش‌فرض:',
    save_address: '✓ ذخیره آدرس',
    server_help: 'راهنما: آدرس وارد شده باید ریشهٔ سرویس API باشد (بدون مسیرهای /api/...). اگر از گیتوی Caddy استفاده می‌کنید، می‌توانید آدرس نسبی وارد کنید. پس از ذخیره، توکن فعلی شما معتبر می‌ماند.',
    users_management: '👥 مدیریت کاربران',
    users_management_desc: 'افزودن، حذف یا تغییر نقش کاربران سیستم. نقش‌ها: مدیر (دسترسی کامل)، ویراستار (افزودن/ویرایش برنامه‌ها)، بیننده (فقط مشاهده).',
    add_new_user: '＋ افزودن کاربر جدید',
    username_placeholder: 'نام کاربری',
    display_name_optional: 'نام نمایشی (اختیاری)',
    password_placeholder_min: 'رمز عبور (حداقل ۴ کاراکتر)',
    create_user: '＋ ایجاد کاربر',
    creating: '⏳ در حال ایجاد...',
    current_users: 'کاربران فعلی',
    change_password_title: '🔑 تغییر رمز عبور',
    change_password_desc: 'رمز عبور خود را تغییر دهید. پس از تغییر، تمام نشست‌های فعال شما باطل شده و باید دوباره وارد شوید.',
    current_account: '👤 حساب فعلی:',
    current_password: 'رمز فعلی',
    new_password: 'رمز جدید',
    confirm_new_password: 'تکرار رمز جدید',
    password_mismatch: '⚠ رمز جدید و تأیید آن یکسان نیستند',
    change_password_btn: '✓ تغییر رمز عبور',
    audit_log_title: '📜 تاریخچه تغییرات',
    audit_log_desc: 'گزارش اخیر افزودن، ویرایش و حذف برنامه‌ها به همراه کاربر انجام‌دهنده و زمان دقیق.',
    refresh: '↻ بازخوانی',
    action_create: 'افزودن',
    action_update: 'ویرایش',
    action_delete: 'حذف',
    program_hash: 'برنامهٔ #',
    program_created_log: 'برنامهٔ «{name}» ایجاد شد.',
    program_deleted_log: 'برنامهٔ «{name}» حذف شد.',
    field_log: 'فیلد',
    no_changes_recorded: 'هیچ تغییری ثبت نشده است.',
    loading_users: 'در حال بارگذاری...',
    loading_history: 'در حال بارگذاری...',
    error_loading_users: 'خطا در بارگذاری کاربران',
    error_loading_history: 'خطا در بارگذاری تاریخچه',
    cannot_delete_self: 'نمی‌توانید حساب خودتان را حذف کنید',
    cannot_change_role_self: 'نمی‌توانید نقش خودتان را تغییر دهید',
    help_label: 'راهنما:',
    clear_compare_list: 'پاک کردن فهرست مقایسه',
    values_differ: 'مقدار در دو برنامه متفاوت است',
    name_program: 'نام برنامه',
    connection_ok: 'اتصال برقرار شد ✓',
    connection_invalid_response: 'پاسخ نامعتبر: {body}',
    connection_error: 'خطا در اتصال: {msg}',
    server_url_saved: 'آدرس سرور ذخیره شد. برای اعمال کامل، صفحه را بارگذاری مجدد کنید.',
    user_created_toast: 'کاربر «{name}» ساخته شد',
    user_deleted_toast: 'کاربر حذف شد',
    user_role_changed_toast: 'نقش «{name}» به {role} تغییر کرد',
    role_changed_self_toast: 'نمی‌توانید نقش خودتان را تغییر دهید',
    fill_three_fields: 'هر سه فیلد را پر کنید',
    password_min_length: 'رمز جدید باید حداقل ۴ کاراکتر باشد',
    passwords_dont_match: 'رمز جدید و تأیید آن یکسان نیستند',
    password_must_differ: 'رمز جدید باید با رمز فعلی متفاوت باشد',
    password_changed_toast: 'رمز با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.',
    error_changing_password: 'خطا در تغییر رمز',
    fetch_imdb_wiki_prompt: 'لینک IMDb یا ویکی‌پدیا را وارد کنید',
    fetch_error_toast: 'خطا در دریافت اطلاعات',
    fetch_success_toast: 'اطلاعات با موفقیت دریافت شد',
    name_required_toast: 'نام برنامه الزامی است',
    max_images_toast: 'حداکثر {n} تصویر مجاز است',
    image_duplicate_toast: 'این تصویر قبلاً اضافه شده',
    images_added_partial_toast: 'فقط {added} تصویر اضافه شد (حداکثر {max})',
    image_compress_error_toast: 'خطا در فشرده‌سازی: {name}',
    fetch_failed_toast: 'خطا: {msg}',
    delete_user_confirm: 'کاربر «{name}» حذف شود؟',
    tags_hint: 'برچسب‌ها را با کاما (، یا ,) جدا کنید — مثلاً: مدرن، گرم، چوبی',
    tags_placeholder: 'مدرن، گرم، چوبی...',
    preset_tags_hint: 'برچسب‌های پیشنهادی این ژانر:',
    clear_all: 'پاک کردن همه',
    banke_rasane_brand: 'بانک رسانه',
    bot_token_required: 'توکن را وارد کنید',
    bot_test_ok: '✅ ربات «@{name}» شناسایی شد',
    bot_test_invalid: '❌ توکن نامعتبر',
    bot_test_network_error: '❌ خطای شبکه',
    bot_config_required_toast: 'ابتدا تنظیمات ربات را وارد کنید',
    post_sent_to: '✅ پست به {platform} ارسال شد',
    post_send_failed: '❌ {msg}',
    post_send_network_error: '❌ خطای شبکه هنگام ارسال',
    edit_field: 'ویرایش',
    archive_intro_subtitle: '{n} برنامهٔ تلویزیونی در {g} ژانر',
    archive_comprehensive_report: 'گزارش جامع آرشیو برنامه‌های تلویزیونی',
    report_sample_card_intro: 'نمونه کارت برنامه (از بخش ۶)',
    full_report_detailed_first: 'در گزارش کامل، ۸۰ برنامهٔ نخست به‌صورت تفصیلی و همهٔ {n} برنامه در نمایهٔ الفبایی',
    social_card_brand: 'بانک رسانه',
    social_card_programs_count: '{n} برنامهٔ منتخب',
    social_card_more_count: 'و {n} برنامهٔ دیگر...',
    genre_preview_default: '—',
    genre_default_desc: 'توضیحات...',
  },
  en: {
    app_title: 'Specialized TV Program Archive',
    app_subtitle: 'TV Program Database',
    archive_title: 'Specialized TV Program Archive',
    genres_section: 'Genres',
    all_programs: 'All Programs',
    add_program: 'Add Program',
    search: 'Search',
    search_in: 'Search in',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Logout',
    dashboard: 'Archive',
    bookmarks: 'Bookmarks',
    related_programs: 'Related Programs',
    compare: 'Compare',
    compare_mode: 'Compare Mode',
    compare_count: 'Compare',
    multi_select: 'Multi-Select',
    multi_select_count: 'Select',
    grid_view: 'Grid view',
    list_view: 'List view',
    islamic: 'Islamic',
    has_image: 'With image',
    has_video: 'With video',
    programs_count: 'programs',
    no_programs: 'No programs found',
    no_programs_desc: 'No programs match the current filters. Try changing the filters or searching for something else.',
    loading: 'Loading...',
    login: 'Sign in',
    login_btn: 'Sign in',
    username: 'Username',
    password: 'Password',
    show_password: 'Show password',
    hide_password: 'Hide password',
    logging_in: 'Signing in...',
    back: 'Back',
    menu: 'Menu',
    close: 'Close',
    connected: 'Connected',
    banke_rasane: 'Banke Rasaneh',
    total_programs: 'Total programs',
    uploaded: 'Uploaded',
    with_image: 'With image',
    version: 'Version 2.0.0',
    add_genre: 'Add Genre',
    add_to_compare: 'Add to compare',
    remove_from_compare: 'Remove from compare',
    add_to_bookmarks: 'Add to bookmarks',
    remove_from_bookmarks: 'Remove from bookmarks',
    show_num: 'No.',
    about_program: 'About this program',
    compare_two_programs: 'Compare two programs',
    clear_list: 'Clear',
    close_btn: 'Close',
    difference: 'Diff',
    help_diff: 'Rows tagged with "Diff" differ between the two programs. Identical values appear unchanged.',
    program_first: 'First program',
    program_second: 'Second program',
    field: 'Field',
    decor_programs: 'Decor programs',
    preserved_genre: 'Genre',
    genre_count_suffix: 'programs',
    no_access: 'Access denied',
    no_access_desc: 'You do not have permission to add or edit programs. Sign in with an admin or editor account for full access.',
    role_admin: 'System Admin',
    role_editor: 'Editor',
    role_viewer: 'Viewer',
    settings_title: 'System Settings',
    page_x_of_y: 'Page',
    showing_x_y_of_z: 'Showing',
    prev: 'Prev',
    next: 'Next',
    cancel: 'Cancel',
    download: 'Download',
    total: 'Total',
    genre: 'Genres',
    type: 'Type',
    date: 'Date',
    action: 'Action',
    title: 'Title',
    available_reports: 'Available reports',
    pdf: 'PDF',
    excel: 'Excel',
    all: 'All',
    size_label: 'Size:',
    style_label: 'Style:',
    large_lux: 'Large/Lux',
    medium_std: 'Medium',
    small_econ: 'Small',
    modern: 'Modern',
    composite: 'Composite',
    minimal: 'Minimal',
    classic: 'Classic',
    switch_to_light: 'Switch to light mode',
    switch_to_dark: 'Switch to dark mode',
    switch_to_en: 'Switch to English',
    switch_to_fa: 'Switch to Persian',
    // ----- Added en translations -----
    enter_username_password: 'Please enter username and password',
    login_failed: 'Login failed',
    default_user_hint: 'Default user: ',
    nav_dashboard_desc: 'Home and genres',
    nav_programs_desc: 'Full list of programs',
    nav_bookmarks_desc: 'Programs you bookmarked',
    nav_add_desc: 'Add or edit a program',
    nav_reports_desc: 'Stats and exports',
    dashboard_subtitle: 'Database of {n} TV programs across {g} genres',
    view_search: 'View & search',
    islamic_only_desc: 'Only programs related to Islamic countries',
    has_image_only_desc: 'Only programs with images',
    has_video_only_desc: 'Only programs with videos',
    view_only_desc: 'View only — sign in as admin/editor to edit',
    selected: 'selected',
    publish_social: 'Publish to social media',
    pdf_report: 'PDF report',
    excel_report: 'Excel report',
    decor_classic_traditional: 'Classic/Traditional',
    decor_lux_decorative: 'Lux/Decorative',
    decor_unknown: 'Unknown',
    decor_neutral: 'Neutral',
    decor_warm: 'Warm',
    decor_cold: 'Cold',
    decor_dramatic: 'Dramatic',
    with_audience: 'With audience',
    without_audience: 'Without audience',
    program_no_label: 'Program No.',
    videos_of_program: 'Program videos',
    videos_count_suffix: 'videos',
    direct_access: 'Direct access',
    watch_on_youtube: 'Watch on YouTube',
    imdb_page: 'IMDb page',
    wikipedia_page: 'Wikipedia',
    bookmarked: 'Bookmarked',
    bookmark_verb: 'Bookmark',
    edit: 'Edit',
    delete_program: 'Delete program',
    confirm_delete_question: 'Delete this program? (cannot be undone)',
    yes_delete: 'Yes, delete',
    decor_scene_specs: 'Decor and scene specifications',
    category_label: 'Category',
    decor_style: 'Decor style',
    studio_size: 'Studio size',
    audience: 'Audience',
    effects: 'Effects',
    layout: 'Layout',
    lighting: 'Lighting',
    decor_elements: 'Decor elements',
    materials: 'Materials',
    colors: 'Colors',
    decor_summary: 'Decor summary',
    tags_label: 'Tags',
    detected_countries: 'Detected countries:',
    origin_country_entered: 'Origin country (entered):',
    program_name_required: 'Program name *',
    origin_country_label: 'Origin country',
    name_placeholder: 'e.g.: BBC Breakfast',
    country_placeholder: 'e.g.: Iran, Turkey',
    about_program_fa: 'About this program (Persian)',
    persian_description_placeholder: 'Persian description about the program — what kind of program it is, what content it has...',
    decor_summary_placeholder: 'Full description of decor and scene of the program...',
    program_images: 'Program images',
    image_count_of: 'of',
    first_image_cover: 'First image = cover',
    compression_notice: '📐 Uploaded images are auto-resized to max 1280px width and compressed at JPEG 80% quality.',
    paste_image_url: 'Paste image URL here...',
    add_link: 'Add link',
    upload_file: 'Upload file',
    no_images_yet: 'No images added yet. You can paste a URL or upload a file.',
    cover_badge: 'Cover',
    add_btn: 'Add',
    program_videos: 'Program videos',
    video_constraints: '🎞 Direct videos: max 30s and 5MB. Upload longer videos to YouTube/Aparat and add the link.',
    select_video_file: '🎞 Select video file',
    youtube_search_link: 'YouTube search link (auto)',
    paste_video_url: 'Paste video URL (YouTube, Aparat, Vimeo, Telegram...)',
    add_video: 'Add video',
    open_btn: 'Open',
    move_left: 'Move left',
    move_right: 'Move right',
    edit_program: 'Edit program',
    add_new_program: 'Add new program',
    edit_program_no: 'Edit program No. {n}',
    fill_form_below: 'Please fill out the form below',
    auto_fetch_info: '⚡ Auto-fetch info',
    auto_fetch_desc: 'Enter the program\'s IMDb or Wikipedia link to auto-fill name, description, image and other info.',
    auto_fetch_placeholder: 'https://www.imdb.com/title/... or https://en.wikipedia.org/...',
    fetching: '⏳ Fetching...',
    fetch_btn: '⚡ Fetch',
    elements_placeholder: 'e.g.: plants, screens/monitors',
    materials_placeholder: 'e.g.: wood, glass, metal',
    colors_placeholder: 'e.g.: red, blue, white',
    update_btn: '✓ Update',
    add_program_btn: '+ Add program',
    add_genre_new: '+ Add new genre',
    genre_name_required: 'Genre name *',
    genre_name_placeholder: 'e.g.: Documentary, Animation, Kids...',
    description_label: 'Description',
    description_placeholder: 'Brief description of this genre...',
    genre_color_label: 'Genre color',
    preview_label: 'Preview:',
    save_genre: '✓ Save genre',
    publish_social_title: '📱 Publish to social media',
    select_platform: 'Select platform',
    post_preview: 'Post preview',
    direct_send_to: '📡 Direct send to {platform}',
    bot_configured: 'Bot {platform} configured — destination: {chatId}',
    bot_config_required: 'For direct send, enter the bot token and channel ID first',
    bot_settings: '⚙ Bot settings',
    configure_bot: '＋ Configure bot',
    sending: '⏳ Sending...',
    manual_publish_to: '📤 Manual publish to {platform}',
    select_platform_first: 'Select a platform first',
    bot_config_title: '⚙ Publishing bot settings',
    bot_config_help_intro: 'To send posts directly to a channel or group, create a bot and make it admin of the destination:',
    bot_config_help_tg: '• Telegram: bot @BotFather → /newbot',
    bot_config_help_bale: '• Bale: bot @BotFather@ → create new bot',
    bot_config_help_admin: '• Then make the bot admin of the channel/group',
    platform_label: 'Platform',
    telegram_label: 'Telegram',
    bale_label: 'Bale',
    bot_token_label: 'Bot Token',
    chat_id_label: 'Destination ID (Chat ID)',
    chat_id_help: 'For channel: channel username (like @mychannel) or numeric Chat ID. For private chat: your numeric Chat ID.',
    test_connection: '🔍 Test connection',
    testing: '⏳ Testing...',
    save_settings: '✓ Save settings',
    clear_btn: '🗑 Clear',
    hide_btn: '🙈 Hide',
    show_btn: '👁 Show',
    pdf_preview_title: '📄 PDF report preview',
    excel_preview_title: '📊 Excel report preview',
    program_count_label: 'Program count',
    format_label: 'Format',
    report_title_full: 'Comprehensive TV Program Archive Report',
    banke_rasane_archive: 'Banke Rasaneh — Specialized TV Programs Archive',
    programs_unit: 'programs',
    genre_category_unit: 'genre categories',
    report_structure: 'Report structure (8 sections) — each section includes full description',
    section_exec_summary: 'Executive summary',
    section_exec_summary_desc: 'Archive overview, data volume, key findings and important notes for decision makers',
    section_methodology: 'Data collection methodology',
    section_methodology_desc: 'Explanation of data sources, genre classification process and hybrid approach',
    section_stats_overview: 'Statistical overview',
    section_stats_overview_desc: '4 stat cards + 5 bar charts: studio size, decor style, audience, lighting, layout',
    section_genre_analysis: 'Genre distribution analysis',
    section_genre_analysis_desc: 'Full distribution chart + detailed introduction of each category with count, percent, and notable programs',
    section_decor_analysis: 'Decor and scene analysis',
    section_decor_analysis_desc: '4 charts: recurring scene elements, materials, color palette, lighting + analytical findings',
    section_program_list: 'Detailed program list',
    section_program_list_desc: 'Full card for each program: image, Persian description, tags, decor specs, summary',
    section_conclusion: 'Conclusion and recommendations',
    section_conclusion_desc: 'Summary of findings + 5 actionable recommendations + signature and date section',
    section_appendix: 'Appendix: alphabetical index',
    section_appendix_desc: 'Complete list of all programs in alphabetical order with number and genre category',
    sample_program_card: 'Sample program card (from section 6)',
    sample_program: 'Sample program',
    identifier_label: 'ID:',
    excel_banke_rasane: 'Banke Rasaneh — Excel output',
    name_col: 'Name',
    category_col: 'Category',
    generating: '⏳ Generating...',
    download_file: '⬇ Download {format} file',
    pdf_help_text: 'The report includes 8 sections: title page, table of contents, executive summary, methodology, statistical overview, genre analysis, decor analysis, and detailed program introductions.',
    print_dialog_help: 'After clicking download, a print dialog will open — choose "A4" size and "Save as PDF".',
    banke_rasane_stats_reports: 'Banke Rasaneh stats & reports',
    no_programs_for_report: 'No programs for this report',
    system_settings_title: '⚙ System settings',
    close_settings: 'Close settings',
    tab_server: 'Server',
    tab_users: 'Users',
    tab_password: 'Password',
    tab_audit: 'Audit log',
    api_server_url: '🖥 API server URL',
    api_server_desc: 'Address of the API service this app connects to. Default:',
    save_address: '✓ Save address',
    server_help: 'Help: the entered address should be the root of the API service (without /api/... paths). If you are using the Caddy gateway, you can enter a relative address. After saving, your current token remains valid.',
    users_management: '👥 Users management',
    users_management_desc: 'Add, delete or change roles of system users. Roles: admin (full access), editor (add/edit programs), viewer (view only).',
    add_new_user: '＋ Add new user',
    username_placeholder: 'Username',
    display_name_optional: 'Display name (optional)',
    password_placeholder_min: 'Password (min 4 chars)',
    create_user: '＋ Create user',
    creating: '⏳ Creating...',
    current_users: 'Current users',
    change_password_title: '🔑 Change password',
    change_password_desc: 'Change your password. After changing, all your active sessions will be invalidated and you must sign in again.',
    current_account: '👤 Current account:',
    current_password: 'Current password',
    new_password: 'New password',
    confirm_new_password: 'Confirm new password',
    password_mismatch: '⚠ New password and confirmation do not match',
    change_password_btn: '✓ Change password',
    audit_log_title: '📜 Audit log',
    audit_log_desc: 'Recent reports of program additions, edits and deletions with the user and exact time.',
    refresh: '↻ Refresh',
    action_create: 'Create',
    action_update: 'Update',
    action_delete: 'Delete',
    program_hash: 'Program #',
    program_created_log: 'Program "{name}" was created.',
    program_deleted_log: 'Program "{name}" was deleted.',
    field_log: 'Field',
    no_changes_recorded: 'No changes recorded.',
    loading_users: 'Loading...',
    loading_history: 'Loading...',
    error_loading_users: 'Error loading users',
    error_loading_history: 'Error loading history',
    cannot_delete_self: 'You cannot delete your own account',
    cannot_change_role_self: 'You cannot change your own role',
    help_label: 'Help:',
    clear_compare_list: 'Clear compare list',
    values_differ: 'Values differ between the two programs',
    name_program: 'Program name',
    connection_ok: 'Connection established ✓',
    connection_invalid_response: 'Invalid response: {body}',
    connection_error: 'Connection error: {msg}',
    server_url_saved: 'Server URL saved. To fully apply, reload the page.',
    user_created_toast: 'User "{name}" created',
    user_deleted_toast: 'User deleted',
    user_role_changed_toast: 'Role of "{name}" changed to {role}',
    role_changed_self_toast: 'You cannot change your own role',
    fill_three_fields: 'Please fill out all three fields',
    password_min_length: 'New password must be at least 4 characters',
    passwords_dont_match: 'New password and confirmation do not match',
    password_must_differ: 'New password must differ from current password',
    password_changed_toast: 'Password changed successfully. Please sign in again.',
    error_changing_password: 'Error changing password',
    fetch_imdb_wiki_prompt: 'Please enter IMDb or Wikipedia link',
    fetch_error_toast: 'Error fetching info',
    fetch_success_toast: 'Info fetched successfully',
    name_required_toast: 'Program name is required',
    max_images_toast: 'Max {n} images allowed',
    image_duplicate_toast: 'This image is already added',
    images_added_partial_toast: 'Only {added} image(s) added (max {max})',
    image_compress_error_toast: 'Error compressing: {name}',
    fetch_failed_toast: 'Error: {msg}',
    delete_user_confirm: 'Delete user "{name}"?',
    tags_hint: 'Separate tags with commas (, or ،) — e.g.: modern, warm, wood',
    tags_placeholder: 'modern, warm, wood...',
    preset_tags_hint: 'Suggested tags for this genre:',
    clear_all: 'Clear all',
    banke_rasane_brand: 'Banke Rasaneh',
    bot_token_required: 'Please enter the bot token',
    bot_test_ok: '✅ Bot "@{name}" identified',
    bot_test_invalid: '❌ Invalid token',
    bot_test_network_error: '❌ Network error',
    bot_config_required_toast: 'Please configure the bot first',
    post_sent_to: '✅ Post sent to {platform}',
    post_send_failed: '❌ {msg}',
    post_send_network_error: '❌ Network error while sending',
    edit_field: 'Edit',
    archive_intro_subtitle: '{n} TV programs across {g} genres',
    archive_comprehensive_report: 'Comprehensive TV Program Archive Report',
    report_sample_card_intro: 'Sample program card (from section 6)',
    full_report_detailed_first: 'In the full report, the first 80 programs are detailed and all {n} programs are in the alphabetical index',
    social_card_brand: 'Banke Rasaneh',
    social_card_programs_count: '{n} selected programs',
    social_card_more_count: 'and {n} more programs...',
    genre_preview_default: '—',
    genre_default_desc: 'Description...',
  },
};

// Language context — wraps the entire app and exposes { lang, setLang, t }.
type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
};
const LangContext = createContext<LangContextValue>({
  lang: 'fa',
  setLang: () => {},
  t: (k) => STRINGS.fa[k],
});

function LangProvider({ lang, setLang, children }: { lang: Lang; setLang: (l: Lang) => void; children: React.ReactNode }) {
  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang,
    t: (k: StringKey, params?: Record<string, string | number>) => {
      let s = STRINGS[lang][k] || STRINGS.fa[k] || k;
      if (params) {
        for (const pk of Object.keys(params)) {
          s = s.split(`{${pk}}`).join(String(params[pk]));
        }
      }
      return s;
    },
  }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function useLang() {
  return useContext(LangContext);
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'programs' | 'genre' | 'reports' | 'add' | 'bookmarks'>('dashboard');
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

  // ★ Bookmarks — stored in localStorage as an array of show nums.
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const BOOKMARKS_KEY = 'bankresaneh_bookmarks_v1';

  // ⚖ Compare — list of show nums queued for side-by-side comparison (max 2).
  const [compareList, setCompareList] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // 🌗 Theme — dark (deep navy/teal) by default; light theme also supported.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const THEME_KEY = 'bankresaneh_theme_v1';

  // 🌐 Language — 'fa' (Persian, default) or 'en' (English UI strings).
  const [lang, setLang] = useState<'fa' | 'en'>('fa');
  const LANG_KEY = 'bankresaneh_lang_v1';

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
    // Restore bookmarks saved in a previous session.
    try {
      const savedBookmarks = JSON.parse(window.localStorage.getItem(BOOKMARKS_KEY) || '[]');
      if (Array.isArray(savedBookmarks)) setBookmarks(savedBookmarks);
    } catch {}
    // Theme — restore saved preference (dark by default).
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    // Restore language.
    const savedLang = window.localStorage.getItem(LANG_KEY);
    if (savedLang === 'fa' || savedLang === 'en') setLang(savedLang);
    fetch('/talk-shows-data.json')
      .then(r => r.json())
      .then((data: TalkShow[]) => {
        setBaseShows(data);
        setTalkShows(applyOverrides(data, saved));
      })
      .catch(e => console.error('Failed to load data:', e));
  }, []);

  // Apply theme + language to the root element.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }
  }, [theme]);

  // Apply document direction based on language.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  }, [lang]);

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
  const navigate = (to: 'dashboard' | 'programs' | 'genre' | 'reports' | 'add' | 'bookmarks', genre: Genre | null = null) => {
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

  const handleNavigate = (v: 'dashboard' | 'programs' | 'reports' | 'add' | 'bookmarks') => {
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

  // ★ Toggle a show's bookmark status (added to / removed from bookmarks list).
  const handleToggleBookmark = (num: number) => {
    setBookmarks(prev => {
      const next = prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num];
      try { window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ⚖ Toggle a show in the compare queue (max 2 items).
  // When the SECOND item is added (queue goes from 1 → 2), automatically open the compare modal —
  // this makes the workflow discoverable. When the user removes items, the modal stays open until
  // they explicitly close it.
  const handleToggleCompare = (num: number) => {
    setCompareList(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length >= 2) {
        // Replace oldest entry to keep only the latest two.
        return [prev[1], num];
      }
      // Auto-open modal as soon as 2 items are queued.
      if (prev.length === 1) {
        // Defer the modal-open to the next tick so compareList updates first.
        setTimeout(() => setShowCompareModal(true), 0);
      }
      return [...prev, num];
    });
  };

  // ⚖ Open the compare modal (only meaningful when 2 shows are queued).
  const handleCompare = () => {
    if (compareList.length !== 2) {
      showToast('برای مقایسه، دو برنامه را انتخاب کنید');
      return;
    }
    setShowCompareModal(true);
  };


  // 🌐 Toggle language (fa ↔ en), persist to localStorage.
  const handleToggleLang = () => {
    setLang(prev => {
      const next = prev === 'fa' ? 'en' : 'fa';
      try { window.localStorage.setItem(LANG_KEY, next); } catch {}
      return next;
    });
  };

  // 🌗 Toggle theme (dark ↔ light), persist to localStorage.
  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
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
      <LangProvider lang={lang} setLang={setLang}>
        <div className="login-screen min-h-screen relative flex flex-col items-center justify-center">
          <div className="login-ambient-light green-1"></div>
          <div className="login-ambient-light green-2"></div>
          <div className="login-ambient-light green-3"></div>
          <div className="relative z-20 flex flex-col items-center" style={{ gap: '16px' }}>
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#26c6da' }}></div>
            <span style={{ color: 'rgba(128, 222, 234, 0.85)', fontSize: '14px' }}>{STRINGS[lang].loading}</span>
          </div>
        </div>
      </LangProvider>
    );
  }

  if (!currentUser) {
    return (
      <LangProvider lang={lang} setLang={setLang}>
        <LoginScreen onLogin={handleLoginSuccess} />
      </LangProvider>
    );
  }

  return (
    <LangProvider lang={lang} setLang={setLang}>
      <div className="app-content min-h-screen">
      <TopAppBar
        onMenuClick={() => setDrawerOpen(true)}
        isMobile={isMobile}
        currentView={currentView}
        onBack={goBack}
        canGoBack={canGoBack}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onToggleLang={handleToggleLang}
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
        bookmarks={bookmarks}
        onOpenBookmarks={() => navigate('bookmarks', null)}
      />

      <main className={isMobile ? 'p-4 pt-20 pb-28' : 'p-8 pt-24'}>
        {currentView === 'dashboard' && <Dashboard onGenreClick={(g) => navigate('genre', g)} talkShows={talkShows} uploadedCount={uploadedShows.length} onAdd={() => { setPresetCategory(undefined); setPresetGenre(null); setEditingShow(null); navigate('add'); }} canEdit={canEdit} isAdmin={isAdmin} genres={genres} onAddGenre={handleAddGenre} />}
        {currentView === 'programs' && <ProgramsView talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} bookmarks={bookmarks} onToggleBookmark={handleToggleBookmark} compareList={compareList} onToggleCompare={handleToggleCompare} onCompare={handleCompare} />}
        {currentView === 'genre' && selectedGenre && <ProgramsView genre={selectedGenre} talkShows={talkShows} uploadedShows={uploadedShows} setUploadedShows={setUploadedShows} onShowClick={setSelectedShow} onEdit={setEditingShow} showToast={showToast} onPublish={setPublishShows} onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })} canEdit={canEdit} onAdd={() => handleAddFromGenre(selectedGenre)} bookmarks={bookmarks} onToggleBookmark={handleToggleBookmark} compareList={compareList} onToggleCompare={handleToggleCompare} onCompare={handleCompare} />}
        {currentView === 'bookmarks' && (
          <ProgramsView
            talkShows={talkShows.filter(s => bookmarks.includes(s.num))}
            uploadedShows={uploadedShows}
            setUploadedShows={setUploadedShows}
            onShowClick={setSelectedShow}
            onEdit={setEditingShow}
            showToast={showToast}
            onPublish={setPublishShows}
            onExport={(shows, fmt) => setExportPreview({ shows, format: fmt })}
            canEdit={canEdit}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            compareList={compareList}
            onToggleCompare={handleToggleCompare}
            onCompare={handleCompare}
            overrideTitle="برنامه‌های نشان‌شده"
          />
        )}
        {currentView === 'reports' && <ReportsView talkShows={talkShows} uploadedShows={uploadedShows} showToast={showToast} onExport={(shows, format) => setExportPreview({ shows, format })} />}
        {currentView === 'add' && canEdit && <AddEditView talkShows={talkShows} onSave={handleSaveShow} editingShow={editingShow} setEditingShow={setEditingShow} onDone={() => { setEditingShow(null); setSelectedGenre(null); setPresetCategory(undefined); setPresetGenre(null); setCurrentView('programs'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }} showToast={showToast} presetCategory={presetCategory} presetGenre={presetGenre} genres={genres} />}
        {currentView === 'add' && !canEdit && (
          <div className="premium-glass p-8 text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#dc2626' }}>دسترسی غیرمجاز</h2>
            <p style={{ color: '#9CA3AF' }}>شما اجازهٔ افزودن یا ویرایش برنامه‌ها را ندارید. برای دسترسی کامل با حساب مدیر یا ویراستار وارد شوید.</p>
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
          isBookmarked={bookmarks.includes(selectedShow.num)}
          onToggleBookmark={() => handleToggleBookmark(selectedShow.num)}
          onAddToCompare={() => {
            handleToggleCompare(selectedShow.num);
            showToast(`برنامه به فهرست مقایسه اضافه شد (${Math.min(compareList.length + 1, 2)} از ۲)`);
          }}
        />
      )}

      {/* Compare two programs modal */}
      {showCompareModal && compareList.length === 2 && (
        <CompareModal
          shows={compareList.map(n => talkShows.find(s => s.num === n)).filter(Boolean) as TalkShow[]}
          onClose={() => setShowCompareModal(false)}
          onClear={() => { setCompareList([]); setShowCompareModal(false); showToast('فهرست مقایسه پاک شد'); }}
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
            background: 'rgba(0, 188, 212, 0.95)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 188, 212, 0.4)',
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
    </LangProvider>
  );
}

// ============================================
// LOGIN SCREEN — real auth (username + password)
// ============================================
function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const { t, lang } = useLang();
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
      setError(t('enter_username_password'));
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      onLogin(data.user);
    } catch (err: any) {
      setError(err?.message || t('login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen min-h-screen relative flex flex-col items-center justify-center">
      <div className="login-ambient-light green-1"></div>
      <div className="login-ambient-light green-2"></div>
      <div className="login-ambient-light green-3"></div>

      {/* Subtle vignette layer — adds drama around the centered card */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 100%)' }}
      />

      <div
        className={`relative z-20 flex flex-col items-center px-8 transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        style={{ maxWidth: '480px', width: '100%' }}
      >
        {/* Logo — larger + dramatic shimmer sweep */}
        <div className="mb-12 flex justify-center">
          <div
            className="logo-shimmer"
            style={{ ['--logo-mask' as string]: 'url(/banke-rasane-logo.png)' }}
          >
            <Image
              src="/banke-rasane-logo.png"
              alt={t('banke_rasane')}
              width={440}
              height={240}
              priority
              style={{ width: '100%', height: 'auto', maxWidth: '440px' }}
            />
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username */}
          <div>
            <label htmlFor="login-username" className="block text-sm font-bold mb-2" style={{ color: 'rgba(128, 222, 234, 0.9)' }}>
              {t('username')}
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
              className="input-base"
              style={{
                width: '100%',
                background: 'rgba(30, 34, 40, 0.9)',
                border: '1px solid rgba(0, 188, 212, 0.4)',
                borderRadius: '14px',
                padding: '14px 18px',
                color: '#FFFFFF',
                fontSize: '15px',
                fontFamily: 'inherit',
                outline: 'none',
                textAlign: 'left',
                direction: 'ltr',
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#26c6da'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,188,212,0.18)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 188, 212, 0.4)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Password with show/hide */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-bold mb-2" style={{ color: 'rgba(128, 222, 234, 0.9)' }}>
              {t('password')}
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
                  background: 'rgba(30, 34, 40, 0.9)',
                  border: '1px solid rgba(0, 188, 212, 0.4)',
                  borderRadius: '14px',
                  padding: '14px 52px 14px 18px',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  textAlign: 'left',
                  direction: 'ltr',
                  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#26c6da'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,188,212,0.18)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 188, 212, 0.4)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('hide_password') : t('show_password')}
                title={showPassword ? t('hide_password') : t('show_password')}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors z-10"
                style={{ color: showPassword ? '#26c6da' : 'rgba(128, 222, 234, 0.6)', background: 'transparent', cursor: 'pointer' }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(0, 188, 212, 0.15)'; }}
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
                  <span>{t('logging_in')}</span>
                </>
              ) : (
                <>
                  <span>{t('login_btn')}</span>
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
          <p style={{ color: 'rgba(128, 222, 234, 0.6)' }} className="text-xs tracking-wider">
            {t('version')} • {t('app_subtitle')}
          </p>
          <p style={{ color: 'rgba(128, 222, 234, 0.45)' }} className="text-xs mt-2">
            {t('default_user_hint')}
            <span dir="ltr">admin</span> / {lang === 'en' ? 'pass: ' : 'رمز: '}
            <span dir="ltr">admin</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TOP APP BAR — fixed at top, hamburger (3-line) on the right,
// logo + title in the center, visible on BOTH desktop and mobile.
// Theme-aware via the `.top-app-bar` className (CSS variables in globals.css).
// ============================================
function TopAppBar({ onMenuClick, isMobile, currentView, onBack, canGoBack, theme, onToggleTheme, onToggleLang }: {
  onMenuClick: () => void;
  isMobile: boolean;
  currentView: string;
  onBack: () => void;
  canGoBack: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;

  onToggleLang?: () => void;
}) {
  const { t, lang } = useLang();
  const viewTitles: Record<string, string> = {
    dashboard: t('archive_title'),
    programs: t('all_programs'),
    genre: t('preserved_genre'),
    reports: t('reports'),
    add: t('add_program'),
    bookmarks: t('bookmarks'),
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 top-app-bar"
      style={{
        transition: 'background 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          padding: isMobile ? '12px 16px' : '16px 32px',
          minHeight: isMobile ? '64px' : '72px',
          gap: '12px',
        }}
      >
        {/* Hamburger button — 3 lines — opens the drawer from the right */}
        <button
          onClick={onMenuClick}
          aria-label={t('menu')}
          title={t('menu')}
          className="btn-base flex flex-col justify-center items-center p-2.5 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid #2A2E35',
            color: 'white',
            minWidth: '44px',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 188, 212, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(0, 188, 212, 0.45)';
            e.currentTarget.style.color = '#26c6da';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.borderColor = '#2A2E35';
            e.currentTarget.style.color = 'white';
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
            width={isMobile ? 96 : 140}
            height={isMobile ? 26 : 36}
            priority
            style={{
              filter: 'drop-shadow(0 2px 10px rgba(0, 188, 212, 0.5))',
              flexShrink: 0,
            }}
          />
          {!isMobile && (
            <div
              className="flex flex-col bar-title"
              style={{ borderRight: '1px solid #2A2E35', paddingRight: '14px' }}
            >
              <span className="bar-title" style={{ color: 'white', fontWeight: 700, fontSize: '15px', lineHeight: 1.2 }}>
                {viewTitles[currentView] || t('banke_rasane')}
              </span>
              <span className="bar-title-sub" style={{ fontSize: '11px', marginTop: '2px' }}>
                {t('version')}
              </span>
            </div>
          )}
        </div>

        {/* Left cluster: theme + language toggles + back button (when there is history) */}
        <div className="flex items-center gap-2" style={{ minWidth: '44px', justifyContent: 'flex-end' }}>

          {/* 🌗 Theme toggle (dark ↔ light) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
              title={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
              className="btn-base bar-toggle flex items-center justify-center rounded-xl"
              style={{
                width: '44px',
                height: '44px',
                fontSize: '18px',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}

          {/* 🌐 Language toggle (fa ↔ en) */}
          {onToggleLang && (
            <button
              onClick={onToggleLang}
              aria-label={lang === 'fa' ? t('switch_to_en') : t('switch_to_fa')}
              title={lang === 'fa' ? t('switch_to_en') : t('switch_to_fa')}
              className="btn-base bar-toggle flex items-center justify-center rounded-xl font-bold"
              style={{
                width: '44px',
                height: '44px',
                fontSize: '13px',
                direction: 'ltr',
              }}
            >
              {lang === 'fa' ? 'EN' : 'فا'}
            </button>
          )}
          {canGoBack ? (
            <button
              onClick={onBack}
              aria-label={t('back')}
              title={t('back')}
              className="btn-base flex items-center gap-2 rounded-xl"
              style={{
                background: 'rgba(0, 188, 212, 0.15)',
                border: '1px solid rgba(0, 188, 212, 0.45)',
                color: '#26c6da',
                padding: isMobile ? '9px 12px' : '9px 16px',
                minWidth: '44px',
                minHeight: '44px',
                fontWeight: 700,
                fontSize: '14px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 188, 212, 0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 188, 212, 0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {!isMobile && <span>{t('back')}</span>}
            </button>
          ) : isMobile ? (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold bar-title"
              style={{
                background: 'rgba(0, 188, 212, 0.15)',
                color: '#26c6da',
                border: '1px solid rgba(0, 188, 212, 0.35)',
              }}
            >
              {t('banke_rasane')}
            </span>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bar-title"
              style={{
                background: 'rgba(0, 188, 212, 0.1)',
                border: '1px solid rgba(0, 188, 212, 0.3)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: '#26c6da',
                  boxShadow: '0 0 8px #26c6da',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              ></span>
              <span className="bar-title-sub" style={{ fontSize: '12px' }}>{t('connected')}</span>
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
  bookmarks = [],
  onOpenBookmarks,
}: {
  open: boolean;
  onClose: () => void;
  currentView: string;
  onNavigate: (v: 'dashboard' | 'programs' | 'reports' | 'add' | 'bookmarks') => void;
  onGenreSelect: (g: Genre) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  currentUser: User | null;
  isAdmin: boolean;
  talkShows: TalkShow[];
  genres?: Genre[];
  bookmarks?: number[];
  onOpenBookmarks?: () => void;
}) {
  const [genresExpanded, setGenresExpanded] = useState(true);
  const { t, lang } = useLang();

  const navItems = [
    { key: 'dashboard', label: t('dashboard'), icon: 'home', desc: t('nav_dashboard_desc') },
    { key: 'programs', label: t('all_programs'), icon: 'grid', desc: t('nav_programs_desc') },
    { key: 'bookmarks', label: t('bookmarks'), icon: 'bookmark', desc: t('nav_bookmarks_desc') },
    { key: 'add', label: t('add_program'), icon: 'plus', desc: t('nav_add_desc') },
    { key: 'reports', label: t('reports'), icon: 'reports', desc: t('nav_reports_desc') },
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
      style={{ background: 'var(--overlay-strong)', backdropFilter: 'blur(4px)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <aside
        className="drawer-aside fixed top-0 right-0 bottom-0 animate-drawer-slide-in flex flex-col"
        style={{
          width: 'min(340px, 88vw)',
          transition: 'background 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header — logo + close */}
        <div
          className="p-4 flex items-center justify-between flex-shrink-0 drawer-divider"
          style={{ borderBottom: '1px solid #2A2E35' }}
        >
          <Image
            src="/banke-rasane-logo.png"
            alt={t('banke_rasane')}
            width={140}
            height={36}
            priority
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0, 188, 212, 0.5))' }}
          />
          <button
            onClick={onClose}
            className="btn-base p-2 rounded-lg drawer-fg-muted"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#FCA5A5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ''; }}
            title={t('close')}
            aria-label={t('close')}
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
                  className="btn-base drawer-fg flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-right"
                  style={isActive ? {
                    background: 'rgba(0, 188, 212, 0.18)',
                    border: '1px solid rgba(0, 188, 212, 0.45)',
                    color: '#26c6da',
                  } : {
                    border: '1px solid transparent',
                    color: 'var(--drawer-fg)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <NavIcon name={item.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs drawer-fg-muted" style={{ marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Genres section */}
          <div className="mt-6">
            <button
              onClick={() => setGenresExpanded(!genresExpanded)}
              className="btn-base drawer-fg-muted flex items-center justify-between w-full px-3 mb-2 text-xs font-bold uppercase tracking-wider"
            >
              <span>{t('genres_section')} ({genres.length})</span>
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
                      className="btn-base drawer-fg flex items-center gap-3 px-3 py-2 rounded-lg group w-full"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${g.color}25`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
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
          className="p-3 flex-shrink-0 drawer-divider"
          style={{ borderTop: '1px solid #2A2E35' }}
        >
          {currentUser && (
            <div
              className="mb-2 p-3 rounded-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid #2A2E35',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(0, 188, 212, 0.18)',
                    color: '#26c6da',
                    border: '1px solid rgba(0, 188, 212, 0.45)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm drawer-fg-active" style={{ color: '#26c6da' }} title={currentUser.username}>
                    {currentUser.name || currentUser.username}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                      style={{
                        background: currentUser.role === 'admin' ? 'rgba(239, 68, 68, 0.18)' : currentUser.role === 'editor' ? 'rgba(250, 204, 21, 0.18)' : 'rgba(0, 188, 212, 0.18)',
                        color: currentUser.role === 'admin' ? '#FCA5A5' : currentUser.role === 'editor' ? '#FACC15' : '#26c6da',
                      }}
                    >
                      {roleLabel[currentUser.role] || currentUser.role}
                    </span>
                    <span className="text-xs drawer-fg-muted" dir="ltr">
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
              className="btn-base drawer-fg flex items-center gap-3 px-3 py-2.5 rounded-lg w-full mb-1"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 188, 212, 0.15)';
                e.currentTarget.style.color = '#26c6da';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '';
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-sm">⚙ {t('settings')}</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="btn-base drawer-fg flex items-center gap-3 px-3 py-2.5 rounded-lg w-full"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#FCA5A5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '';
            }}
          >
            <NavIcon name="exit" />
            <span className="font-medium text-sm">{t('logout')}</span>
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
    bookmark: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />,
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
  const { t, lang } = useLang();

  return (
    <>
      {showGenres && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setShowGenres(false)}
        >
          <div
            className="fixed bottom-0 left-0 right-0 p-4 animate-slide-up-nav"
            style={{
              background: 'rgba(15, 17, 21, 0.95)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              borderTop: '1px solid #2A2E35',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
              paddingBottom: '32px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: '#FFFFFF' }}>{t('genres_section')} ({genres.length})</h3>
              <button
                onClick={() => setShowGenres(false)}
                className="p-2 rounded-lg"
                style={{ color: '#9CA3AF', background: 'rgba(255, 255, 255, 0.05)' }}
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
                      background: `${g.color}1A`,
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
                        <div className="text-sm font-bold truncate" style={{ color: '#FFFFFF' }}>{g.nameFa}</div>
                        <div className="text-xs font-bold" style={{ color: g.color }}>
                          {count.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} {t('programs_count')}
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
            background: 'rgba(15, 17, 21, 0.85)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid #2A2E35',
            borderRadius: '18px',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            padding: '8px',
          }}
        >
          <MobileNavBtn label={t('menu')} icon="menu" active={false} onClick={onOpenDrawer} highlight />
          <MobileNavBtn label={t('dashboard')} icon="home" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          <MobileNavBtn label={t('all_programs')} icon="grid" active={currentView === 'programs'} onClick={() => onNavigate('programs')} />
          <MobileNavBtn label={t('genres_section')} icon="genre" active={showGenres} onClick={() => setShowGenres(!showGenres)} highlight />
          <MobileNavBtn label={t('add_program')} icon="plus" active={currentView === 'add'} onClick={() => onNavigate('add')} />
          <MobileNavBtn label={t('logout')} icon="exit" active={false} onClick={onLogout} />
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
        background: active ? 'rgba(0, 188, 212, 0.15)' : 'transparent',
        border: active ? '1px solid rgba(0, 188, 212, 0.35)' : '1px solid transparent',
        minWidth: '56px',
      }}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke={active ? '#26c6da' : highlight ? '#26c6da' : '#9CA3AF'}
        viewBox="0 0 24 24"
        style={{ filter: active ? 'drop-shadow(0 0 6px rgba(0, 188, 212, 0.45))' : 'none' }}
      >
        {icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
        {icon === 'grid' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
        {icon === 'genre' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
        {icon === 'plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
        {icon === 'exit' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
        {icon === 'menu' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
      </svg>
      <span className="text-xs font-medium" style={{ color: active ? '#26c6da' : highlight ? '#26c6da' : '#9CA3AF' }}>
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
  const { t, lang } = useLang();
  const stats = [
    { label: t('total_programs'), value: talkShows.length, color: '#00bcd4', icon: 'film' },
    { label: t('genre'), value: genres.length, color: '#2563eb', icon: 'tag' },
    { label: t('uploaded'), value: uploadedCount, color: '#7c3aed', icon: 'cloud' },
    { label: t('with_image'), value: talkShows.filter(s => s.images && s.images.length > 0).length, color: '#db2777', icon: 'image' },
  ];

  return (
    <>
      <header className="mb-8 animate-view-enter">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('archive_title')}</h1>
          <span
            className="text-sm px-3 py-1 rounded-full"
            style={{ background: 'var(--accent-bg-soft)', color: 'var(--accent-text)' }}
          >
            {t('banke_rasane')}
          </span>
        </div>
        <p className="text-fg-muted" style={{ color: 'var(--fg-muted)' }}>
          {t('dashboard_subtitle', { n: talkShows.length.toLocaleString('fa-IR'), g: genres.length })}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => {
          const dark = adjustColor(s.color, -40);
          const darker = adjustColor(s.color, -70);
          return (
            <div
              key={i}
              className="premium-card animate-fade-in"
              style={{
                animationDelay: `${i * 80}ms`,
                background: `linear-gradient(135deg, ${s.color} 0%, ${dark} 60%, ${darker} 100%)`,
                border: `1px solid ${adjustColor(s.color, 30)}`,
                boxShadow: `0 12px 40px ${s.color}55, 0 4px 12px ${s.color}35, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <StatIcon name={s.icon} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.label}</span>
              </div>
              <div className="text-3xl font-black text-white">
                {s.value.toLocaleString('fa-IR')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('genres_section')}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onAddGenre && (
            <button
              onClick={() => setShowAddGenre(true)}
              className="btn-base px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: 'rgba(7, 89, 133, 0.12)',
                color: '#075985',
                border: '1px solid rgba(7, 89, 133, 0.3)',
              }}
            >
              + {t('add_genre')}
            </button>
          )}
          {canEdit && (
            <button
              onClick={onAdd}
              className="btn-enter-premium text-sm"
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              + {t('add_program')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {genres.map((g, idx) => {
          const count = talkShows.filter(g.filterFn).length;
          const dark = adjustColor(g.color, -40);
          const darker = adjustColor(g.color, -70);
          return (
            <button
              key={g.id}
              onClick={() => onGenreClick(g)}
              className="premium-card animate-slide-up text-right"
              style={{
                animationDelay: `${idx * 50}ms`,
                opacity: 0,
                background: `linear-gradient(135deg, ${g.color} 0%, ${dark} 60%, ${darker} 100%)`,
                border: `1px solid ${adjustColor(g.color, 30)}`,
                boxShadow: `0 12px 40px ${g.color}55, 0 4px 12px ${g.color}35, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                e.currentTarget.style.filter = 'brightness(1.12)';
                e.currentTarget.style.boxShadow = `0 18px 56px ${g.color}70, 0 6px 20px ${g.color}45, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.filter = 'brightness(1)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${g.color}55, 0 4px 12px ${g.color}35, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`;
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-4xl font-black text-white">
                    {count.toLocaleString('fa-IR')}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{t('programs_count')}</div>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1 text-white">{g.nameFa}</h3>
              <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.8)' }}>{g.description}</p>
              <div className="mt-4 flex items-center text-sm font-bold text-white">
                {t('view_search')}
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
  bookmarks,
  onToggleBookmark,
  compareList,
  onToggleCompare,
  onCompare,
  overrideTitle,
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
  bookmarks?: number[];
  onToggleBookmark?: (num: number) => void;
  compareList?: number[];
  onToggleCompare?: (num: number) => void;
  onCompare?: () => void;
  overrideTitle?: string;
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterSize, setFilterSize] = useState('all');
  const [filterViewers, setFilterViewers] = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [islamicOnly, setIslamicOnly] = useState(false);
  const [hasImageOnly, setHasImageOnly] = useState(false);
  const [hasVideoOnly, setHasVideoOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(talkShows.length === 0);
  const PAGE_SIZE = 24;
  const { t, lang } = useLang();

  // Decor-specific size & style filters ONLY apply in the "decor" view (no genre) or
  // when explicitly inside the decor genre. Other genres hide these filter rows so
  // the toolbar does not display irrelevant decor dimensions.
  const decorFiltersVisible = !genre || genre.id === 'decor';

  const filteredShows = useMemo(() => {
    let shows = [...talkShows];
    if (genre) shows = shows.filter(genre.filterFn);
    // Size & style filters are decor-specific — only apply them when they are visible
    // so other genre views don't accidentally restrict results.
    if (decorFiltersVisible) {
      if (filterSize !== 'all') shows = shows.filter(s => s.size === filterSize);
      if (filterStyle !== 'all') shows = shows.filter(s => s.style === filterStyle);
    }
    if (filterViewers !== 'all') shows = shows.filter(s => s.viewers === filterViewers);
    if (islamicOnly) shows = shows.filter(s => detectCountries(s).length > 0);
    if (hasImageOnly) shows = shows.filter(s => Array.isArray(s.images) && s.images.length > 0);
    if (hasVideoOnly) shows = shows.filter(s => Array.isArray(s.videos) && s.videos.length > 0);
    if (search) {
      const q = search.toLowerCase();
      // Section-specific search: use genre.searchFields if defined, else default to name+summary+category.
      const fields: (keyof TalkShow)[] = genre?.searchFields || ['name', 'summary', 'category'];
      shows = shows.filter(s => {
        for (const f of fields) {
          const v = s[f];
          if (typeof v === 'string') {
            if (v.toLowerCase().includes(q) || v.includes(search)) return true;
          } else if (Array.isArray(v)) {
            if (v.some(item => String(item).toLowerCase().includes(q) || String(item).includes(search))) return true;
          }
        }
        return false;
      });
    }
    return shows;
  }, [talkShows, genre, search, filterSize, filterViewers, filterStyle, islamicOnly, hasImageOnly, hasVideoOnly, decorFiltersVisible]);

  // Reset to first page whenever filters change (so user doesn't see an empty page).
  useEffect(() => { setPage(1); }, [search, filterSize, filterStyle, filterViewers, islamicOnly, hasImageOnly, hasVideoOnly, genre]);

  // Loading state — show skeletons for ~600ms after data first arrives (or instantly if we have data).
  useEffect(() => {
    if (talkShows.length > 0) {
      // Simulate brief loading shimmer on first arrival so users see the skeleton pattern.
      const timer = setTimeout(() => setLoading(false), 350);
      return () => clearTimeout(timer);
    } else {
      setLoading(true);
    }
  }, [talkShows.length]);

  // ⚖ Compare auto-open behaviour lives in Home.handleToggleCompare — when the second item is
  // queued, the modal opens automatically. No additional effect needed here.

  const totalPages = Math.max(1, Math.ceil(filteredShows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageShows = filteredShows.slice(pageStart, pageStart + PAGE_SIZE);

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

  const gc = genre?.color || '#00bcd4';

  return (
    <>
      <header className="mb-6 animate-view-enter">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-fg-strong" style={{ color: 'var(--fg-strong)' }}>
          {overrideTitle || (genre ? genre.nameFa : t('all_programs'))}
        </h1>
        <p className="text-fg-muted" style={{ color: 'var(--fg-muted)' }}>
          {filteredShows.length.toLocaleString('fa-IR')} {t('programs_count')}
          {genre && ` • ${genre.description}`}
        </p>
      </header>

      {genre && (
        <div
          className="premium-card mb-6 p-6 animate-view-enter"
          style={{
            background: `linear-gradient(135deg, ${gc}22 0%, ${gc}08 100%)`,
            border: `1px solid ${gc}50`,
            boxShadow: `0 16px 56px ${gc}22`,
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
                <h2 className="text-xl sm:text-2xl font-bold mb-1 text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{genre.nameFa}</h2>
                {canEdit && onAdd && (
                  <button
                    onClick={onAdd}
                    className="btn-enter-premium text-sm"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    + {t('add_program')}
                  </button>
                )}
              </div>
              <p className="text-fg-muted text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>{genre.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & toolbar — mobile-friendly: full-width search, actions row, horizontally scrollable filter chips */}
      <div className="premium-glass p-3 sm:p-4 mb-6 space-y-3 animate-view-enter">
        {/* Search — full width on every screen size */}
        <div className="relative">
          <svg
            className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--fg-muted)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('search_in')} ${genre ? genre.nameFa : t('all_programs')}...`}
            className="input-base"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '12px',
              padding: '11px 36px 11px 16px',
              width: '100%',
              fontFamily: 'inherit',
              color: 'var(--input-fg)',
              outline: 'none',
              fontSize: '15px',
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg-soft)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Actions row — view toggle + multi-select + Islamic filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
            }}
          >
            <button
              onClick={() => setView('grid')}
              className="btn-base p-2 rounded-lg"
              style={view === 'grid' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--fg-muted)' }}
              aria-label={t('grid_view')}
              title={t('grid_view')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="btn-base p-2 rounded-lg"
              style={view === 'list' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--fg-muted)' }}
              aria-label={t('list_view')}
              title={t('list_view')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* 🌍 Islamic-countries filter — toggles whether shows must mention an Islamic country */}
          <button
            onClick={() => setIslamicOnly(!islamicOnly)}
            className="btn-base px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
            title={t('islamic_only_desc')}
            style={islamicOnly ? {
              background: 'linear-gradient(135deg, #0097a7 0%, #0e7490 100%)',
              color: 'white',
              border: '1px solid rgba(8, 145, 178, 0.5)',
            } : {
              background: 'var(--input-bg)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--input-border)',
            }}
          >
            🌍 {t('islamic')}
          </button>

          {/* 🖼 Has-image filter — only shows with at least one image attached */}
          <button
            onClick={() => setHasImageOnly(!hasImageOnly)}
            className="btn-base px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
            title={t('has_image_only_desc')}
            style={hasImageOnly ? {
              background: 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
              color: 'white',
              border: '1px solid rgba(219, 39, 119, 0.5)',
            } : {
              background: 'var(--input-bg)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--input-border)',
            }}
          >
            🖼 {t('has_image')}
          </button>

          {/* 🎬 Has-video filter — only shows with at least one video link */}
          <button
            onClick={() => setHasVideoOnly(!hasVideoOnly)}
            className="btn-base px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
            title={t('has_video_only_desc')}
            style={hasVideoOnly ? {
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: 'white',
              border: '1px solid rgba(220, 38, 38, 0.5)',
            } : {
              background: 'var(--input-bg)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--input-border)',
            }}
          >
            🎬 {t('has_video')}
          </button>

          {/* ⚖ Compare MODE toggle — always visible. Flips `compareMode`, which
              reveals the ⚖ button on every program card. When 2 are selected, the
              ⚖ مقایسه (N) action button below opens the modal. */}
          {onToggleCompare && onCompare && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className="btn-base px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0"
              title={t('compare_mode')}
              style={compareMode ? {
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              } : {
                background: 'var(--input-bg)',
                color: 'var(--fg-muted)',
                border: '1px solid var(--input-border)',
              }}
            >
              ⚖ {compareMode && Array.isArray(compareList) && compareList.length > 0
                ? `${t('compare')} (${compareList.length.toLocaleString('fa-IR')})`
                : t('compare')}
            </button>
          )}

          {/* ⚖ Open-compare button — only when exactly 2 programs are queued AND compare mode is on. */}
          {compareMode && onCompare && Array.isArray(compareList) && compareList.length === 2 && (
            <button
              onClick={onCompare}
              className="btn-base px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 animate-fade-in"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.5)',
              }}
              title={t('compare_two_programs')}
            >
              ⚖ {t('compare')} ({compareList.length.toLocaleString('fa-IR')})
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className="btn-base px-4 py-2 rounded-xl text-sm font-medium flex-1"
              style={selectionMode ? {
                background: 'var(--accent-bg-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--accent-text)',
              } : {
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                color: 'var(--fg-muted)',
              }}
            >
              {selectionMode ? `✓ ${t('multi_select_count')} (${selectedIds.length.toLocaleString('fa-IR')})` : t('multi_select')}
            </button>
          )}
          {!canEdit && (
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium flex-1 text-center text-fg-muted"
              style={{
                background: 'rgba(122, 138, 128, 0.08)',
                color: 'var(--fg-muted)',
                border: '1px solid var(--input-border)',
              }}
              title={t('no_access_desc')}
            >
              🔒 {t('view_only_desc')}
            </div>
          )}
        </div>

        {/* Filters — decor size & style chips ONLY render in the decor (all-programs) view.
            Other genres hide these because they are decor-specific dimensions. */}
        {decorFiltersVisible && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="text-sm flex-shrink-0 text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('size_label')}</span>
              {[
                { key: 'all', label: t('all') },
                { key: 'بزرگ/لوکس', label: t('large_lux') },
                { key: 'متوسط/استاندارد', label: t('medium_std') },
                { key: 'کوچک/اقتصادی', label: t('small_econ') },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterSize(f.key)}
                  className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                  style={filterSize === f.key ? {
                    background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
                    color: 'white',
                  } : {
                    background: 'var(--input-bg)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="text-sm flex-shrink-0 text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('style_label')}</span>
              {[
                { key: 'all', label: t('all') },
                { key: 'مدرن', label: t('modern') },
                { key: 'ترکیبی', label: t('composite') },
                { key: 'مینیمال', label: t('minimal') },
                { key: 'کلاسیک/سنتی', label: t('classic') },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStyle(f.key)}
                  className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
                  style={filterStyle === f.key ? {
                    background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
                    color: 'white',
                  } : {
                    background: 'var(--input-bg)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectionMode && selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-3 pt-3"
            style={{ borderTop: '1px solid var(--input-border)' }}
          >
            <span className="font-medium text-sm text-fg-strong" style={{ color: 'var(--accent-text)' }}>
              {selectedIds.length.toLocaleString('fa-IR')} {t('selected')}
            </span>
            <button
              onClick={handleUploadSelected}
              className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)' }}
            >
              📱 {t('publish_social')}
            </button>
            <button
              onClick={handlePDF}
              className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            >
              📄 {t('pdf_report')}
            </button>
            <button
              onClick={handleExcel}
              className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(0, 188, 212, 0.15)', color: '#0097a7', border: '1px solid rgba(0, 188, 212, 0.3)' }}
            >
              📊 {t('excel_report')}
            </button>
            <button
              onClick={() => { setSelectedIds([]); setSelectionMode(false); }}
              className="btn-base px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(122, 138, 128, 0.15)', color: 'var(--fg-muted)', border: '1px solid var(--input-border)' }}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {/* Loading skeletons — shown while data is arriving */}
      {loading && (
        <div className={view === 'grid'
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in"
          : "space-y-2 animate-fade-in"}>
          {Array.from({ length: view === 'grid' ? 8 : 5 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: view === 'grid' ? 320 : 100 }}>
              <div className="p-4 flex flex-col gap-3" style={{ height: '100%' }}>
                {view === 'grid' ? (
                  <>
                    <div className="skeleton-line" style={{ height: '140px', borderRadius: '12px' }} />
                    <div className="skeleton-line" style={{ width: '60%' }} />
                    <div className="skeleton-line" style={{ width: '90%' }} />
                    <div className="skeleton-line" style={{ width: '40%' }} />
                  </>
                ) : (
                  <div className="flex items-center gap-3 h-full">
                    <div className="skeleton-line" style={{ width: '56px', height: '56px', borderRadius: '12px' }} />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="skeleton-line" style={{ width: '50%' }} />
                      <div className="skeleton-line" style={{ width: '80%' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredShows.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('no_programs')}</h3>
            <p className="text-sm mt-1 text-fg-muted" style={{ color: 'var(--fg-muted)', maxWidth: '420px' }}>{t('no_programs_desc')}</p>
          </div>
        </div>
      ) : !loading && view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-view-enter">
          {pageShows.map(s => (
            <ProgramCard
              key={s.num}
              show={s}
              genre={genre}
              selectionMode={selectionMode}
              selected={selectedIds.includes(s.num)}
              isUploaded={uploadedShows.includes(s.num)}
              isBookmarked={bookmarks?.includes(s.num)}
              compareActive={compareMode}
              compareSelected={compareList?.includes(s.num) || false}
              onToggle={() => {
                if (selectedIds.includes(s.num)) setSelectedIds(selectedIds.filter(x => x !== s.num));
                else setSelectedIds([...selectedIds, s.num]);
              }}
              onClick={() => {
                if (compareMode && onToggleCompare) { onToggleCompare(s.num); return; }
                if (!selectionMode) onShowClick(s);
              }}
              onToggleBookmark={onToggleBookmark ? () => onToggleBookmark(s.num) : undefined}
              onToggleCompare={onToggleCompare ? () => onToggleCompare(s.num) : undefined}
            />
          ))}
        </div>
      ) : !loading && (
        <div className="space-y-2 animate-view-enter">
          {pageShows.map(s => (
            <ProgramListRow
              key={s.num}
              show={s}
              genre={genre}
              selectionMode={selectionMode}
              selected={selectedIds.includes(s.num)}
              isUploaded={uploadedShows.includes(s.num)}
              isBookmarked={bookmarks?.includes(s.num)}
              compareActive={compareMode}
              compareSelected={compareList?.includes(s.num) || false}
              onToggle={() => {
                if (selectedIds.includes(s.num)) setSelectedIds(selectedIds.filter(x => x !== s.num));
                else setSelectedIds([...selectedIds, s.num]);
              }}
              onClick={() => {
                if (compareMode && onToggleCompare) { onToggleCompare(s.num); return; }
                if (!selectionMode) onShowClick(s);
              }}
              onToggleBookmark={onToggleBookmark ? () => onToggleBookmark(s.num) : undefined}
              onToggleCompare={onToggleCompare ? () => onToggleCompare(s.num) : undefined}
            />
          ))}
        </div>
      )}

      {/* Real pagination — 24 programs per page with numbered page buttons */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 mt-8 flex-wrap animate-view-enter"
          style={{ direction: 'ltr' }}
        >
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn-base px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              background: currentPage === 1 ? 'rgba(0,0,0,0.04)' : 'var(--accent-bg-soft)',
              color: currentPage === 1 ? '#bbb' : 'var(--accent-text)',
              border: '1px solid var(--accent-border)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.6 : 1,
            }}
            aria-label={t('prev')}
          >
            › {t('prev')}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => {
              if (p === 1 || p === totalPages) return true;
              if (Math.abs(p - currentPage) <= 2) return true;
              return false;
            })
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsisBefore = prev && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsisBefore && <span style={{ color: 'var(--fg-muted)', padding: '0 4px' }}>…</span>}
                  <button
                    onClick={() => setPage(p)}
                    className="btn-base min-w-[40px] px-3 py-2 rounded-lg text-sm font-bold"
                    style={p === currentPage ? {
                      background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
                      color: 'white',
                      border: '1px solid #00bcd4',
                      boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)',
                    } : {
                      background: 'var(--glass-bg-solid)',
                      color: 'var(--fg-muted)',
                      border: '1px solid var(--input-border)',
                    }}
                  >
                    {p.toLocaleString('fa-IR')}
                  </button>
                </span>
              );
            })}
          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="btn-base px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              background: currentPage === totalPages ? 'rgba(0,0,0,0.04)' : 'var(--accent-bg-soft)',
              color: currentPage === totalPages ? '#bbb' : 'var(--accent-text)',
              border: '1px solid var(--accent-border)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.6 : 1,
            }}
            aria-label={t('next')}
          >
            {t('next')} ‹
          </button>
        </div>
      )}

      {filteredShows.length > 0 && (
        <div className="text-center mt-4 text-fg-muted" style={{ color: 'var(--fg-muted)' }}>
          <p className="text-sm">
            {t('page_x_of_y')} {currentPage.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')} •
            {t('showing_x_y_of_z')} {(pageStart + 1).toLocaleString('fa-IR')}–{Math.min(pageStart + PAGE_SIZE, filteredShows.length).toLocaleString('fa-IR')} / {filteredShows.length.toLocaleString('fa-IR')} {t('programs_count')}
          </p>
        </div>
      )}
    </>
  );
}

function ProgramCard({ show, selectionMode, selected, isUploaded, onToggle, onClick, genre, isBookmarked, onToggleBookmark, compareActive, compareSelected, onToggleCompare }: {
  show: TalkShow;
  selectionMode: boolean;
  selected: boolean;
  isUploaded: boolean;
  onToggle: () => void;
  onClick: () => void;
  genre?: Genre | null;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  compareActive?: boolean;
  compareSelected?: boolean;
  onToggleCompare?: () => void;
}) {
  const thumb = getShowThumbnail(show);
  const dark = adjustColor(thumb.accent, -40);
  const darker = adjustColor(thumb.accent, -70);
  const { t } = useLang();
  // Section-specific tags derived from the genre (fallback to decor's style/size/viewers).
  const genreTags = renderGenreTags(show, genre);
  // User-defined tags on the show itself (purple badges).
  const userTags = show.tags && show.tags.length > 0 ? show.tags : [];
  return (
    <div
      onClick={selectionMode ? onToggle : onClick}
      className={`premium-show-card${selected ? ' is-selected' : ''}`}
      style={{
        background: 'var(--card-bg)',
        border: compareSelected ? '2px solid #FACC15' : selected ? '2px solid #26c6da' : '1px solid var(--card-border)',
        boxShadow: compareSelected
          ? '0 0 0 2px rgba(250, 204, 21, 0.5), 0 8px 32px rgba(250, 204, 21, 0.18), 0 4px 16px rgba(0,0,0,0.5)'
          : selected
          ? '0 0 0 2px rgba(0, 188, 212, 0.5), 0 8px 32px rgba(0, 188, 212, 0.25), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
      onMouseEnter={(e) => {
        if (!selected && !compareSelected) {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.borderColor = '#FACC15';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(250, 204, 21, 0.18), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected && !compareSelected) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--card-border)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)';
        }
      }}
    >
      {/* Thumbnail — real image from PDF if available, otherwise gradient */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{
          background: thumb.gradient,
          borderRadius: '14px 14px 0 0',
        }}
      >
        {thumb.image ? (
          <img
            src={thumb.image}
            alt={show.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
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

        {/* Image gradient overlay — adds cinematic depth on top of the thumbnail */}
        <div className="image-overlay" />

        {/* ★ Bookmark button — top-right of thumbnail */}
        {onToggleBookmark && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
            aria-label={isBookmarked ? t('remove_from_bookmarks') : t('add_to_bookmarks')}
            title={isBookmarked ? t('remove_from_bookmarks') : t('add_to_bookmarks')}
            className="btn-base absolute p-1.5 rounded-full"
            style={{
              top: '8px',
              right: '8px',
              background: isBookmarked ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0, 0, 0, 0.55)',
              color: isBookmarked ? 'white' : '#fde68a',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 15,
              fontSize: '14px',
              lineHeight: 1,
              minWidth: '32px',
              minHeight: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isBookmarked ? '0 2px 8px rgba(245,158,11,0.6)' : 'none',
            }}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}

        {/* ⚖ Compare toggle — bottom-right of thumbnail (only shown when compare is active) */}
        {onToggleCompare && compareActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            aria-label={compareSelected ? t('remove_from_compare') : t('add_to_compare')}
            title={compareSelected ? t('remove_from_compare') : t('add_to_compare')}
            className="btn-base absolute p-1.5 rounded-full"
            style={{
              bottom: '8px',
              left: '8px',
              background: compareSelected ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0, 0, 0, 0.55)',
              color: compareSelected ? 'white' : '#fde68a',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 15,
              fontSize: '13px',
              lineHeight: 1,
              minWidth: '32px',
              minHeight: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: compareSelected ? '0 2px 8px rgba(245,158,11,0.6)' : 'none',
            }}
          >
            ⚖
          </button>
        )}

        {/* Multi-image badge — shows count when more than 1 image */}
        {show.images && show.images.length > 1 && (
          <span
            className="absolute text-xs px-2 py-0.5 rounded-md backdrop-blur font-bold flex items-center gap-1"
            style={{
              background: 'rgba(0, 0, 0, 0.75)', color: 'white',
              top: onToggleBookmark ? '44px' : '8px',
              right: '8px',
            }}
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
              top: show.images && show.images.length > 1 ? (onToggleBookmark ? '80px' : '44px') : (onToggleBookmark ? '44px' : '8px'),
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
              background: 'rgba(255,255,255,0.85)',
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
            style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            {show.style}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              👥 تماشاگر
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2 text-white" style={{ direction: 'ltr', textAlign: 'right', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
          {show.name}
        </h3>

        <p className="text-xs line-clamp-2 mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {show.summary && show.summary !== '—' ? show.summary : show.category}
        </p>

        {/* Section-specific genre tags (small white badges) */}
        {genreTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
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
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.65)', color: 'white', border: '1px solid rgba(168, 85, 247, 0.7)' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <span className="truncate" title={show.category}>
            {show.category.replace(/^\d+\.\s*/, '').substring(0, 18)}
          </span>
          <span className="font-bold text-white">#{show.num.toLocaleString('fa-IR')}</span>
        </div>
      </div>
    </div>
  );
}

function ProgramListRow({ show, selectionMode, selected, isUploaded, onToggle, onClick, genre, isBookmarked, onToggleBookmark, compareActive, compareSelected, onToggleCompare }: {
  show: TalkShow;
  selectionMode: boolean;
  selected: boolean;
  isUploaded: boolean;
  onToggle: () => void;
  onClick: () => void;
  genre?: Genre | null;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  compareActive?: boolean;
  compareSelected?: boolean;
  onToggleCompare?: () => void;
}) {
  const thumb = getShowThumbnail(show);
  const dark = adjustColor(thumb.accent, -40);
  const darker = adjustColor(thumb.accent, -70);
  const genreTags = renderGenreTags(show, genre);
  const userTags = show.tags && show.tags.length > 0 ? show.tags : [];
  const { t } = useLang();
  return (
    <div
      onClick={selectionMode ? onToggle : onClick}
      className="premium-show-card"
      style={{
        background: `linear-gradient(135deg, ${thumb.accent} 0%, ${dark} 60%, ${darker} 100%)`,
        border: selected ? `3px solid white` : compareSelected ? `3px solid #f59e0b` : `1px solid ${adjustColor(thumb.accent, 30)}`,
        boxShadow: selected
          ? `0 0 0 3px ${thumb.accent}, 0 12px 40px ${thumb.accent}50`
          : compareSelected
          ? `0 0 0 3px #f59e0b, 0 12px 40px ${thumb.accent}50`
          : `0 10px 32px ${thumb.accent}40, 0 3px 10px ${thumb.accent}25, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.filter = 'brightness(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.filter = 'brightness(1)';
        }
      }}
    >
      {selectionMode && (
        <div
          className="w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0"
          style={selected ? {
            background: thumb.accent,
            borderColor: thumb.accent,
          } : {
            borderColor: `${thumb.accent}90`,
            background: 'rgba(255,255,255,0.7)',
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
            style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            {show.style}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>
            {show.size}
          </span>
          {show.viewers === 'با تماشاگر' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              👥
            </span>
          )}
          {isUploaded && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              ☁
            </span>
          )}
        </div>
        <h3 className="font-bold text-sm mb-1 truncate text-white" style={{ direction: 'ltr', textAlign: 'right', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{show.name}</h3>
        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{show.summary && show.summary !== '—' ? show.summary : show.category}</p>
        {(genreTags.length > 0 || userTags.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {genreTags.map(t => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                {t.label}
              </span>
            ))}
            {userTags.slice(0, 3).map((t, i) => (
              <span
                key={`u${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.65)', color: 'white', border: '1px solid rgba(168, 85, 247, 0.7)' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-center flex-shrink-0">
        {/* ★ Bookmark button — top-right of row */}
        {onToggleBookmark && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
            aria-label={isBookmarked ? t('remove_from_bookmarks') : t('add_to_bookmarks')}
            title={isBookmarked ? t('remove_from_bookmarks') : t('add_to_bookmarks')}
            className="btn-base block mb-2 mx-auto"
            style={{
              background: isBookmarked ? 'rgba(245, 158, 11, 0.95)' : 'rgba(255,255,255,0.2)',
              color: isBookmarked ? 'white' : '#fde68a',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '999px',
              width: '32px',
              height: '32px',
              fontSize: '14px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isBookmarked ? '0 2px 8px rgba(245,158,11,0.6)' : 'none',
            }}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}
        {/* ⚖ Compare toggle (only when compare mode is active) */}
        {onToggleCompare && compareActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            aria-label={compareSelected ? t('remove_from_compare') : t('add_to_compare')}
            title={compareSelected ? t('remove_from_compare') : t('add_to_compare')}
            className="btn-base block mb-2 mx-auto"
            style={{
              background: compareSelected ? 'rgba(245, 158, 11, 0.95)' : 'rgba(255,255,255,0.2)',
              color: compareSelected ? 'white' : '#fde68a',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '999px',
              width: '32px',
              height: '32px',
              fontSize: '14px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: compareSelected ? '0 2px 8px rgba(245,158,11,0.6)' : 'none',
            }}
          >
            ⚖
          </button>
        )}
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('show_num')}</div>
        <div className="font-bold text-sm text-white">#{show.num.toLocaleString('fa-IR')}</div>
      </div>
    </div>
  );
}

// ============================================
// SHOW DETAILS MODAL — with Persian description, links, publish, export
// ============================================
function ShowDetailsModal({ show, onClose, onEdit, onDelete, onPublish, onExport, isUploaded, canEdit, allShows = [], onSwapShow, isBookmarked, onToggleBookmark, onAddToCompare }: {
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
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onAddToCompare?: () => void;
}) {
  const thumb = getShowThumbnail(show);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useLang();
  // Related programs computed from the full list — capped at 6.
  const related = useMemo(
    () => allShows.length > 0 ? findRelated(show, allShows, 6) : [],
    [show, allShows]
  );
  // Detect Islamic-country mentions for the country badges.
  const countries = detectCountries(show);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
          )}
          {!thumb.image && <div className="absolute inset-0" style={{ background: thumb.pattern }}></div>}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label={t('close')}
            className="absolute p-2.5 rounded-lg"
            style={{
              top: '16px',
              left: '16px',
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 20,
              pointerEvents: 'auto',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
            <p className="text-sm opacity-90">{t('program_no_label')} {show.num.toLocaleString('fa-IR')}</p>
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
            <h4 className="font-bold mb-2" style={{ color: '#FFFFFF' }}>{t('about_program')}</h4>
            <p style={{ color: '#9CA3AF', lineHeight: 1.8 }}>{show.descriptionFa}</p>
          </div>

          {/* Video links gallery */}
          {show.videos && show.videos.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>
                🎬 {t('videos_of_program')}
                <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
                  ({show.videos.length.toLocaleString('fa-IR')} {t('videos_count_suffix')})
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
                        background: 'rgba(255,255,255,0.85)',
                        border: `1px solid ${platform.color}30`,
                        textDecoration: 'none',
                      }}
                    >
                      <div
                        className="w-20 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative"
                        style={{ background: thumbUrl ? '#000' : `${platform.color}20` }}
                      >
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
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
                          style={{ color: '#9CA3AF', direction: 'ltr', textAlign: 'left' }}
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
            <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>{t('direct_access')}</h4>
            <div className="flex flex-wrap gap-2">
              <a
                href={show.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)', textDecoration: 'none' }}
              >
                ▶ {t('watch_on_youtube')}
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
              📱 {t('publish_social')}
            </button>
            {onToggleBookmark && (
              <button
                onClick={onToggleBookmark}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={isBookmarked
                  ? { background: 'rgba(245, 158, 11, 0.25)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.55)' }
                  : { background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' }
                }
                title={isBookmarked ? t('remove_from_bookmarks') : t('add_to_bookmarks')}
              >
                {isBookmarked ? `★ ${t('bookmarked')}` : `☆ ${t('bookmark_verb')}`}
              </button>
            )}
            {onAddToCompare && (
              <button
                onClick={onAddToCompare}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                title={t('add_to_compare')}
              >
                ⚖ {t('add_to_compare')}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => onEdit(show)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(0, 188, 212, 0.15)', color: '#0097a7', border: '1px solid rgba(0, 188, 212, 0.3)' }}
              >
                ✏ {t('edit')}
              </button>
            )}
            <button
              onClick={() => onExport(show, 'pdf')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            >
              📄 {t('pdf_report')}
            </button>
            <button
              onClick={() => onExport(show, 'excel')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(0, 188, 212, 0.15)', color: '#0097a7', border: '1px solid rgba(0, 188, 212, 0.3)' }}
            >
              📊 {t('excel_report')}
            </button>
            {canEdit && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
              >
                🗑 {t('delete_program')}
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
                {t('confirm_delete_question')}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(122, 138, 128, 0.15)', color: '#9CA3AF', border: '1px solid rgba(122, 138, 128, 0.3)' }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => { onDelete(show.num); onClose(); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white' }}
                >
                  {t('yes_delete')}
                </button>
              </div>
            </div>
          )}

          {/* Decor details */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>{t('decor_scene_specs')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField label={t('category_label')} value={show.category} />
              <DetailField label={t('decor_style')} value={show.style} />
              <DetailField label={t('studio_size')} value={show.size} />
              <DetailField label={t('audience')} value={show.viewers} />
              <DetailField label={t('decor_style')} value={show.style} />
              <DetailField label={t('effects')} value={show.effects} />
              <DetailField label={t('layout')} value={show.layout} />
              <DetailField label={t('lighting')} value={show.lighting} />
              <DetailField label={t('decor_elements')} value={show.elements} />
              <DetailField label={t('materials')} value={show.materials} />
              <div className="sm:col-span-2">
                <DetailField label={t('colors')} value={show.colors} />
              </div>
            </div>
          </div>

          {/* Decor summary */}
          {show.summary && show.summary !== '—' && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: `${thumb.accent}10`, border: `1px solid ${thumb.accent}25` }}>
              <h4 className="font-bold mb-2" style={{ color: '#FFFFFF' }}>{t('decor_summary')}</h4>
              <p style={{ color: '#9CA3AF', lineHeight: 1.7 }}>{show.summary}</p>
            </div>
          )}

          {/* Tags section — user-defined tags + detected Islamic countries */}
          {((show.tags && show.tags.length > 0) || countries.length > 0 || show.country) && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>🏷 {t('tags_label')}</h4>
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
                  <span className="text-xs font-bold" style={{ color: '#6B7280' }}>🌍 {t('detected_countries')}</span>
                  {countries.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-md font-medium"
                      style={{ background: 'rgba(8, 145, 178, 0.15)', color: '#0e7490', border: '1px solid rgba(8, 145, 178, 0.3)' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {show.country && (
                <div className="text-xs" style={{ color: '#6B7280' }}>
                  {t('origin_country_entered')} <strong style={{ color: '#FFFFFF' }}>{show.country}</strong>
                </div>
              )}
            </div>
          )}

          {/* 🔗 Related programs — computed from allShows via findRelated */}
          {related.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold mb-3 text-fg-strong" style={{ color: 'var(--fg-strong)' }}>🔗 {t('related_programs')}</h4>
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
                          <img src={rThumb.image} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
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
      <div className="text-xs font-bold mb-1" style={{ color: '#6B7280' }}>{label}</div>
      <div className="text-sm" style={{ color: '#FFFFFF' }}>{value || '—'}</div>
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
      tags: [],
    }
  );
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleAutoFetch = async () => {
    if (!fetchUrl) {
      showToast(t('fetch_imdb_wiki_prompt'));
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
        showToast(t('fetch_failed_toast', { msg: data.error }));
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
        showToast(t('fetch_success_toast'));
      }
    } catch (e) {
      showToast(t('fetch_error_toast'));
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = () => {
    if (!form.name) {
      showToast(t('name_required_toast'));
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#FFFFFF' }}>
          {editingShow ? t('edit_program') : t('add_new_program')}
        </h1>
        <p style={{ color: '#6B7280' }}>
          {editingShow ? t('edit_program_no', { n: editingShow.num.toLocaleString('fa-IR') }) : t('fill_form_below')}
        </p>
      </header>

      <div className="premium-glass p-6 space-y-4">
        {/* Auto-fetch from IMDb/Wikipedia */}
        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid #2A2E35' }}>
          <h4 className="font-bold mb-2" style={{ color: 'var(--fg-strong)' }}>{t('auto_fetch_info')}</h4>
          <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>
            {t('auto_fetch_desc')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              placeholder={t('auto_fetch_placeholder')}
              className="input-base"
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
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

        <FormField label={t('program_name_required')} value={form.name || ''} onChange={v => setForm({ ...form, name: v })} placeholder={t('name_placeholder')} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label={t('category_label')}
            value={form.category || ''}
            onChange={v => setForm({ ...form, category: v })}
            options={genres.map(g => ({ value: g.nameFa, label: g.nameFa }))}
          />
          <FormField label={t('origin_country_label')} value={form.country || ''} onChange={v => setForm({ ...form, country: v })} placeholder={t('country_placeholder')} />
          <FormSelect
            label={t('studio_size')}
            value={form.size || ''}
            onChange={v => setForm({ ...form, size: v })}
            options={[
              { value: 'بزرگ/لوکس', label: t('large_lux') },
              { value: 'متوسط/استاندارد', label: t('medium_std') },
              { value: 'کوچک/اقتصادی', label: t('small_econ') },
            ]}
          />
          <FormSelect
            label={t('audience')}
            value={form.viewers || ''}
            onChange={v => setForm({ ...form, viewers: v })}
            options={[
              { value: 'با تماشاگر', label: t('with_audience') },
              { value: 'بدون تماشاگر', label: t('without_audience') },
              { value: 'نامشخص', label: t('decor_unknown') },
            ]}
          />
          <FormSelect
            label={t('decor_style')}
            value={form.style || ''}
            onChange={v => setForm({ ...form, style: v })}
            options={[
              { value: 'مدرن', label: t('modern') },
              { value: 'ترکیبی', label: t('composite') },
              { value: 'مینیمال', label: t('minimal') },
              { value: 'کلاسیک/سنتی', label: t('decor_classic_traditional') },
              { value: 'فاخر/تزئینی', label: t('decor_lux_decorative') },
            ]}
          />
          <FormSelect
            label={t('lighting')}
            value={form.lighting || ''}
            onChange={v => setForm({ ...form, lighting: v })}
            options={[
              { value: 'خنثی', label: t('decor_neutral') },
              { value: 'گرم', label: t('decor_warm') },
              { value: 'سرد', label: t('decor_cold') },
              { value: 'ترکیبی', label: t('composite') },
              { value: 'دراماتیک', label: t('decor_dramatic') },
            ]}
          />
        </div>

        <FormField label={t('decor_elements')} value={form.elements || ''} onChange={v => setForm({ ...form, elements: v })} placeholder={t('elements_placeholder')} />
        <FormField label={t('materials')} value={form.materials || ''} onChange={v => setForm({ ...form, materials: v })} placeholder={t('materials_placeholder')} />
        <FormField label={t('colors')} value={form.colors || ''} onChange={v => setForm({ ...form, colors: v })} placeholder={t('colors_placeholder')} />

        {/* Persian description */}
        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('about_program_fa')}</label>
          <textarea
            value={form.descriptionFa || ''}
            onChange={(e) => setForm({ ...form, descriptionFa: e.target.value })}
            placeholder={t('persian_description_placeholder')}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(0, 188, 212, 0.15)',
              background: 'rgba(30, 34, 40, 0.75)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('decor_summary')}</label>
          <textarea
            value={form.summary || ''}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder={t('decor_summary_placeholder')}
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(0, 188, 212, 0.15)',
              background: 'rgba(30, 34, 40, 0.75)',
              color: '#FFFFFF',
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
            {editingShow ? t('update_btn') : t('add_program_btn')}
          </button>
          <button
            onClick={() => { setEditingShow(null); onDone(); }}
            className="px-6 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(122, 138, 128, 0.15)', color: '#9CA3AF', border: '1px solid rgba(122, 138, 128, 0.3)' }}
          >
            {t('cancel')}
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
      <label className="text-sm font-bold mb-2 block" style={{ color: 'var(--fg-soft)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base"
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '10px',
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
      <label className="text-sm font-bold mb-2 block" style={{ color: 'var(--fg-soft)' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base"
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '10px',
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
  const { t, lang } = useLang();
  const [urlInput, setUrlInput] = useState('');
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to the latest images array so async FileReader callbacks always see current state
  const imagesRef = useRef<string[]>(images);
  imagesRef.current = images;
  const MAX_IMAGES = 8;
  const MAX_WIDTH = 1280;
  const JPEG_QUALITY = 0.8;

  // Compress a single image file via Canvas API:
  // - If wider than MAX_WIDTH (1280px), downscale to MAX_WIDTH preserving aspect ratio.
  // - Always re-encode as JPEG at JPEG_QUALITY (0.8) regardless of the source format.
  // This keeps localStorage usage small and avoids storing multi-MB base64 strings.
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t('image_compress_error_toast', { name: file.name })));
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new window.Image();
        img.onerror = () => reject(new Error(t('image_compress_error_toast', { name: file.name })));
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Canvas unavailable — fall back to original data URL.
            resolve(dataUrl);
            return;
          }
          // White background so transparent PNGs do not turn black when JPEG-encoded.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Re-encode as JPEG at quality 0.8.
          try {
            const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(compressed);
          } catch (e) {
            // Some browsers refuse to export large canvases — fall back to original.
            resolve(dataUrl);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    if (images.length >= MAX_IMAGES) {
      showToast(t('max_images_toast', { n: MAX_IMAGES }));
      return;
    }
    if (images.includes(urlInput.trim())) {
      showToast(t('image_duplicate_toast'));
      return;
    }
    onChange([...images, urlInput.trim()]);
    setUrlInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const remaining = MAX_IMAGES - imagesRef.current.length;
    const toAdd = fileArr.slice(0, remaining);
    if (toAdd.length < fileArr.length) {
      showToast(t('images_added_partial_toast', { added: toAdd.length, max: MAX_IMAGES }));
    }
    setCompressing(true);
    try {
      for (const file of toAdd) {
        try {
          const compressed = await compressImage(file);
          const current = imagesRef.current;
          if (current.length < MAX_IMAGES && !current.includes(compressed)) {
            onChange([...current, compressed]);
          }
        } catch (err: any) {
          showToast(err?.message || t('image_compress_error_toast', { name: file.name }));
        }
      }
    } finally {
      setCompressing(false);
      // Reset file input so same file can be re-selected later
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.15)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold" style={{ color: '#FFFFFF' }}>
          🖼 {t('program_images')}
          <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
            ({images.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} {t('image_count_of')} {MAX_IMAGES.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')})
          </span>
        </h4>
        {images.length > 0 && (
          <span className="text-xs" style={{ color: '#0097a7' }}>{t('first_image_cover')}</span>
        )}
      </div>

      {/* Compression notice */}
      <div className="text-xs mb-3" style={{ color: '#6B7280' }}>
        {t('compression_notice')}
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
            border: '1px solid rgba(0,188,212,0.15)',
            background: images.length >= MAX_IMAGES ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.85)',
            color: '#FFFFFF',
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
            background: images.length >= MAX_IMAGES || !urlInput.trim() ? 'rgba(0,0,0,0.05)' : 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
            color: images.length >= MAX_IMAGES || !urlInput.trim() ? '#999' : 'white',
            border: '1px solid rgba(0,188,212,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          + {t('add_link')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES || compressing}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: images.length >= MAX_IMAGES || compressing ? 'rgba(0,0,0,0.05)' : 'rgba(0,188,212,0.1)',
            color: images.length >= MAX_IMAGES || compressing ? '#999' : '#0097a7',
            border: '1px solid rgba(0,188,212,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {compressing ? t('fetching') : `📁 ${t('upload_file')}`}
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
          style={{ background: 'rgba(255,255,255,0.5)', border: '2px dashed rgba(0,188,212,0.2)' }}
        >
          <div className="text-3xl mb-2 opacity-40">🖼</div>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {t('no_images_yet')}
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
                border: idx === 0 ? '3px solid #00bcd4' : '1px solid #e0e8e4',
                background: '#f0f4f1',
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
                  style={{ background: '#00bcd4', color: 'white' }}
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
                    background: idx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)',
                    color: idx === 0 ? 'rgba(255,255,255,0.5)' : '#0d1f2c',
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
                  title={t('cancel')}
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
                    background: idx === images.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)',
                    color: idx === images.length - 1 ? 'rgba(255,255,255,0.5)' : '#0d1f2c',
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
                border: '2px dashed rgba(0,188,212,0.3)',
                background: 'rgba(0,188,212,0.04)',
                color: '#0097a7',
                cursor: 'pointer',
              }}
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">{t('add_btn')}</span>
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
  const { t, lang } = useLang();
  const [urlInput, setUrlInput] = useState('');
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const addVideo = () => {
    if (!urlInput.trim()) return;
    if (videos.includes(urlInput.trim())) return;
    onVideosChange([...videos, urlInput.trim()]);
    setUrlInput('');
  };

  const removeVideo = (idx: number) => {
    onVideosChange(videos.filter((_, i) => i !== idx));
  };

  // Validate a video file:
  // - Max file size: 5 MB
  // - Max duration: 30 seconds (checked by loading it into a <video> element)
  // The video file is NOT stored locally (too large for localStorage); we just
  // surface warnings and let the user know the file is too big / too long.
  const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
  const MAX_VIDEO_DURATION = 30;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadWarning(null);
    // Size check
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadWarning(
        lang === 'en'
          ? `⚠ File size ${formatBytes(file.size)} exceeds the limit (${formatBytes(MAX_VIDEO_BYTES)}). Please choose a smaller file.`
          : `⚠ حجم فایل ${formatBytes(file.size)} است — بیش از حد مجاز (${formatBytes(MAX_VIDEO_BYTES)}). لطفاً فایل کوچک‌تری انتخاب کنید.`
      );
      if (videoFileRef.current) videoFileRef.current.value = '';
      return;
    }
    // Duration check via a temporary <video> element.
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = v.duration;
      if (duration > MAX_VIDEO_DURATION) {
        setUploadWarning(
          lang === 'en'
            ? `⚠ Video duration ${duration.toFixed(1)}s exceeds the limit (${MAX_VIDEO_DURATION}s). Please choose a shorter video.`
            : `⚠ مدت ویدیو ${duration.toFixed(1)} ثانیه است — بیش از حد مجاز (${MAX_VIDEO_DURATION} ثانیه). لطفاً ویدیوی کوتاه‌تری انتخاب کنید.`
        );
      } else {
        setUploadWarning(lang === 'en'
          ? `✓ File "${file.name}" accepted (${formatBytes(file.size)}, ${duration.toFixed(1)}s) — but videos are not stored locally in this version. Please upload it to a video sharing service (YouTube, Aparat, ...) and add the link.`
          : `✓ فایل «${file.name}» قابل قبول است (${formatBytes(file.size)}، ${duration.toFixed(1)} ثانیه) — اما ویدیوها در نسخهٔ فعلی به‌صورت بومی ذخیره نمی‌شوند. لطفاً آن را در سرویس اشتراک‌گذاری ویدیو (یوتیوب، آپارات و...) آپلود کنید و لینک را اضافه کنید.`
        );
      }
      if (videoFileRef.current) videoFileRef.current.value = '';
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      setUploadWarning(lang === 'en' ? '⚠ Invalid video file or cannot be read.' : '⚠ فایل ویدیو نامعتبر است یا قابل خواندن نیست.');
      if (videoFileRef.current) videoFileRef.current.value = '';
    };
    v.src = url;
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.15)' }}>
      <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>
        🎬 {t('program_videos')}
        <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
          ({videos.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} {t('videos_count_suffix')})
        </span>
      </h4>

      {/* Constraints reminder */}
      <div className="text-xs mb-3" style={{ color: '#6B7280' }}>
        {t('video_constraints')}
      </div>

      {/* Video file upload (with size + duration validation) */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => videoFileRef.current?.click()}
          className="px-3 py-2 rounded-xl text-sm font-medium"
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('select_video_file')}
        </button>
        <input
          ref={videoFileRef}
          type="file"
          accept="video/*"
          onChange={handleVideoFile}
          style={{ display: 'none' }}
        />
      </div>

      {uploadWarning && (
        <div
          className="mb-3 p-3 rounded-xl text-xs font-medium"
          style={{
            background: uploadWarning.startsWith('✓') ? 'rgba(0,188,212,0.1)' : 'rgba(220,38,38,0.1)',
            color: uploadWarning.startsWith('✓') ? '#0097a7' : '#dc2626',
            border: uploadWarning.startsWith('✓') ? '1px solid rgba(0,188,212,0.3)' : '1px solid rgba(220,38,38,0.3)',
          }}
        >
          {uploadWarning}
        </div>
      )}

      {/* Main YouTube search link field (auto-generated) */}
      <div className="mb-3">
        <label className="text-xs font-bold mb-1 block" style={{ color: '#9CA3AF' }}>{t('youtube_search_link')}</label>
        <input
          type="text"
          value={youtube}
          onChange={(e) => onYoutubeChange(e.target.value)}
          placeholder="https://www.youtube.com/results?search_query=..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(0,188,212,0.15)',
            background: 'rgba(255,255,255,0.85)',
            color: '#FFFFFF',
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
          placeholder={t('paste_video_url')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(0,188,212,0.15)',
            background: 'rgba(255,255,255,0.85)',
            color: '#FFFFFF',
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
            background: !urlInput.trim() ? 'rgba(0,0,0,0.05)' : 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
            color: !urlInput.trim() ? '#999' : 'white',
            border: '1px solid rgba(0,188,212,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          + {t('add_video')}
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
                style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,188,212,0.1)' }}
              >
                {/* Thumbnail or icon */}
                <div
                  className="w-16 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: thumb ? '#000' : `${platform.color}20` }}
                >
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
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
                    style={{ color: '#9CA3AF', direction: 'ltr', textAlign: 'left' }}
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
                  style={{ background: 'rgba(0,188,212,0.1)', color: '#0097a7' }}
                  title={t('open_btn')}
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
                  title={t('cancel')}
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
  const { t, lang } = useLang();
  const [input, setInput] = useState('');

  const commit = (next: string[]) => {
    // De-duplicate + trim. Empty strings are dropped.
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const tag of next) {
      const s = (tag || '').trim();
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
      <h4 className="font-bold mb-2" style={{ color: '#FFFFFF' }}>
        🏷 {t('tags_label')}
        <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
          ({tags.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} {t('tags_label')})
        </span>
      </h4>
      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
        {t('tags_hint')}
      </p>

      {/* Comma-separated input + Add button */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(); } }}
          placeholder={t('tags_placeholder')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            background: 'rgba(255,255,255,0.85)',
            color: '#FFFFFF',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={addFromInput}
          disabled={!input.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: !input.trim() ? 'rgba(0,0,0,0.05)' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            color: !input.trim() ? '#999' : 'white',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          + {t('add_btn')}
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
                aria-label={`${t('cancel')} ${tag}`}
                className="hover:opacity-70"
                style={{ color: '#7c3aed', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                title={t('cancel')}
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs px-2 py-1 rounded-md font-medium"
            style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.25)' }}
            title={t('clear_all')}
          >
            {t('clear_all')}
          </button>
        </div>
      )}

      {/* Preset quick-add buttons (from the genre's presetTags) */}
      {presetTags && presetTags.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: '#9CA3AF' }}>{t('preset_tags_hint')}</div>
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
  '#00bcd4', '#0097a7', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0e7490',
];

function AddGenreModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (g: Genre) => void;
}) {
  const { t, lang } = useLang();
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
      description: description.trim() || (lang === 'en' ? `Custom genre: ${trimmed}` : `ژانر سفارشی: ${trimmed}`),
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
      <div className="modal-content" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,188,212,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{t('add_genre_new')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('genre_name_required')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('genre_name_placeholder')}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 188, 212, 0.15)',
                background: 'rgba(255,255,255,0.85)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('description_label')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description_placeholder')}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 188, 212, 0.15)',
                background: 'rgba(255,255,255,0.85)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('genre_color_label')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {GENRE_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-9 h-9 rounded-full transition-all"
                  style={{
                    background: c,
                    border: color === c ? '3px solid #00bcd4' : '3px solid transparent',
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
            <div className="text-xs font-bold mb-1" style={{ color: '#6B7280' }}>{t('preview_label')}</div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              ></span>
              <strong style={{ color: '#FFFFFF' }}>{name || t('genre_preview_default')}</strong>
            </div>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{description || t('genre_default_desc')}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-enter-premium flex-1"
              style={{ opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
            >
              {t('save_genre')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(122,138,128,0.15)', color: '#9CA3AF', border: '1px solid rgba(122,138,128,0.3)' }}
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
  { id: 'gap', name: 'گپ', color: '#26c6da', icon: '💬' },
  { id: 'instagram', name: 'اینستاگرام', color: '#e1306c', icon: '📷' },
];

function PublishModal({ shows, onClose, onConfirm, onOpenBotConfig }: {
  shows: TalkShow[];
  onClose: () => void;
  onConfirm: (platform: string) => void;
  onOpenBotConfig: () => void;
}) {
  const { t, lang } = useLang();
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

  const directSendSupported = selectedPlatform === t('telegram_label') || selectedPlatform === t('bale_label');

  // Send the post directly to the selected channel via the /api/publish-social route.
  const handleDirectSend = async () => {
    if (!botConfig || !botConfig.token || !botConfig.chatId) {
      setSendResult({ ok: false, msg: t('bot_config_required_toast') });
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
        setSendResult({ ok: true, msg: t('post_sent_to', { platform: selectedPlatform }) });
      } else {
        setSendResult({ ok: false, msg: t('post_send_failed', { msg: data.error || t('post_send_failed', { msg: '' }) }) });
      }
    } catch {
      setSendResult({ ok: false, msg: t('post_send_network_error') });
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
    grad.addColorStop(0, '#00bcd4');
    grad.addColorStop(0.6, '#0097a7');
    grad.addColorStop(1, '#014824');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative circles
    ctx.fillStyle = 'rgba(0, 188, 212, 0.15)';
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,188,212,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{t('publish_social_title')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform selection */}
          <div>
            <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>{t('select_platform')}</h4>
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
            <h4 className="font-bold mb-3" style={{ color: '#FFFFFF' }}>{t('post_preview')}</h4>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              {/* Card image preview — real program image or 1080x1080 social card */}
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '1/1',
                  background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 60%, #0097a7 100%)',
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
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                )}
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(1,10,5,0.3) 0%, rgba(1,10,5,0.8) 100%)' }}></div>

                <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center text-white">
                  <div className="text-xs mb-3 opacity-60">{t('banke_rasane_brand')}</div>
                  <div className="text-2xl font-bold mb-4">
                    {shows.length === 1 ? shows[0].name : t('social_card_programs_count', { n: shows.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR') })}
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
                    {shows[0]?.category?.replace(/^\d+\.\s*/, '') || (lang === 'en' ? 'Talk show' : 'تاک‌شو')}
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
                  background: '#1E2228',
                  color: '#FFFFFF',
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
                style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.18)' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: '#FFFFFF' }}>{t('direct_send_to', { platform: selectedPlatform })}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>
                      {botConfig
                        ? t('bot_configured', { platform: botConfig.platform === 'telegram' ? t('telegram_label') : t('bale_label'), chatId: botConfig.chatId })
                        : t('bot_config_required')}
                    </div>
                  </div>
                  <button
                    onClick={onOpenBotConfig}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{ background: 'rgba(0,188,212,0.12)', color: '#0097a7', border: '1px solid rgba(0,188,212,0.3)' }}
                  >
                    {botConfig ? t('bot_settings') : t('configure_bot')}
                  </button>
                </div>
                <button
                  onClick={handleDirectSend}
                  disabled={!botConfig || sending}
                  className="btn-enter-premium w-full mt-3"
                  style={{ opacity: botConfig && !sending ? 1 : 0.5, cursor: botConfig && !sending ? 'pointer' : 'not-allowed' }}
                >
                  {sending ? t('sending') : t('direct_send_to', { platform: selectedPlatform })}
                </button>
                {sendResult && (
                  <div
                    className="mt-2 text-xs font-medium px-3 py-2 rounded-lg"
                    style={{
                      background: sendResult.ok ? 'rgba(0,188,212,0.12)' : 'rgba(220,38,38,0.1)',
                      color: sendResult.ok ? '#0097a7' : '#dc2626',
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
                {selectedPlatform ? t('manual_publish_to', { platform: selectedPlatform }) : t('select_platform_first')}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(122,138,128,0.15)', color: '#9CA3AF', border: '1px solid rgba(122,138,128,0.3)' }}
              >
                {t('cancel')}
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
  const initial = loadBotConfig();
  const [platform, setPlatform] = useState<'telegram' | 'bale'>(initial?.platform || 'telegram');
  const [token, setToken] = useState(initial?.token || '');
  const [chatId, setChatId] = useState(initial?.chatId || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleTest = async () => {
    if (!token) { setTestResult({ ok: false, msg: t('bot_token_required') }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/publish-social?platform=${platform}&token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: t('bot_test_ok', { name: data.bot.username }) });
      } else {
        setTestResult({ ok: false, msg: t('post_send_failed', { msg: data.error || t('bot_test_invalid') }) });
      }
    } catch {
      setTestResult({ ok: false, msg: t('bot_test_network_error') });
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
      <div className="modal-content" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,188,212,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{t('bot_config_title')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Intro help */}
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.15)', color: '#9CA3AF' }}>
            {t('bot_config_help_intro')}
            <ul className="mt-2 space-y-1 text-xs" style={{ color: '#6B7280' }}>
              <li>{t('bot_config_help_tg')}</li>
              <li>{t('bot_config_help_bale')}</li>
              <li>{t('bot_config_help_admin')}</li>
            </ul>
          </div>

          {/* Platform picker */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('platform_label')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPlatform('telegram')}
                className="p-3 rounded-xl text-center transition-all"
                style={platform === 'telegram' ? { background: '#0088cc', color: 'white', border: '2px solid #0088cc' } : { background: '#0088cc15', color: '#0088cc', border: '1px solid #0088cc30' }}
              >
                <div className="text-2xl mb-1">✈</div>
                <div className="text-sm font-bold">{t('telegram_label')}</div>
              </button>
              <button
                onClick={() => setPlatform('bale')}
                className="p-3 rounded-xl text-center transition-all"
                style={platform === 'bale' ? { background: '#ffaa00', color: 'white', border: '2px solid #ffaa00' } : { background: '#ffaa0015', color: '#ffaa00', border: '1px solid #ffaa0030' }}
              >
                <div className="text-2xl mb-1">💬</div>
                <div className="text-sm font-bold">{t('bale_label')}</div>
              </button>
            </div>
          </div>

          {/* Bot token */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('bot_token_label')}</label>
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
                  border: '1px solid rgba(0,188,212,0.15)',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#FFFFFF',
                  fontFamily: 'monospace',
                  outline: 'none',
                  textAlign: 'left',
                }}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="px-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(122,138,128,0.15)', color: '#9CA3AF', border: '1px solid rgba(122,138,128,0.3)' }}
              >
                {showToken ? t('hide_btn') : t('show_btn')}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label className="text-sm font-bold mb-2 block" style={{ color: '#FFFFFF' }}>{t('chat_id_label')}</label>
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
                border: '1px solid rgba(0,188,212,0.15)',
                background: 'rgba(255,255,255,0.9)',
                color: '#FFFFFF',
                fontFamily: 'monospace',
                outline: 'none',
                textAlign: 'left',
              }}
            />
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              {t('chat_id_help')}
            </p>
          </div>

          {/* Test button */}
          <button
            onClick={handleTest}
            disabled={testing || !token}
            className="px-4 py-2 rounded-xl text-sm font-medium w-full"
            style={{
              background: testing || !token ? 'rgba(122,138,128,0.15)' : 'rgba(0,188,212,0.12)',
              color: testing || !token ? '#64748b' : '#0097a7',
              border: '1px solid ' + (testing || !token ? 'rgba(122,138,128,0.3)' : 'rgba(0,188,212,0.3)'),
              cursor: testing || !token ? 'not-allowed' : 'pointer',
            }}
          >
            {testing ? t('testing') : t('test_connection')}
          </button>
          {testResult && (
            <div
              className="text-sm font-medium px-3 py-2 rounded-lg"
              style={{
                background: testResult.ok ? 'rgba(0,188,212,0.12)' : 'rgba(220,38,38,0.1)',
                color: testResult.ok ? '#0097a7' : '#dc2626',
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
              {t('save_settings')}
            </button>
            {initial && (
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}
              >
                {t('clear_btn')}
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
  const { t, lang } = useLang();
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
        // Excel: generate a proper .xls file (HTML table that Excel opens natively).
        // Persian text is preserved by emitting UTF-8 + BOM and the meta charset.
        const headers = [
          t('show_num'),
          t('name_program'),
          t('category_label'),
          t('studio_size'),
          t('decor_style'),
          t('decor_summary'),
          t('about_program'),
        ];
        const escapeHtml = (s: unknown) => String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const headerRow = `<tr>${headers.map(h => `<th style="background:#00bcd4;color:white;padding:8px;border:1px solid #ccc;text-align:center;font-family:Tahoma;">${escapeHtml(h)}</th>`).join('')}</tr>`;
        const bodyRows = shows.map((s, i) => {
          const cells = [
            i + 1,
            s.name || '',
            (s.category || '').replace(/^\d+\.\s*/, ''),
            s.size || '',
            s.style || '',
            (s.summary || '').substring(0, 200),
            (s.descriptionFa || s.summary || '').substring(0, 500),
          ];
          return `<tr>${cells.map((c, idx) => `<td style="padding:6px 8px;border:1px solid #ddd;font-family:Tahoma;font-size:12px;${idx === 0 ? 'text-align:center;' : 'text-align:right;'}">${escapeHtml(c)}</td>`).join('')}</tr>`;
        }).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('excel_banke_rasane')}</title></head><body><table style="border-collapse:collapse;width:100%;">${headerRow}${bodyRows}</table></body></html>`;
        // Prepend UTF-8 BOM so Excel detects Persian correctly.
        const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `banke-rasane-${Date.now()}.xls`;
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
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,188,212,0.1)' }}>
          <h2 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>
            {format === 'pdf' ? t('pdf_preview_title') : t('excel_preview_title')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ color: '#9CA3AF' }}>{t('program_count_label')}</div>
                <div className="text-2xl font-bold" style={{ color: '#0097a7' }}>{shows.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#9CA3AF' }}>{t('format_label')}</div>
                <div className="text-2xl font-bold" style={{ color: format === 'pdf' ? '#dc2626' : '#0097a7' }}>{format.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#9CA3AF' }}>{t('date')}</div>
                <div className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
              </div>
            </div>
          </div>

          {/* PDF report preview — multi-section professional template */}
          {format === 'pdf' && (
            <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: '2px solid #00bcd4', boxShadow: '0 8px 24px rgba(0, 188, 212, 0.15)' }}>
              {/* Cover preview */}
              <div
                className="p-6 text-center relative overflow-hidden"
                style={{
                  background: 'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(0, 188, 212, 0.35) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 25% 80%, rgba(0, 188, 212, 0.4) 0%, transparent 60%), linear-gradient(160deg, #010a05 0%, #02150c 50%, #010a05 100%)',
                  color: 'white',
                }}
              >
                <div style={{ color: 'rgba(128, 222, 234, 0.6)', fontSize: '11px', letterSpacing: '4px', marginBottom: '12px' }}>{t('banke_rasane_brand')}</div>
                <div style={{ color: '#26c6da', marginBottom: '10px', filter: 'drop-shadow(0 0 16px rgba(0, 188, 212, 0.5))' }}>
                  <svg viewBox="0 0 64 64" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block' }}>
                    <rect x="6" y="14" width="52" height="36" rx="4" />
                    <path d="M6 22h52M14 14v-4M50 14v-4M20 32l10 6-10 6z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black mb-2" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>{t('report_title_full')}</h3>
                <p className="text-xs" style={{ color: 'rgba(128, 222, 234, 0.8)' }}>{t('banke_rasane_archive')}</p>
                <div
                  className="flex justify-center gap-4 mt-4 mx-auto"
                  style={{
                    background: 'rgba(0, 188, 212, 0.1)',
                    border: '1px solid rgba(0, 188, 212, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    maxWidth: '380px',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div>
                    <div className="text-xl font-black" style={{ color: '#26c6da' }}>{shows.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(128, 222, 234, 0.7)' }}>{t('programs_unit')}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(0, 188, 212, 0.3)' }}></div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#26c6da' }}>{new Set(shows.map(s => s.category)).size.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(128, 222, 234, 0.7)' }}>{t('genre_category_unit')}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(0, 188, 212, 0.3)' }}></div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#26c6da' }}>{new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
                    <div className="text-xs" style={{ color: 'rgba(128, 222, 234, 0.7)' }}>{t('date')}</div>
                  </div>
                </div>
              </div>

              {/* Sections list — shows the report structure with descriptions */}
              <div className="p-4" style={{ background: '#f8faf9' }}>
                <div className="text-xs font-bold mb-3" style={{ color: '#0097a7', paddingRight: '8px', borderRight: '3px solid #00bcd4' }}>
                  {t('report_structure')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { n: 1, t: t('section_exec_summary'), icon: '📋', desc: t('section_exec_summary_desc') },
                    { n: 2, t: t('section_methodology'), icon: '🔬', desc: t('section_methodology_desc') },
                    { n: 3, t: t('section_stats_overview'), icon: '📊', desc: t('section_stats_overview_desc') },
                    { n: 4, t: t('section_genre_analysis'), icon: '🏷', desc: t('section_genre_analysis_desc') },
                    { n: 5, t: t('section_decor_analysis'), icon: '🎨', desc: t('section_decor_analysis_desc') },
                    { n: 6, t: t('section_program_list'), icon: '📚', desc: t('section_program_list_desc') },
                    { n: 7, t: t('section_conclusion'), icon: '💡', desc: t('section_conclusion_desc') },
                    { n: 8, t: t('section_appendix'), icon: '📑', desc: t('section_appendix_desc') },
                  ].map(s => (
                    <div
                      key={s.n}
                      className="p-3 rounded-lg flex gap-2.5"
                      style={{ background: '#1E2228', border: '1px solid #e0e8e4' }}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)', color: 'white', boxShadow: '0 2px 6px rgba(0, 188, 212, 0.3)' }}
                      >
                        {s.n.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{s.icon}</span>
                          <span className="text-xs font-bold" style={{ color: '#FFFFFF' }}>{s.t}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF', fontSize: '10.5px' }}>
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample program card preview */}
              <div className="p-4" style={{ background: '#1E2228', borderTop: '1px solid #e0e8e4' }}>
                <div className="text-xs font-bold mb-2" style={{ color: '#0097a7' }}>{t('sample_program_card')}</div>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid #e0e8e4', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="p-2 flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f0f8f4 0%, #e8f4ee 100%)', borderBottom: '1px solid #c8e0d4' }}
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#00bcd4', color: 'white' }}
                    >{lang === 'en' ? '1' : '۱'}</span>
                    <span className="text-xs font-bold flex-1" style={{ color: '#FFFFFF', direction: 'ltr', textAlign: 'right' }}>
                      {shows[0]?.name || t('sample_program')}
                    </span>
                    <span className="text-xs" style={{ color: '#6B7280' }}>{t('identifier_label')} {lang === 'en' ? '1' : '۱'}</span>
                  </div>
                  <div className="p-2 flex gap-2">
                    <div
                      className="w-12 h-9 rounded flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)' }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,188,212,0.08)', color: '#0097a7', fontSize: '9px' }}>
                          {shows[0]?.style || t('modern')}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,188,212,0.08)', color: '#0097a7', fontSize: '9px' }}>
                          {shows[0]?.size || t('medium_std')}
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
                <div className="p-2 text-center text-xs" style={{ background: '#fef9e7', color: '#6B7280' }}>
                  {t('full_report_detailed_first', { n: shows.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR') })}
                </div>
              )}
            </div>
          )}

          {/* Excel preview */}
          {format === 'excel' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              <div className="p-3 text-center" style={{ background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)', color: 'white' }}>
                <div className="text-lg font-bold">{t('excel_banke_rasane')}</div>
                <div className="text-xs opacity-80">{shows.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} {t('programs_unit')}</div>
              </div>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="w-full" style={{ fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f5efe0', zIndex: 1 }}>
                    <tr>
                      <th className="text-right p-2 font-bold" style={{ color: '#9CA3AF' }}>#</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#9CA3AF' }}>{t('name_col')}</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#9CA3AF' }}>{t('category_col')}</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#9CA3AF' }}>{t('decor_style')}</th>
                      <th className="text-right p-2 font-bold" style={{ color: '#9CA3AF' }}>{t('studio_size')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shows.slice(0, 50).map((s, i) => (
                      <tr key={s.num} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td className="p-2" style={{ color: '#6B7280' }}>{(i + 1).toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</td>
                        <td className="p-2 font-medium" style={{ color: '#FFFFFF', direction: 'ltr', textAlign: 'right' }}>{s.name}</td>
                        <td className="p-2" style={{ color: '#9CA3AF' }}>{s.category.replace(/^\d+\.\s*/, '').substring(0, 20)}</td>
                        <td className="p-2" style={{ color: '#9CA3AF' }}>{s.style}</td>
                        <td className="p-2" style={{ color: '#9CA3AF' }}>{s.size}</td>
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
              {downloading ? t('generating') : t('download_file', { format: format.toUpperCase() })}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(122,138,128,0.15)', color: '#9CA3AF', border: '1px solid rgba(122,138,128,0.3)' }}
            >
              {t('cancel')}
            </button>
          </div>
          {format === 'pdf' && (
            <p className="mt-3 text-xs text-center" style={{ color: '#6B7280', lineHeight: 1.7 }}>
              {t('pdf_help_text')}<br />
              {t('print_dialog_help')}
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
  const { t, lang } = useLang();
  const stats = {
    total: talkShows.length,
    uploaded: uploadedShows.length,
    withImage: talkShows.filter(s => s.images && s.images.length > 0).length,
  };

  const reports = [
    { id: 1, title: lang === 'en' ? 'Full report of all programs' : 'گزارش کامل همهٔ برنامه‌ها', type: 'pdf', count: stats.total, date: lang === 'en' ? new Date().toLocaleDateString('en-US') : new Date().toLocaleDateString('fa-IR') },
    { id: 2, title: lang === 'en' ? 'Report of programs uploaded to social media' : 'گزارش برنامه‌های آپلود شده در فضای مجازی', type: 'excel', count: stats.uploaded, date: lang === 'en' ? new Date().toLocaleDateString('en-US') : new Date().toLocaleDateString('fa-IR') },
  ];

  return (
    <>
      <header className="mb-8 animate-view-enter">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('reports')}</h1>
        <p className="text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('banke_rasane_stats_reports')}</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-view-enter">
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#00bcd4' }}>{stats.total.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
          <div className="text-sm text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('total_programs')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#7c3aed' }}>{stats.uploaded.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
          <div className="text-sm text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('uploaded')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#0097a7' }}>{GENRES.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
          <div className="text-sm text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('genre')}</div>
        </div>
        <div className="premium-glass p-5">
          <div className="text-3xl font-black mb-1" style={{ color: '#2563eb' }}>{stats.withImage.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</div>
          <div className="text-sm text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('with_image')}</div>
        </div>
      </div>

      <div className="premium-glass overflow-hidden animate-view-enter">
        <div className="p-5" style={{ borderBottom: '1px solid var(--input-border)' }}>
          <h3 className="font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('available_reports')}</h3>
        </div>
        <table className="w-full">
          <thead className="table-head">
            <tr style={{ background: 'var(--table-head-bg)', borderBottom: '1px solid var(--table-border)' }}>
              <th className="text-right p-4 text-xs font-bold text-fg-muted" style={{ color: 'var(--fg-muted)' }}>#</th>
              <th className="text-right p-4 text-xs font-bold text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('title')}</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('type')}</th>
              <th className="text-right p-4 text-xs font-bold text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('total')}</th>
              <th className="text-right p-4 text-xs font-bold hidden sm:table-cell text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('date')}</th>
              <th className="text-right p-4 text-xs font-bold text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, idx) => (
              <tr
                key={r.id}
                className="table-row"
                style={{ borderBottom: '1px solid var(--table-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--table-row-bg-odd)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="p-4 text-sm text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{(idx + 1).toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</td>
                <td className="p-4 text-sm font-medium text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{r.title}</td>
                <td className="p-4 hidden sm:table-cell">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={r.type === 'pdf'
                      ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                      : { background: 'rgba(0, 188, 212, 0.15)', color: '#0097a7' }
                    }
                  >
                    {r.type === 'pdf' ? t('pdf') : t('excel')}
                  </span>
                </td>
                <td className="p-4 text-sm text-fg-soft" style={{ color: 'var(--fg-soft)' }}>{r.count.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}</td>
                <td className="p-4 text-sm hidden sm:table-cell text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{r.date}</td>
                <td className="p-4">
                  <button
                    className="btn-base text-sm hover:underline"
                    style={{ color: 'var(--accent-text)' }}
                    onClick={() => {
                      let shows: TalkShow[] = [];
                      if (r.id === 1) shows = talkShows;
                      else if (r.id === 2) shows = talkShows.filter(s => uploadedShows.includes(s.num));
                      if (shows.length === 0) { showToast(t('no_programs_for_report')); return; }
                      onExport(shows, r.type === 'pdf' ? 'pdf' : 'excel');
                    }}
                  >
                    {t('download')}
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
  const { t } = useLang();
  const [tab, setTab] = useState<'server' | 'users' | 'password' | 'audit'>('server');

  const tabs = [
    { key: 'server' as const,   label: t('tab_server'),     icon: '🖥' },
    { key: 'users' as const,    label: t('tab_users'),     icon: '👥' },
    { key: 'password' as const, label: t('tab_password'),  icon: '🔑' },
    { key: 'audit' as const,    label: t('tab_audit'),     icon: '📜' },
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
          background: 'linear-gradient(180deg, #f8fbf8 0%, #eef5ef 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(0, 188, 212, 0.25)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(4, 40, 23, 0.98) 0%, rgba(2, 80, 45, 0.96) 100%)',
            borderBottom: '1px solid rgba(0, 188, 212, 0.4)',
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'white' }}>{t('system_settings_title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('close_settings')}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.25)'; e.currentTarget.style.color = '#fca5a5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-2 flex-shrink-0"
          style={{ background: 'rgba(0, 188, 212, 0.05)', borderBottom: '1px solid rgba(0, 188, 212, 0.12)' }}
        >
          {tabs.map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={active ? {
                  background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3), inset 0 1px 0 rgba(0, 188, 212, 0.4)',
                } : {
                  color: '#9CA3AF',
                  border: '1px solid transparent',
                }}
              >
                <span>{tabItem.icon}</span>
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ maxHeight: 'calc(90vh - 130px)' }}>
          {tab === 'server' && <SettingsServerTab showToast={showToast} />}
          {tab === 'users' && <SettingsUsersTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'password' && <SettingsPasswordTab currentUser={currentUser} showToast={showToast} onLogout={onLogout} />}
          {tab === 'audit' && <SettingsAuditTab />}
        </div>
      </div>
    </div>
  );
}

// --- Tab 1: Server URL ---
function SettingsServerTab({ showToast }: { showToast: (msg: string) => void }) {
  const { t } = useLang();
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
        setTestResult({ ok: true, msg: t('connection_ok') });
      } else {
        setTestResult({ ok: false, msg: t('connection_invalid_response', { body: JSON.stringify(data).slice(0, 100) }) });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: t('connection_error', { msg: e?.message || '' }) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setApiBase(url);
    showToast(t('server_url_saved'));
    setTestResult({ ok: true, msg: t('server_url_saved') });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#FFFFFF' }}>{t('api_server_url')}</h3>
        <p className="text-sm mb-3" style={{ color: '#6B7280' }}>
          {t('api_server_desc')} <code dir="ltr" style={{ background: 'rgba(0,188,212,0.1)', padding: '2px 6px', borderRadius: '6px', color: '#0097a7' }}>http://localhost:3002</code>
        </p>
        <input
          type="text"
          dir="ltr"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
          placeholder="http://localhost:3002"
          style={{
            width: '100%',
            background: 'rgba(30, 34, 40, 0.9)',
            border: '1px solid rgba(0, 188, 212, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#FFFFFF',
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
              ? { background: 'rgba(0, 188, 212, 0.12)', color: '#0097a7', border: '1px solid rgba(0, 188, 212, 0.3)' }
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
            background: testing ? 'rgba(122, 138, 128, 0.5)' : 'rgba(0, 188, 212, 0.15)',
            color: testing ? '#64748b' : '#0097a7',
            border: '1px solid rgba(0, 188, 212, 0.3)',
            opacity: testing || !url ? 0.6 : 1,
            cursor: testing || !url ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? t('testing') : t('test_connection')}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1"
          style={{
            background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)',
          }}
        >
          {t('save_address')}
        </button>
      </div>

      <div
        className="p-3 rounded-xl text-xs"
        style={{ background: 'rgba(0, 188, 212, 0.05)', border: '1px solid rgba(0, 188, 212, 0.15)', color: '#9CA3AF', lineHeight: 1.7 }}
      >
        {t('server_help')}
      </div>
    </div>
  );
}

// --- Tab 2: Users management ---
function SettingsUsersTab({ currentUser, showToast }: { currentUser: User; showToast: (msg: string) => void }) {
  const { t, lang } = useLang();
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
      setError(e?.message || t('error_loading_users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      showToast(t('enter_username_password'));
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
      showToast(t('user_created_toast', { name: newUser.username }));
      setNewUser({ username: '', password: '', role: 'viewer', name: '' });
      await load();
    } catch (e: any) {
      showToast(e?.message || t('error_loading_users'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser.id) {
      showToast(t('cannot_delete_self'));
      return;
    }
    if (!confirm(t('delete_user_confirm', { name: u.username }))) return;
    try {
      await api.deleteUser(u.id);
      showToast(t('user_deleted_toast'));
      await load();
    } catch (e: any) {
      showToast(e?.message || t('error_loading_users'));
    }
  };

  const handleChangeRole = async (u: User, newRole: string) => {
    if (newRole === u.role) return;
    if (u.id === currentUser.id) {
      showToast(t('cannot_change_role_self'));
      return;
    }
    try {
      await api.updateUser(u.id, { role: newRole });
      showToast(t('user_role_changed_toast', { name: u.username, role: newRole }));
      await load();
    } catch (e: any) {
      showToast(e?.message || t('error_loading_users'));
    }
  };

  const roleLabel: Record<string, string> = {
    admin: t('role_admin'),
    editor: t('role_editor'),
    viewer: t('role_viewer'),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#FFFFFF' }}>{t('users_management')}</h3>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          {t('users_management_desc')}
        </p>
      </div>

      {/* Add new user form */}
      <div
        className="p-4 rounded-xl"
        style={{ background: 'rgba(0, 188, 212, 0.05)', border: '1px solid rgba(0, 188, 212, 0.15)' }}
      >
        <h4 className="font-bold text-sm mb-3" style={{ color: '#FFFFFF' }}>{t('add_new_user')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            dir="ltr"
            placeholder={t('username_placeholder')}
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{
              background: '#1E2228',
              border: '1px solid rgba(0, 188, 212, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#FFFFFF',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <input
            type="text"
            placeholder={t('display_name_optional')}
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            style={{
              background: '#1E2228',
              border: '1px solid rgba(0, 188, 212, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#FFFFFF',
              outline: 'none',
            }}
          />
          <input
            type="password"
            dir="ltr"
            placeholder={t('password_placeholder_min')}
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            style={{
              background: '#1E2228',
              border: '1px solid rgba(0, 188, 212, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#FFFFFF',
              outline: 'none',
              textAlign: 'left',
              direction: 'ltr',
            }}
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{
              background: '#1E2228',
              border: '1px solid rgba(0, 188, 212, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#FFFFFF',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            <option value="viewer">{t('role_viewer')}</option>
            <option value="editor">{t('role_editor')}</option>
            <option value="admin">{t('role_admin')}</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: creating ? 'rgba(122, 138, 128, 0.5)' : 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)',
            opacity: creating ? 0.6 : 1,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? t('creating') : t('create_user')}
        </button>
      </div>

      {/* Users list */}
      <div>
        <h4 className="font-bold text-sm mb-2" style={{ color: '#FFFFFF' }}>
          {t('current_users')} ({users.length.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')})
        </h4>
        {loading && (
          <div className="p-4 text-center text-sm" style={{ color: '#6B7280' }}>{t('loading_users')}</div>
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
                style={{ background: '#1E2228', border: '1px solid rgba(0, 188, 212, 0.15)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{
                    background: u.role === 'admin' ? 'rgba(220, 38, 38, 0.15)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 188, 212, 0.15)',
                    color: u.role === 'admin' ? '#dc2626' : u.role === 'editor' ? '#d97706' : '#0097a7',
                    border: `1px solid ${u.role === 'admin' ? 'rgba(220, 38, 38, 0.35)' : u.role === 'editor' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(0, 188, 212, 0.35)'}`,
                  }}
                >
                  {(u.name || u.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: '#FFFFFF' }} title={u.username}>
                    {u.name || u.username}{' '}
                    {u.id === currentUser.id && (
                      <span className="text-xs font-normal" style={{ color: '#6B7280' }}>({lang === 'en' ? 'you' : 'شما'})</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: '#6B7280' }} dir="ltr">@{u.username}</div>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => handleChangeRole(u, e.target.value)}
                  disabled={u.id === currentUser.id}
                  style={{
                    background: 'rgba(0, 188, 212, 0.05)',
                    border: '1px solid rgba(0, 188, 212, 0.2)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '13px',
                    color: '#FFFFFF',
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                    opacity: u.id === currentUser.id ? 0.6 : 1,
                  }}
                  title={u.id === currentUser.id ? t('cannot_change_role_self') : t('edit_field')}
                >
                  <option value="viewer">{t('role_viewer')}</option>
                  <option value="editor">{t('role_editor')}</option>
                  <option value="admin">{t('role_admin')}</option>
                </select>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={u.id === currentUser.id}
                  className="p-2 rounded-lg transition-colors flex-shrink-0"
                  style={{
                    color: u.id === currentUser.id ? 'rgba(122, 138, 128, 0.4)' : '#dc2626',
                    background: u.id === currentUser.id ? 'transparent' : 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                    opacity: u.id === currentUser.id ? 0.4 : 1,
                  }}
                  title={u.id === currentUser.id ? t('cannot_delete_self') : `${t('cancel')} ${u.username}`}
                  aria-label={`${t('cancel')} ${u.username}`}
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
  const { t } = useLang();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      showToast(t('fill_three_fields'));
      return;
    }
    if (newPw.length < 4) {
      showToast(t('password_min_length'));
      return;
    }
    if (newPw !== confirmPw) {
      showToast(t('passwords_dont_match'));
      return;
    }
    if (newPw === oldPw) {
      showToast(t('password_must_differ'));
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(oldPw, newPw);
      showToast(t('password_changed_toast'));
      // Force re-login since the API invalidated the session.
      setTimeout(() => { onLogout(); }, 1500);
    } catch (e: any) {
      showToast(e?.message || t('error_changing_password'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(30, 34, 40, 0.9)',
    border: '1px solid rgba(0, 188, 212, 0.25)',
    borderRadius: '12px',
    padding: '12px 48px 12px 16px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'left',
    direction: 'ltr',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: '#FFFFFF' }}>{t('change_password_title')}</h3>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          {t('change_password_desc')}
        </p>
      </div>

      <div
        className="p-3 rounded-xl text-sm flex items-center gap-2"
        style={{ background: 'rgba(0, 188, 212, 0.08)', border: '1px solid rgba(0, 188, 212, 0.2)', color: '#0097a7' }}
      >
        <span>{t('current_account')}</span>
        <strong>{currentUser.name || currentUser.username}</strong>
        <span dir="ltr" style={{ color: '#6B7280' }}>@{currentUser.username}</span>
      </div>

      {[
        { label: t('current_password'), val: oldPw, set: setOldPw },
        { label: t('new_password'), val: newPw, set: setNewPw },
        { label: t('confirm_new_password'), val: confirmPw, set: setConfirmPw },
      ].map((f, i) => (
        <div key={i}>
          <label className="block text-sm font-bold mb-2" style={{ color: '#FFFFFF' }}>{f.label}</label>
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
              style={{ color: '#9CA3AF', background: 'transparent' }}
              aria-label={showPw ? t('hide_password') : t('show_password')}
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
          {t('password_mismatch')}
        </div>
      )}

      <button
        onClick={handleChange}
        disabled={saving}
        className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: saving ? 'rgba(122, 138, 128, 0.5)' : 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)',
          opacity: saving ? 0.6 : 1,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? t('testing') : t('change_password_btn')}
      </button>
    </div>
  );
}

// ============================================
// COMPARE MODAL — side-by-side comparison of two programs with diff highlighting
// ============================================
function CompareModal({ shows, onClose, onClear }: {
  shows: TalkShow[];
  onClose: () => void;
  onClear: () => void;
}) {
  const { t, lang } = useLang();
  if (shows.length !== 2) return null;
  const [a, b] = shows;
  // Compare a single field — returns true if the two values differ.
  const diff = (x: unknown, y: unknown): boolean => {
    if (x == null && y == null) return false;
    if (typeof x === 'string' && typeof y === 'string') return x.trim() !== y.trim();
    return String(x ?? '') !== String(y ?? '');
  };
  const fields: { key: keyof TalkShow; label: string }[] = [
    { key: 'num', label: t('show_num') },
    { key: 'name', label: t('name_program') },
    { key: 'category', label: t('category_label') },
    { key: 'country', label: lang === 'en' ? 'Country' : 'کشور' },
    { key: 'size', label: t('studio_size') },
    { key: 'style', label: t('decor_style') },
    { key: 'viewers', label: t('audience') },
    { key: 'layout', label: t('layout') },
    { key: 'effects', label: t('effects') },
    { key: 'lighting', label: t('lighting') },
    { key: 'elements', label: t('decor_elements') },
    { key: 'materials', label: t('materials') },
    { key: 'colors', label: t('colors') },
    { key: 'summary', label: t('decor_summary') },
    { key: 'descriptionFa', label: t('about_program_fa') },
    { key: 'youtube', label: 'YouTube' },
    { key: 'imdb', label: 'IMDb' },
    { key: 'wikipedia', label: t('wikipedia_page') },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '1100px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--input-border)' }}>
          <h2 className="text-xl font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>⚖ {t('compare_two_programs')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="btn-base px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}
              title={t('clear_compare_list')}
            >
              🗑 {t('clear_list')}
            </button>
            <button onClick={onClose} className="btn-base p-2 rounded-lg text-fg-muted" style={{ color: 'var(--fg-muted)' }} aria-label={t('close')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* Two-column header with each program's name + thumbnail */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[a, b].map((s, idx) => {
              const thumb = getShowThumbnail(s);
              return (
                <div
                  key={s.num}
                  className="rounded-xl overflow-hidden p-3"
                  style={{
                    background: `linear-gradient(135deg, ${thumb.accent}22 0%, ${thumb.accent}08 100%)`,
                    border: `1px solid ${thumb.accent}55`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden relative"
                      style={{ background: thumb.gradient }}
                    >
                      {thumb.image ? (
                        <img src={thumb.image} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white font-black text-lg" style={{ background: thumb.gradient }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-fg-muted" style={{ color: 'var(--fg-muted)' }}>{idx === 0 ? t('program_first') : t('program_second')}</div>
                      <div className="font-bold text-sm truncate text-fg-strong" style={{ color: 'var(--fg-strong)', direction: 'ltr', textAlign: 'right' }}>{s.name}</div>
                      <div className="text-xs text-fg-soft" style={{ color: 'var(--fg-soft)' }}>#{s.num.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')} • {s.style}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--input-border)' }}>
            <table className="w-full" style={{ fontSize: '13px' }}>
              <thead style={{ background: 'var(--table-head-bg)' }}>
                <tr>
                  <th className="text-right p-2.5 font-bold text-fg-muted" style={{ color: 'var(--fg-muted)', width: '20%' }}>{t('field')}</th>
                  <th className="text-right p-2.5 font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('program_first')}</th>
                  <th className="text-right p-2.5 font-bold text-fg-strong" style={{ color: 'var(--fg-strong)' }}>{t('program_second')}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, idx) => {
                  const va = a[f.key];
                  const vb = b[f.key];
                  const isDiff = diff(va, vb);
                  return (
                    <tr
                      key={f.key}
                      className="table-row"
                      style={{
                        background: idx % 2 === 0 ? 'transparent' : 'var(--table-row-bg-odd)',
                        borderBottom: '1px solid var(--table-border)',
                      }}
                    >
                      <td className="p-2.5 font-bold text-fg-muted" style={{ color: 'var(--fg-muted)', fontSize: '11.5px' }}>
                        {f.label}
                        {isDiff && (
                          <span
                            className="mr-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }}
                            title={t('values_differ')}
                          >
                            {t('difference')}
                          </span>
                        )}
                      </td>
                      <td
                        className="p-2.5"
                        style={{
                          color: 'var(--fg-strong)',
                          background: isDiff ? 'rgba(245, 158, 11, 0.07)' : 'transparent',
                          direction: ['name', 'youtube', 'imdb', 'wikipedia'].includes(f.key as string) ? 'ltr' : 'rtl',
                          textAlign: ['name', 'youtube', 'imdb', 'wikipedia'].includes(f.key as string) ? 'left' : 'right',
                          fontSize: '12px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {String(va ?? '—') || '—'}
                      </td>
                      <td
                        className="p-2.5"
                        style={{
                          color: 'var(--fg-strong)',
                          background: isDiff ? 'rgba(245, 158, 11, 0.07)' : 'transparent',
                          direction: ['name', 'youtube', 'imdb', 'wikipedia'].includes(f.key as string) ? 'ltr' : 'rtl',
                          textAlign: ['name', 'youtube', 'imdb', 'wikipedia'].includes(f.key as string) ? 'left' : 'right',
                          fontSize: '12px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {String(vb ?? '—') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Diff summary */}
          <div
            className="mt-4 p-3 rounded-xl text-xs text-fg-soft"
            style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--fg-soft)' }}
          >
            <strong style={{ color: '#b45309' }}>{t('help_label')}</strong> {t('help_diff')}
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="btn-base px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(122,138,128,0.15)', color: 'var(--fg-soft)', border: '1px solid var(--input-border)' }}
            >
              {t('close_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tab 4: Audit log (تاریخچه تغییرات) ---
function SettingsAuditTab() {
  const { t, lang } = useLang();
  const [changes, setChanges] = useState<Array<{
    id: number;
    show_num: number | null;
    user_id: number | null;
    username: string;
    action: 'create' | 'update' | 'delete';
    field: string;
    old_value: string;
    new_value: string;
    created_at: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getChanges(200);
      setChanges(list);
    } catch (e: any) {
      setError(e?.message || t('error_loading_history'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const actionLabel: Record<string, string> = {
    create: t('action_create'),
    update: t('action_update'),
    delete: t('action_delete'),
  };

  const actionColor: Record<string, string> = {
    create: '#0097a7',
    update: '#b45309',
    delete: '#dc2626',
  };

  const filtered = filter === 'all' ? changes : changes.filter(c => c.action === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-base font-bold mb-1" style={{ color: '#FFFFFF' }}>{t('audit_log_title')}</h3>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            {t('audit_log_desc')}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{
            background: 'rgba(0, 188, 212, 0.12)',
            color: '#0097a7',
            border: '1px solid rgba(0, 188, 212, 0.3)',
            cursor: 'pointer',
          }}
        >
          {t('refresh')}
        </button>
      </div>

      {/* Action filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'create', 'update', 'delete'] as const).map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={filter === k ? {
              background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)',
              color: 'white',
              border: '1px solid #00bcd4',
            } : {
              background: '#1E2228',
              color: '#9CA3AF',
              border: '1px solid rgba(0, 188, 212, 0.15)',
            }}
          >
            {k === 'all' ? t('all') : actionLabel[k]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="p-4 text-center text-sm" style={{ color: '#6B7280' }}>{t('loading_history')}</div>
      )}
      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
          ⚠ {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="p-6 text-center text-sm" style={{ color: '#6B7280' }}>
          {t('no_changes_recorded')}
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {filtered.map(c => {
            const date = new Date(c.created_at * 1000);
            return (
              <div
                key={c.id}
                className="p-3 rounded-xl flex items-start gap-3"
                style={{ background: '#1E2228', border: '1px solid rgba(0, 188, 212, 0.15)' }}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-bold flex-shrink-0"
                  style={{
                    background: `${actionColor[c.action]}20`,
                    color: actionColor[c.action],
                    border: `1px solid ${actionColor[c.action]}40`,
                  }}
                >
                  {actionLabel[c.action]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                    {c.username ? `@${c.username}` : '—'}
                    {c.show_num != null && (
                      <span className="text-xs font-normal mr-2" style={{ color: '#6B7280' }}>
                        {t('program_hash')}{c.show_num.toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR')}
                      </span>
                    )}
                  </div>
                  {c.action === 'update' && c.field && (
                    <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                      {t('field_log')} <strong>{c.field}</strong>:
                      {c.old_value && (
                        <span style={{ color: '#dc2626', textDecoration: 'line-through', marginRight: '6px' }}>
                          «{c.old_value.length > 60 ? c.old_value.substring(0, 60) + '…' : c.old_value}»
                        </span>
                      )}
                      <span style={{ color: '#0097a7', marginRight: '6px' }}>
                        ← «{c.new_value.length > 60 ? c.new_value.substring(0, 60) + '…' : c.new_value}»
                      </span>
                    </div>
                  )}
                  {c.action === 'create' && (
                    <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                      {t('program_created_log', { name: c.new_value || '—' })}
                    </div>
                  )}
                  {c.action === 'delete' && (
                    <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                      {t('program_deleted_log', { name: c.old_value || '—' })}
                    </div>
                  )}
                  <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                    {date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fa-IR')} {date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fa-IR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
