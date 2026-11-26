#!/usr/bin/env node
/**
 * Audits every seeded program image and separately reports decor coverage.
 * It verifies live image delivery, Commons file/license metadata, and exact
 * attribution-manifest coverage. Semantic program/set matching remains a
 * human visual-review requirement and is never inferred from HTTP success.
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
const timeout = 15000;

function commonsFileName(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(host)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let name = host === 'thumb.wikimedia.org' ? parts.at(-2) : parts.at(-1);
    if (host === 'upload.wikimedia.org' && parts.includes('thumb')) name = parts.at(-1);
    name = decodeURIComponent(name || '').replace(/^\d+px-/, '');
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
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'BankResaneh-Image-Audit/1.1 (repository quality check)', ...(init.headers || {}) } });
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
      const licenseUrl = metadataValue(ext.LicenseUrl);
      const creator = metadataValue(ext.Artist || ext.Credit);
      if (!short || !isReusableLicense(short)) {
        failures.push({ url: raw, error: 'Commons reuse license is missing or not clearly reusable: ' + (short || 'unknown') });
      } else if (!credits.includes(raw) || !creator) {
        failures.push({ url: raw, error: 'Commons attribution manifest is incomplete (URL/creator missing)' });
      } else {
        license = short + (licenseUrl ? ' — ' + licenseUrl : '');
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
