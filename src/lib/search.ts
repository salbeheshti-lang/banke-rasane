/**
 * Persian-aware search utilities for Banke Rasane.
 *
 * The archive is small enough (a few thousand records) for a deterministic
 * in-memory ranked search. Normalization handles Persian/Arabic variants,
 * diacritics, half-spaces, punctuation and Persian/Arabic digits.
 */

const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const FIELD_WEIGHTS: Record<string, number> = {
  name: 12,
  category: 8,
  tags: 7,
  summary: 6,
  descriptionFa: 5,
  country: 4,
  source: 3,
  style: 3,
  effects: 3,
  layout: 3,
  elements: 3,
  materials: 3,
  colors: 2,
  lighting: 2,
  size: 2,
  viewers: 2,
  num: 1,
};

export function normalizePersianSearch(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[إأٱ]/g, 'ا')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u200c\u200d\uFEFF]/g, ' ')
    .replace(/[۰-۹٠-٩]/g, digit => DIGIT_MAP[digit] || digit)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

type SearchRecord = Record<string, unknown>;

function valuesForField(record: SearchRecord, field: string): string[] {
  const value = record[field];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' || typeof item === 'number').map(String);
  return [];
}

/**
 * Returns records in relevance order. Genre-specific fields influence ranking,
 * but common descriptive fields remain searchable so users don't miss records.
 */
export function rankSearchShows<T extends object>(
  records: T[],
  query: string,
  preferredFields: string[] = [],
): T[] {
  const normalizedQuery = normalizePersianSearch(query);
  if (!normalizedQuery) return records;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (!queryTokens.length) return records;

  const preferred = new Set(preferredFields);
  const searchableFields = Array.from(new Set([
    'name', 'category', 'summary', 'descriptionFa', 'tags', 'country',
    'source', 'style', 'effects', 'layout', 'elements', 'materials',
    'colors', 'lighting', 'size', 'viewers', 'num',
    ...preferredFields,
  ]));

  const ranked: Array<{ record: T; score: number; order: number }> = [];

  records.forEach((record, order) => {
    const searchableRecord = record as SearchRecord;
    let score = 0;
    let matchedTokens = 0;
    let exactPhraseMatch = false;

    for (const field of searchableFields) {
      const weight = (FIELD_WEIGHTS[field] || 2) * (preferred.has(field) ? 1.25 : 1);
      const values = valuesForField(searchableRecord, field);
      for (const rawValue of values) {
        const value = normalizePersianSearch(rawValue);
        if (!value) continue;

        if (value === normalizedQuery) {
          score += weight * 10;
          exactPhraseMatch = true;
        } else if (value.startsWith(normalizedQuery)) {
          score += weight * 6;
          exactPhraseMatch = true;
        } else if (value.includes(normalizedQuery)) {
          score += weight * 4;
          exactPhraseMatch = true;
        }

        const valueTokens = value.split(' ');
        for (const token of queryTokens) {
          if (valueTokens.some(valueToken => valueToken === token)) {
            score += weight * 2;
          } else if (valueTokens.some(valueToken => valueToken.startsWith(token))) {
            score += weight * 1.25;
          } else if (valueTokens.some(valueToken => levenshteinAtMostOne(valueToken, token))) {
            score += weight * 0.5;
          }
        }
      }
    }

    for (const token of queryTokens) {
      const found = searchableFields.some(field =>
        valuesForField(searchableRecord, field).some(raw => {
          const normalized = normalizePersianSearch(raw);
          return normalized.split(' ').some(valueToken =>
            valueToken === token || valueToken.startsWith(token) || levenshteinAtMostOne(valueToken, token),
          );
        }),
      );
      if (found) matchedTokens++;
    }

    // Reward results that cover the whole query; suppress partial-token noise.
    if (matchedTokens === queryTokens.length) score += 18 * matchedTokens;
    else if (matchedTokens > 0) score *= matchedTokens / queryTokens.length;
    if (exactPhraseMatch) score += 8;

    if (score > 0) ranked.push({ record, score, order });
  });

  return ranked
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(item => item.record);
}
