#!/usr/bin/env node
/**
 * Audits the current seed's decor-program images.
 *
 * Checks exact record membership, HTTPS image reachability, image MIME,
 * Commons file metadata/license, and attribution-manifest coverage.
 * It deliberately does NOT claim that an image depicts the correct studio:
 * semantic matching remains a documented human visual-review requirement.
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
for (const show of decorShows) {
  for (const raw of Array.isArray(show.images) ? show.images : []) {
    if (typeof raw !== 'string' || !/^https:\/\//i.test(raw)) continue;
    candidates.push({ num: Number(show.num), name: String(show.name || ''), url: raw });
  }
}
const uniqueUrls = [...new Set(candidates.map(item => item.url))];
const failures = [];
const warnings = [];
const checked = [];
const timeout = 15000;

function commonsFileName(raw) {
  try {
    const url = new URL(raw);
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname.toLowerCase())) return null;
    let name = decodeURIComponent(url.pathname.split('/').pop() || '');
    name = name.replace(/^\d+px-/, '');
    return name || null;
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
async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'BankResaneh-Image-Audit/1.0 (repository quality check)', ...(init.headers || {}) } });
}
async function checkUrl(raw) {
  let response;
  try {
    response = await fetchWithTimeout(raw, { method: 'HEAD', redirect: 'follow' });
    if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '')) {
      response = await fetchWithTimeout(raw, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    }
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) throw new Error('not an image MIME (' + (mime || 'missing') + ')');
    await response.body?.cancel();
  } catch (error) {
    failures.push({ url: raw, error: 'image URL unavailable: ' + (error?.message || String(error)) });
    return;
  }

  const fileName = commonsFileName(raw);
  let license = 'external license not machine-verifiable';
  if (fileName) {
    try {
      const api = new URL('https://commons.wikimedia.org/w/api.php');
      api.search = new URLSearchParams({
        action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata',
        titles: 'File:' + fileName,
      }).toString();
      const metaResponse = await fetchWithTimeout(api.href);
      if (!metaResponse.ok) throw new Error('Commons API HTTP ' + metaResponse.status);
      const payload = await metaResponse.json();
      const page = Object.values(payload?.query?.pages || {})[0];
      const info = page?.imageinfo?.[0];
      if (!info) throw new Error('Commons file metadata not found');
      const ext = info.extmetadata || {};
      const short = metadataValue(ext.LicenseShortName);
      const url = metadataValue(ext.LicenseUrl);
      const creator = metadataValue(ext.Artist || ext.Credit);
      if (!short || !isReusableLicense(short)) {
        failures.push({ url: raw, error: 'Commons reuse license is missing or not clearly reusable: ' + (short || 'unknown') });
      } else if (!credits.includes(raw) || !creator) {
        failures.push({ url: raw, error: 'Commons attribution manifest is incomplete (URL/creator missing)' });
      } else {
        license = short + (url ? ' — ' + url : '');
      }
    } catch (error) {
      failures.push({ url: raw, error: 'Commons metadata audit failed: ' + (error?.message || String(error)) });
    }
  } else if (!credits.includes(raw)) {
    failures.push({ url: raw, error: 'External image URL has no exact entry in public/IMAGE-CREDITS.md' });
  } else {
    warnings.push({ url: raw, warning: 'Attribution entry exists; license requires manual source verification' });
  }
  checked.push({ url: raw, mime: response.headers.get('content-type') || '', license });
}

let cursor = 0;
const concurrency = 5;
await Promise.all(Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, async () => {
  while (cursor < uniqueUrls.length) {
    const url = uniqueUrls[cursor++];
    await checkUrl(url);
  }
}));

const report = {
  seedRecords: seed.length,
  decorRecords: decorShows.length,
  decorRecordsWithExternalImages: new Set(candidates.map(item => item.num)).size,
  externalImageReferences: candidates.length,
  uniqueExternalImageUrls: uniqueUrls.length,
  checkedImageUrls: checked.length,
  failures,
  warnings,
  semanticReviewRequired: true,
};
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\n## Decor image audit\n' +
    '- Seed records: ' + report.seedRecords + '\n' +
    '- Decor records: ' + report.decorRecords + '\n' +
    '- Decor records with external images: ' + report.decorRecordsWithExternalImages + '\n' +
    '- Unique external image URLs checked: ' + report.checkedImageUrls + '/' + report.uniqueExternalImageUrls + '\n' +
    '- Audit failures: ' + failures.length + '\n' +
    '- Manual visual/license review remains required: **yes**\n');
}
if (failures.length) process.exitCode = 1;
