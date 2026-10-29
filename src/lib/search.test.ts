import { describe, expect, test } from 'bun:test';
import { normalizePersianSearch, rankSearchShows } from './search';

const shows = [
  { num: 1, name: 'گفتگوی ویژه خبری', category: 'سیاسی', summary: 'تحلیل اخبار روز' },
  { num: 2, name: 'گفت‌وگوی ویژه', category: 'مصاحبه', summary: 'بررسی موضوعات' },
  { num: 3, name: 'مسابقه بزرگ', category: 'سرگرمی', summary: 'برنامه رقابتی' },
];

describe('Persian search normalization', () => {
  test('normalizes Arabic yeh/kaf, half spaces, diacritics and Persian digits', () => {
    expect(normalizePersianSearch('كِتاب‌خانه ۱۲۳')).toBe('کتاب خانه 123');
    expect(normalizePersianSearch('ي')).toBe('ی');
  });
});

describe('ranked show search', () => {
  test('finds normalized phrase matches and ranks the title match first', () => {
    const result = rankSearchShows(shows, 'گفت و گوی ویژه');
    expect(result.map(show => show.num)).toEqual([2, 1]);
  });

  test('matches all query tokens even when the order differs', () => {
    const result = rankSearchShows(shows, 'اخبار تحلیل');
    expect(result.map(show => show.num)).toContain(1);
  });

  test('supports a small typo in longer tokens', () => {
    const result = rankSearchShows(shows, 'مسابقه بزرک');
    expect(result.map(show => show.num)).toContain(3);
  });

  test('returns the original array when the query is blank', () => {
    expect(rankSearchShows(shows, '   ')).toBe(shows);
  });
});
