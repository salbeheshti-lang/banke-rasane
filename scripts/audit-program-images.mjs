#!/usr/bin/env node
/**
 * Audits every seeded program image and separately reports decor coverage.
 * Wikimedia files are checked in a single batched Commons API request to avoid
 * CDN rate limits. The check verifies file existence, MIME/source URLs,
 * reuse-license metadata, and exact attribution coverage. Semantic program/set
 * matching remains a human visual-review requirement.
 */
import { readFileSync, appendFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('../public/talk-shows-data.json', import.meta.url), 'utf8'));
const credits = readFileSync(new URL('../public/IMAGE-CREDITS.md', import.meta.url), 'utf8');
if (!Array.isArray(seed)) throw new Error('talk-shows-data.json must contain an array.');

const NO_DECOR_CATEGORIES = new Set([
  'آگهی‌های تبلیغاتی', 'مدرسه', 'پخش زنده', 'سفرنامه و ماجراجویی', 'سفر جاده‌ای',
]);
const NO_DECOR_PREFIXES = ['خارج از ژانر تاک‌شو:'];
function hasDecor(show) {
  if (show.isFilm) return false;
  const categories = String(show.category || '').split('|').map(value => value.trim()).filter(Boolean);
  if (categories.some(category => NO_DECOR_CATEGORIES.has(category) || NO_DECOR_PREFIXES.some(prefix => category.startsWith(prefix)))) return false;
  if (typeof show.decorIncluded === 'boolean') return show.decorIncluded;
  return true;
}
const decorShows = seed.filter(hasDecor);
const candidates = [];
const legacyLocalPaths = [];
const invalidReferences = [];
for (const show of seed) {
  for (const raw of Array.isArray(show.images) ? show.images : []) {
    if (typeof raw !== 'string') {
      invalidReferences.push({ num: show.num, error: 'image reference is not a string' });
      continue;
    }
    if (raw.startsWith('/program-images/')) {
      legacyLocalPaths.push({ num: show.num, name: show.name, path: raw });
      continue;
    }
    if (/^https:\/\//i.test(raw)) {
      candidates.push({ num: Number(show.num), name: String(show.name || ''), decor: hasDecor(show), url: raw });
      continue;
    }
    invalidReferences.push({ num: show.num, name: show.name, reference: raw });
  }
}
const uniqueUrls = [...new Set(candidates.map(item => item.url))];
const failures = [];
const warnings = [];
const checked = [];
const timeout = 20000;

function commonsFileName(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(host)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let name = host === 'thumb.wikimedia.org' ? parts.at(-2) : parts.at(-1);
    if (host === 'upload.wikimedia.org' && parts.includes('thumb')) name = parts.at(-1);
    return decodeURIComponent(name || '').replace(/^\d+px-/, '') || null;
  } catch { return null; }
}
function metadataValue(value) {
  if (!value) return '';
  return String(value.value || value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').trim();
}
function isReusableLicense(value) {
  return /CC0|Creative Commons|CC BY(?:-SA)?|Public domain|PD-/i.test(value) &&
    !/All rights reserved|non.?free|fair use/i.test(value);
}
async function fetchWithRetry(url, init = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'BankResaneh-Image-Audit/1.2 (repository quality check)', ...(init.headers || {}) },
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await response.body?.cancel();
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 1500 * (attempt + 1))));
          continue;
        }
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError || new Error('request failed after retries');
}

const commonsByName = new Map();
for (const url of uniqueUrls) {
  const fileName = commonsFileName(url);
  if (fileName) {
    const key = fileName.toLocaleLowerCase();
    if (!commonsByName.has(key)) commonsByName.set(key, { fileName, urls: [] });
    commonsByName.get(key).urls.push(url);
  }
}
const nonCommonsUrls = uniqueUrls.filter(url => !commonsFileName(url));

if (commonsByName.size) {
  try {
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.search = new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '1280',
      titles: [...commonsByName.values()].map(item => 'File:' + item.fileName).join('|'),
    }).toString();
    const response = await fetchWithRetry(api.href);
    if (!response.ok) throw new Error('Commons API HTTP ' + response.status);
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    const byTitle = new Map(pages.map(page => [String(page.title || '').replace(/^File:/i, '').toLocaleLowerCase(), page]));
    for (const item of commonsByName.values()) {
      const page = byTitle.get(item.fileName.toLocaleLowerCase());
      const info = page?.imageinfo?.[0];
      if (!info) {
        for (const url of item.urls) failures.push({ url, error: 'Wikimedia Commons file metadata not found' });
        continue;
      }
      const ext = info.extmetadata || {};
      const short = metadataValue(ext.LicenseShortName);
      const licenseUrl = metadataValue(ext.LicenseUrl);
      const creator = metadataValue(ext.Artist || ext.Credit);
      const mediaUrl = info.thumburl || info.url;
      if (!mediaUrl || !/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//i.test(mediaUrl)) {
        for (const url of item.urls) failures.push({ url, error: 'Commons API did not return a valid image media URL' });
      } else if (!short || !isReusableLicense(short)) {
        for (const url of item.urls) failures.push({ url, error: 'Commons reuse license is missing or not clearly reusable: ' + (short || 'unknown') });
      } else if (!creator || item.urls.some(url => !credits.includes(url))) {
        for (const url of item.urls) failures.push({ url, error: 'Commons attribution manifest is incomplete (exact URL/creator missing)' });
      } else {
        for (const url of item.urls) checked.push({ url, mediaUrl, license: short + (licenseUrl ? ' — ' + licenseUrl : '') });
      }
    }
  } catch (error) {
    for (const item of commonsByName.values()) for (const url of item.urls) {
      failures.push({ url, error: 'Commons metadata audit failed: ' + (error?.message || String(error)) });
    }
  }
}
for (const raw of nonCommonsUrls) {
  try {
    const response = await fetchWithRetry(raw, { method: 'HEAD', redirect: 'follow' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) throw new Error('not an image MIME (' + (mime || 'missing') + ')');
    if (!credits.includes(raw)) failures.push({ url: raw, error: 'External image URL has no exact entry in public/IMAGE-CREDITS.md' });
    else {
      checked.push({ url: raw, mediaUrl: raw, license: 'external license requires manual source verification' });
      warnings.push({ url: raw, warning: 'Attribution entry exists; license requires manual source verification' });
    }
    await response.body?.cancel();
  } catch (error) {
    failures.push({ url: raw, error: 'image URL unavailable: ' + (error?.message || String(error)) });
  }
}

const decorImageRefs = candidates.filter(item => item.decor);
const report = {
  seedRecords: seed.length,
  decorRecords: decorShows.length,
  recordsWithExternalImages: new Set(candidates.map(item => item.num)).size,
  decorRecordsWithExternalImages: new Set(decorImageRefs.map(item => item.num)).size,
  imageReferences: candidates.length,
  decorImageReferences: decorImageRefs.length,
  uniqueImageUrls: uniqueUrls.length,
  checkedImageUrls: checked.length,
  legacyLocalImageReferences: legacyLocalPaths.length,
  invalidImageReferences: invalidReferences.length,
  failures,
  warnings,
  semanticReviewRequired: true,
};
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\n## Program image audit\n' +
    '- Seed records: ' + report.seedRecords + '\n' +
    '- Decor records: ' + report.decorRecords + '\n' +
    '- Records with external images: ' + report.recordsWithExternalImages + '\n' +
    '- Decor records with external images: ' + report.decorRecordsWithExternalImages + '\n' +
    '- Unique image URLs checked: ' + report.checkedImageUrls + '/' + report.uniqueImageUrls + '\n' +
    '- Legacy local image references: ' + report.legacyLocalImageReferences + '\n' +
    '- Invalid image references: ' + report.invalidImageReferences + '\n' +
    '- Audit failures: ' + failures.length + '\n' +
    '- Human visual/semantic review still required: **yes**\n');
}
if (!uniqueUrls.length) failures.push({ error: 'No external image URLs were audited; refusing a vacuous success.' });
if (legacyLocalPaths.length || invalidReferences.length || failures.length) process.exitCode = 1;
