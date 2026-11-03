// Download images for ALL shows from OMDb/Wikipedia and store in DB.
// Run inside the api-service directory:  bun run download-images.js
//
// This is a bulk downloader — processes all shows without images.

import { Database } from 'bun:sqlite';
import sharp from 'sharp';
import { resolve } from 'node:path';

const DB_PATH = resolve(import.meta.dir, 'bankresaneh.sqlite');
const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

// Ensure columns exist
try { db.exec('ALTER TABLE shows ADD COLUMN image_data BLOB'); } catch (e) {}
try { db.exec("ALTER TABLE shows ADD COLUMN image_mime TEXT NOT NULL DEFAULT 'image/jpeg'"); } catch (e) {}
try { db.exec("ALTER TABLE shows ADD COLUMN image_source TEXT NOT NULL DEFAULT ''"); } catch (e) {}

const OMDB_API_KEY = 'thewdb';
const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const updateStmt = db.prepare('UPDATE shows SET image_data = ?, image_mime = ?, image_source = ? WHERE num = ?');
const skipStmt = db.prepare('SELECT num FROM shows WHERE image_data IS NOT NULL AND length(image_data) > 0');

// Load shows without images
const allShows = db.prepare('SELECT num, name, imdb, wikipedia FROM shows ORDER BY num').all();
const skipped = skipStmt.all().map(r => r.num);
const skippedSet = new Set(skipped);
const toDownload = allShows.filter(s => !skippedSet.has(s.num));

console.log(`[download] total shows: ${allShows.length}`);
console.log(`[download] already have images: ${skipped.length}`);
console.log(`[download] to download: ${toDownload.length}`);

let success = 0, failed = 0, noLinks = 0;
const startTime = Date.now();

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 404) return res;
      if (res.status === 429) { await new Promise(r => setTimeout(r, 3000 * Math.pow(2, i))); continue; }
      if (i < retries) await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

function cleanQuery(s) {
  return (s || '').replace(/[?!]+$/, '').replace(/\(.*?\)/g, ' ').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function tryOmdb(imdbUrl, name) {
  const direct = imdbUrl?.match(/tt(\d+)/);
  if (direct) {
    const r = await fetchWithRetry(`https://www.omdbapi.com/?i=tt${direct[1]}&apikey=${OMDB_API_KEY}`, {}, 1);
    if (r && r.ok) { const d = await r.json(); if (d.Response==='True' && d.Poster && d.Poster!=='N/A') return { imageUrl: d.Poster, source: 'omdb' }; }
  }
  const search = imdbUrl?.match(/[?&]q=([^&]+)/);
  if (search) {
    const query = cleanQuery(decodeURIComponent(search[1].replace(/\+/g, ' ')));
    if (query) {
      for (const type of ['series', 'movie', '']) {
        const r = await fetchWithRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}&apikey=${OMDB_API_KEY}`, {}, 1);
        if (r && r.ok) { const d = await r.json(); if (d.Search) for (const item of d.Search) if (item.Poster && item.Poster!=='N/A') return { imageUrl: item.Poster, source: 'omdb' }; }
      }
    }
  }
  // Search by name
  if (name) {
    const q = cleanQuery(name);
    if (q && q.length >= 3) {
      for (const type of ['series', 'movie', '']) {
        const r = await fetchWithRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}&apikey=${OMDB_API_KEY}`, {}, 1);
        if (r && r.ok) { const d = await r.json(); if (d.Search) for (const item of d.Search) if (item.Poster && item.Poster!=='N/A') return { imageUrl: item.Poster, source: 'omdb' }; }
      }
    }
  }
  return null;
}

async function tryWikipedia(wikiUrl, name) {
  const direct = wikiUrl?.match(/\/wiki\/(.+?)(?:\?|#|$)/);
  let pageTitle = null, lang = 'en';
  if (direct) {
    pageTitle = decodeURIComponent(direct[1].replace(/_/g, ' '));
    lang = wikiUrl.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'en';
  } else {
    const search = wikiUrl?.match(/[?&]search=([^&]+)/);
    if (search) {
      pageTitle = cleanQuery(decodeURIComponent(search[1].replace(/\+/g, ' ')));
      lang = wikiUrl.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'fa';
    }
  }
  if (!pageTitle && name) { pageTitle = cleanQuery(name); lang = 'en'; }
  if (!pageTitle) return null;

  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const r = await fetchWithRetry(summaryUrl, { headers: { 'User-Agent': UA } }, 1);
  if (r && r.ok) { const d = await r.json(); const img = d.originalimage?.source || d.thumbnail?.source; if (img) return { imageUrl: img, source: 'wikipedia' }; }

  const searchApi = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(pageTitle)}&format=json&origin=*&srlimit=3`;
  const sres = await fetchWithRetry(searchApi, { headers: { 'User-Agent': UA } }, 1);
  if (sres && sres.ok) {
    const sdata = await sres.json();
    if (sdata.query?.search) {
      for (const hit of sdata.query.search) {
        const sUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const ssres = await fetchWithRetry(sUrl, { headers: { 'User-Agent': UA } }, 1);
        if (ssres && ssres.ok) { const ssdata = await ssres.json(); const img = ssdata.originalimage?.source || ssdata.thumbnail?.source; if (img) return { imageUrl: img, source: 'wikipedia-search' }; }
      }
    }
  }
  return null;
}

async function downloadImage(imageUrl) {
  const isWiki = imageUrl.includes('wikimedia.org') || imageUrl.includes('wikipedia.org');
  const res = await fetchWithRetry(imageUrl, {
    headers: isWiki ? { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' } : { 'User-Agent': BROWSER_UA, 'Accept': 'image/*,*/*;q=0.8', 'Referer': imageUrl.includes('media-amazon') ? 'https://www.imdb.com/' : '' },
  }, 3);
  if (!res || !res.ok) return null;
  const buf = await res.arrayBuffer();
  const rawBytes = new Uint8Array(buf);
  if (rawBytes.length < 200) return null;
  try {
    const processed = await sharp(Buffer.from(rawBytes)).resize(400, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(processed), mime: 'image/jpeg' };
  } catch (e) {
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return { bytes: rawBytes, mime: mime.split(';')[0] };
  }
}

async function processShow(show) {
  const { num, name, imdb, wikipedia } = show;
  try {
    if (wikipedia) {
      const r = await tryWikipedia(wikipedia, name);
      if (r) { const img = await downloadImage(r.imageUrl); if (img) { updateStmt.run(img.bytes, img.mime, r.source, num); return r.source; } }
    }
    if (imdb || name) {
      const r = await tryOmdb(imdb, name);
      if (r) { const img = await downloadImage(r.imageUrl); if (img) { updateStmt.run(img.bytes, img.mime, r.source, num); return r.source; } }
    }
  } catch (e) {}
  return null;
}

// Process sequentially
let processed = 0;
for (const show of toDownload) {
  const result = await processShow(show);
  if (result) { success++; }
  else { failed++; }

  processed++;
  if (processed % 10 === 0) {
    const pct = Math.round((processed / toDownload.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[download] ${processed}/${toDownload.length} (${pct}%) — ok=${success} fail=${failed} — ${elapsed}s`);
  }
}

console.log('---');
console.log(`[download] DONE`);
console.log(`  Total: ${toDownload.length}`);
console.log(`  Success: ${success}`);
console.log(`  Failed: ${failed}`);
console.log(`  Time: ${Math.round((Date.now() - startTime) / 1000)}s`);

db.exec('VACUUM;');
console.log('[download] done.');
