// ============================================================================
//  BankResaneh local API service — Bun + bun:sqlite
//  Port: 3002
//
//  Tables: users, sessions, shows
//  Default admin: admin / admin (SHA-256 hashed)
//  Seeds 560 shows from ../public/talk-shows-data.json on first run
//  Session tokens: random hex, 7-day TTL
//  All endpoints under /api/*
// ============================================================================
import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PORT = 3002;

// ---------------------------------------------------------------------------
// DB setup
//   - In dev: writes to ./bankresaneh.sqlite next to index.js
//   - In Electron (bundled): writes to DB_PATH env (user data dir)
//     so user-added shows/edits persist across reinstalls.
// ---------------------------------------------------------------------------
const DB_PATH = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(import.meta.dir, 'bankresaneh.sqlite');

// Ensure parent dir exists (Electron userData/db)
try {
  const dir = resolve(DB_PATH, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
} catch (e) { /* ignore */ }

// On first run inside Electron, copy the bundled seed DB so the app starts
// with the 2088 shows + admin/admin user already populated.
if (process.env.DB_PATH && !existsSync(DB_PATH)) {
  const candidates = [
    resolve(import.meta.dir, 'bankresaneh.sqlite'),
    resolve(process.resourcesPath || '', 'api-service', 'bankresaneh.sqlite'),
  ];
  for (const src of candidates) {
    if (existsSync(src)) {
      try { copyFileSync(src, DB_PATH); console.log('[seed] copied bundled DB'); break; } catch (e) {}
    }
  }
}

const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer', -- admin | editor | viewer
    name          TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    last_seen     INTEGER NOT NULL DEFAULT 0,      -- unix seconds; updated on each authed request
    job_title     TEXT NOT NULL DEFAULT '',
    department    TEXT NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    avatar        TEXT NOT NULL DEFAULT ''          -- data-URL or URL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    expires_at  INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shows (
    num          INTEGER PRIMARY KEY,
    name         TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT '',
    source       TEXT NOT NULL DEFAULT '',
    size         TEXT NOT NULL DEFAULT '',
    viewers      TEXT NOT NULL DEFAULT '',
    style        TEXT NOT NULL DEFAULT '',
    effects      TEXT NOT NULL DEFAULT '',
    layout       TEXT NOT NULL DEFAULT '',
    elements     TEXT NOT NULL DEFAULT '',
    materials    TEXT NOT NULL DEFAULT '',
    colors       TEXT NOT NULL DEFAULT '',
    lighting     TEXT NOT NULL DEFAULT '',
    summary      TEXT NOT NULL DEFAULT '',
    descriptionFa TEXT NOT NULL DEFAULT '',
    youtube      TEXT NOT NULL DEFAULT '',
    imdb         TEXT NOT NULL DEFAULT '',
    wikipedia    TEXT NOT NULL DEFAULT '',
    socialPost   TEXT NOT NULL DEFAULT '',
    images       TEXT NOT NULL DEFAULT '[]',  -- JSON array of URLs
    videos       TEXT NOT NULL DEFAULT '[]'   -- JSON array of URLs
  );
`);

// ---------------------------------------------------------------------------
// Migrations — add new columns to existing databases (idempotent)
// ---------------------------------------------------------------------------
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      console.log(`[migration] added column ${table}.${column}`);
    } catch (e) {
      console.warn(`[migration] failed to add ${table}.${column}:`, e.message);
    }
  }
}
addColumnIfMissing('users', 'last_seen',  'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'job_title',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'department', "TEXT NOT NULL DEFAULT ''");  // legacy, kept for compat
addColumnIfMissing('users', 'bio',        "TEXT NOT NULL DEFAULT ''");      // legacy, kept for compat
addColumnIfMissing('users', 'avatar',     "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'deputy',     "TEXT NOT NULL DEFAULT ''");     // معاونت و سمت
addColumnIfMissing('users', 'phone',      "TEXT NOT NULL DEFAULT ''");     // شماره تماس (فقط admin می‌بیند)

// Image column — BLOB holding the actual JPEG bytes for each show's poster.
// Stored inside the DB so the .exe/.apk/web bundle is self-contained: no
// separate program-images/ folder needed.
addColumnIfMissing('shows', 'image_data',  'BLOB');              // raw JPEG bytes
addColumnIfMissing('shows', 'image_mime',  "TEXT NOT NULL DEFAULT 'image/jpeg'");
addColumnIfMissing('shows', 'image_source', "TEXT NOT NULL DEFAULT ''");    // omdb | wikipedia | none

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Password hashing: salted SHA-256 (better than plain SHA-256).
// Format: "salt$hash" where salt is 16 random hex chars.
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password, 'utf8').digest('hex');
  return salt + '$' + hash;
}

function verifyPassword(password, stored) {
  // Support old format (plain sha256) for backwards compat
  if (!stored.includes('$')) {
    return stored === createHash('sha256').update(password, 'utf8').digest('hex');
  }
  const [salt, hash] = stored.split('$');
  return hash === createHash('sha256').update(salt + password, 'utf8').digest('hex');
}

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function genToken() {
  return randomBytes(32).toString('hex');
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

// Simple in-memory rate limiter for login attempts.
// Tracks failed attempts per IP. After 5 failures in 15 min, blocks for 15 min.
const loginAttempts = new Map(); // ip → { count, firstAttempt, blockedUntil }
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // max attempts before block
const RATE_LIMIT_BLOCK = 15 * 60 * 1000; // block duration

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { ok: true };
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const waitSec = Math.ceil((entry.blockedUntil - now) / 1000);
    return { ok: false, retryAfter: waitSec };
  }
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    // Block expired — reset
    loginAttempts.delete(ip);
    return { ok: true };
  }
  return { ok: true };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };
  // Reset if window expired
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    entry = { count: 0, firstAttempt: now, blockedUntil: 0 };
  }
  entry.count++;
  if (entry.count >= RATE_LIMIT_MAX) {
    entry.blockedUntil = now + RATE_LIMIT_BLOCK;
  }
  loginAttempts.set(ip, entry);
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

function getClientIP(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Allowed CORS origins — allow any localhost/127.0.0.1 port (dev & static export)
// plus the production gateway port 81. In production, the API service is
// bundled with the .exe so CORS isn't a concern there.
function isAllowedOrigin(origin) {
  if (!origin) return false;
  // Allow any localhost / 127.0.0.1 port (e.g. http://localhost:52448)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Allow *.space-z.ai (preview gateway)
  if (/^https?:\/\/[^/]*\.space-z\.ai(:\d+)?$/.test(origin)) return true;
  // Allow *.lan / *.local (home network)
  if (/^https?:\/\/[^/]*\.(lan|local)(:\d+)?$/.test(origin)) return true;
  return false;
}

function getCorsHeader(req) {
  const origin = req.headers.get('origin') || '';
  return isAllowedOrigin(origin) ? origin : '';
}

// Send a JSON response with CORS headers derived from the request origin.
// Signature: json(body, status?, req?) — but tolerate json(body, req) where
// the caller passes req in the status slot (older call sites did that).
function json(body, statusOrReq, maybeReq) {
  let status = 200;
  let req = null;
  if (typeof statusOrReq === 'number') {
    status = statusOrReq;
    req = maybeReq || null;
  } else if (statusOrReq && typeof statusOrReq === 'object') {
    // caller did json(body, req) — status defaults to 200
    req = statusOrReq;
  }
  const corsOrigin = req ? getCorsHeader(req) : '*';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

function corsOptions(req) {
  const corsOrigin = req ? getCorsHeader(req) : '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

// How recently a user must have hit the API to count as "online".
const ONLINE_THRESHOLD_SEC = 2 * 60; // 2 minutes

// Build the public-facing user object. `viewer` is the user making the
// request (used to gate sensitive fields like phone, which only admins see).
// When viewer is null (e.g. the seed), phone is omitted entirely.
function publicUser(u, viewer) {
  if (!u) return null;
  const lastSeen = Number(u.last_seen || 0);
  const online = lastSeen > 0 && (nowSec() - lastSeen) <= ONLINE_THRESHOLD_SEC;
  const base = {
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    jobTitle: u.job_title || '',
    deputy: u.deputy || '',
    avatar: u.avatar || '',
    createdAt: Number(u.created_at || 0),
    lastSeen,
    online,
  };
  // Phone is sensitive — only admins can see it (their own, or anyone's in the users list).
  // Non-admins always see their own profile so they can edit it, but the field
  // is hidden from other users in /api/users.
  if (viewer && viewer.role === 'admin') {
    base.phone = u.phone || '';
  } else if (viewer && viewer.id === u.id) {
    // The owner can always see + edit their own phone (so they can fill it in).
    base.phone = u.phone || '';
  }
  return base;
}

function rowToShow(r) {
  if (!r) return null;
  let images = [];
  let videos = [];
  try { images = JSON.parse(r.images || '[]'); } catch {}
  try { videos = JSON.parse(r.videos || '[]'); } catch {}
  return {
    num: r.num,
    name: r.name,
    category: r.category,
    source: r.source,
    size: r.size,
    viewers: r.viewers,
    style: r.style,
    effects: r.effects,
    layout: r.layout,
    elements: r.elements,
    materials: r.materials,
    colors: r.colors,
    lighting: r.lighting,
    summary: r.summary,
    descriptionFa: r.descriptionFa,
    youtube: r.youtube,
    imdb: r.imdb,
    wikipedia: r.wikipedia,
    socialPost: r.socialPost,
    images,
    videos,
    isFilm: !!(r.is_film),
  };
}

// Ordered column list — used for positional placeholders.
const SHOW_COLUMNS = [
  'num', 'name', 'category', 'source', 'size', 'viewers', 'style', 'effects', 'layout',
  'elements', 'materials', 'colors', 'lighting', 'summary', 'descriptionFa',
  'youtube', 'imdb', 'wikipedia', 'socialPost', 'images', 'videos',
];

function showToValues(s) {
  return [
    s.num,
    s.name || '',
    s.category || '',
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
    s.summary || '',
    s.descriptionFa || '',
    s.youtube || '',
    s.imdb || '',
    s.wikipedia || '',
    s.socialPost || '',
    JSON.stringify(Array.isArray(s.images) ? s.images : []),
    JSON.stringify(Array.isArray(s.videos) ? s.videos : []),
  ];
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserByToken(token, { touch = true } = {}) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  // Expired?
  if (row.expires_at && row.expires_at < nowSec()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const user = getUserById(row.user_id);
  // Touch last_seen on every authenticated call (throttled to once per minute
  // to avoid hammering the DB on rapid requests).
  if (touch && user) {
    const last = Number(user.last_seen || 0);
    if (nowSec() - last > 60) {
      db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowSec(), user.id);
      user.last_seen = nowSec();
    }
  }
  return user;
}

function createSession(userId) {
  const token = genToken();
  const exp = nowSec() + SESSION_TTL;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, exp);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function touchLastSeen(user) {
  if (!user) return;
  const last = Number(user.last_seen || 0);
  if (nowSec() - last > 60) {
    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowSec(), user.id);
  }
}

function requireUser(req) {
  const auth = req.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const user = getUserByToken(m[1].trim());
  if (user) touchLastSeen(user);
  return user;
}

function requireRole(req, roles) {
  const user = requireUser(req);
  if (!user) return { user: null, ok: false, status: 401, error: 'Unauthorized' };
  if (roles && !roles.includes(user.role)) {
    return { user, ok: false, status: 403, error: 'Forbidden' };
  }
  return { user, ok: true };
}

// ---------------------------------------------------------------------------
// Seed default admin + shows
// ---------------------------------------------------------------------------
function seedDefaultAdmin() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (existing.c === 0) {
    db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
      .run('admin', sha256('admin'), 'admin', 'مدیر سیستم');
    console.log('[seed] created default admin: admin / admin');
  }
}

// Seed (or upsert new) shows from the JSON file.
// Runs only when the JSON has more shows than the DB — so existing user-added
// shows are preserved, but new entries in talk-shows-data.json get picked up
// automatically on the next server restart.
function seedShows() {
  // Try several candidate paths for the talk-shows JSON
  const candidates = [
    resolve(import.meta.dir, '../../public/talk-shows-data.json'),
    resolve(import.meta.dir, '../../../public/talk-shows-data.json'),
    resolve(import.meta.dir, '../public/talk-shows-data.json'),
    resolve(import.meta.dir, 'talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'next-service-dist', 'public', 'talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'api-service', 'talk-shows-data.json'),
    '/home/z/my-project/public/talk-shows-data.json',
  ];
  let path = null;
  for (const p of candidates) {
    if (existsSync(p)) { path = p; break; }
  }
  if (!path) {
    console.warn('[seed] talk-shows-data.json not found — skipping shows seed');
    return;
  }
  let shows;
  try {
    shows = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.warn('[seed] failed to parse talk-shows-data.json:', e.message);
    return;
  }
  if (!Array.isArray(shows)) {
    console.warn('[seed] expected array, got', typeof shows);
    return;
  }

  const existing = db.prepare('SELECT COUNT(*) AS c FROM shows').get();
  // Only (re)seed if the JSON has strictly more shows than the DB already does.
  // This way we pick up newly-added programs without clobbering user-edited rows.
  if (existing.c >= shows.length) {
    console.log(`[seed] DB has ${existing.c} shows, JSON has ${shows.length} — up to date, skipping`);
    return;
  }
  console.log(`[seed] DB has ${existing.c} shows, JSON has ${shows.length} — inserting new entries (preserving existing images)`);

  // Use INSERT OR IGNORE to preserve existing rows (including their image_data BLOBs).
  // INSERT OR REPLACE would wipe image_data on every restart since JSON doesn't contain images.
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO shows
      (num, name, category, source, size, viewers, style, effects, layout,
       elements, materials, colors, lighting, summary, descriptionFa,
       youtube, imdb, wikipedia, socialPost, images, videos)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const s of shows) {
      if (typeof s.num !== 'number') continue;
      try {
        stmt.run(...showToValues(s));
        inserted++;
      } catch (e) {
        console.warn(`[seed] failed to insert show num=${s.num}:`, e.message);
      }
    }
  });
  tx();
  console.log(`[seed] upserted ${inserted} shows (now ${shows.length} total)`);
}

seedDefaultAdmin();
seedShows();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") return corsOptions(req);

    // ----- Health -----
    if (pathname === '/api/health' && method === 'GET') {
      return json({ status: 'ok', time: nowSec() }, req);
    }

    // ----- Image serving -----
    // Returns the stored JPEG for a given show number. CORS-friendly so the
    // static web bundle (served on any port) can load images directly.
    // Route shape: /api/image/<num>  → 200 image/jpeg  (or 404 if no image stored)
    if (pathname.startsWith('/api/image/') && method === 'GET') {
      const numStr = pathname.slice('/api/image/'.length).split('/')[0];
      const num = parseInt(numStr, 10);
      if (!Number.isFinite(num) || num < 1) {
        return json({ error: 'invalid show number' }, 400, req);
      }
      const row = db.prepare('SELECT image_data, image_mime FROM shows WHERE num = ?').get(num);
      if (!row || !row.image_data) {
        return json({ error: 'no image for show ' + num }, 404, req);
      }
      // Build response with proper image headers + cache.
      const origin = req.headers.get('origin') || '';
      const corsOrigin = isAllowedOrigin(origin) ? origin : '*';
      return new Response(new Uint8Array(row.image_data), {
        status: 200,
        headers: {
          'Content-Type': row.image_mime || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // ----- Fetch image from IMDb/Wikipedia and store in DB -----
    // POST /api/fetch-image { num, imdb?, wikipedia? }
    // Downloads the show's poster from OMDb (IMDb) or Wikipedia REST API,
    // resizes it with sharp, and stores the JPEG bytes in image_data.
    if (pathname === '/api/fetch-image' && method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const num = parseInt(body?.num, 10);
      const imdbUrl = String(body?.imdb || '');
      const wikiUrl = String(body?.wikipedia || '');
      const showName = String(body?.name || '');

      if (!Number.isFinite(num) || num < 1) {
        return json({ error: 'شماره برنامه نامعتبر است' }, 400, req);
      }

      const OMDB_API_KEY = 'thewdb';
      const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';
      const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      // Helper: fetch with retry
      async function fetchRetry(url, opts = {}, retries = 2) {
        for (let i = 0; i <= retries; i++) {
          try {
            const res = await fetch(url, opts);
            if (res.ok) return res;
            if (res.status === 404) return res;
            if (res.status === 429) { await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue; }
          } catch (e) { if (i === retries) throw e; await new Promise(r => setTimeout(r, 1500)); }
        }
        return null;
      }

      // Helper: clean query
      function cleanQuery(s) {
        return (s || '').replace(/[?!]+$/, '').replace(/\(.*?\)/g, ' ').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Helper: try OMDb
      async function tryOmdb(url, name) {
        // Direct IMDb ID
        const direct = url?.match(/tt(\d+)/);
        if (direct) {
          const res = await fetchRetry(`https://www.omdbapi.com/?i=tt${direct[1]}&apikey=${OMDB_API_KEY}`, {}, 1);
          if (res && res.ok) {
            const data = await res.json();
            if (data.Response === 'True' && data.Poster && data.Poster !== 'N/A') return data.Poster;
          }
        }
        // Search by name
        const query = cleanQuery(name || url?.match(/[?&]q=([^&]+)/)?.[1]?.replace(/\+/g, ' ') || '');
        if (query) {
          for (const type of ['series', 'movie', '']) {
            const res = await fetchRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}&apikey=${OMDB_API_KEY}`, {}, 1);
            if (res && res.ok) {
              const data = await res.json();
              if (data.Search) {
                for (const item of data.Search) {
                  if (item.Poster && item.Poster !== 'N/A') return item.Poster;
                }
              }
            }
          }
        }
        return null;
      }

      // Helper: try Wikipedia
      async function tryWikipedia(url, name) {
        let pageTitle = null;
        let lang = 'en';
        const direct = url?.match(/\/wiki\/(.+?)(?:\?|#|$)/);
        if (direct) {
          pageTitle = decodeURIComponent(direct[1].replace(/_/g, ' '));
          lang = url.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'en';
        } else {
          const search = url?.match(/[?&]search=([^&]+)/);
          if (search) {
            pageTitle = cleanQuery(decodeURIComponent(search[1].replace(/\+/g, ' ')));
            lang = url.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'fa';
          }
        }
        if (!pageTitle && name) {
          pageTitle = cleanQuery(name);
          lang = 'en';
        }
        if (!pageTitle) return null;

        // Try summary endpoint
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        const res = await fetchRetry(summaryUrl, { headers: { 'User-Agent': UA } }, 1);
        if (res && res.ok) {
          const data = await res.json();
          const img = data.originalimage?.source || data.thumbnail?.source;
          if (img) return img;
        }
        // Try search
        const searchApi = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(pageTitle)}&format=json&origin=*&srlimit=3`;
        const sres = await fetchRetry(searchApi, { headers: { 'User-Agent': UA } }, 1);
        if (sres && sres.ok) {
          const sdata = await sres.json();
          if (sdata.query?.search) {
            for (const hit of sdata.query.search) {
              const sUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
              const ssres = await fetchRetry(sUrl, { headers: { 'User-Agent': UA } }, 1);
              if (ssres && ssres.ok) {
                const ssdata = await ssres.json();
                const img = ssdata.originalimage?.source || ssdata.thumbnail?.source;
                if (img) return img;
              }
            }
          }
        }
        return null;
      }

      let imageUrl = null;
      let source = '';

      // 1. Try OMDb if IMDb link provided
      if (imdbUrl || showName) {
        imageUrl = await tryOmdb(imdbUrl, showName);
        if (imageUrl) source = 'omdb';
      }

      // 2. Try Wikipedia if OMDb failed
      if (!imageUrl && (wikiUrl || showName)) {
        imageUrl = await tryWikipedia(wikiUrl, showName);
        if (imageUrl) source = 'wikipedia';
      }

      if (!imageUrl) {
        return json({ error: 'عکسی یافت نشد' }, 404, req);
      }

      // Download and resize the image
      const isWiki = imageUrl.includes('wikimedia.org') || imageUrl.includes('wikipedia.org');
      const ires = await fetchRetry(imageUrl, {
        headers: isWiki
          ? { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' }
          : { 'User-Agent': BROWSER_UA, 'Accept': 'image/*,*/*;q=0.8', 'Referer': 'https://www.imdb.com/' },
      }, 3);
      if (!ires || !ires.ok) {
        return json({ error: 'دانلود عکس ناموفق بود' }, 500, req);
      }
      const buf = await ires.arrayBuffer();
      const rawBytes = new Uint8Array(buf);
      if (rawBytes.length < 200) {
        return json({ error: 'عکس خیلی کوچک است' }, 500, req);
      }

      // Resize with sharp
      let processed;
      try {
        const sharp = (await import('sharp')).default;
        processed = await sharp(Buffer.from(rawBytes))
          .resize(400, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      } catch (e) {
        processed = Buffer.from(rawBytes);
      }

      // Store in DB
      db.prepare('UPDATE shows SET image_data = ?, image_mime = ?, image_source = ? WHERE num = ?')
        .run(new Uint8Array(processed), 'image/jpeg', source, num);

      // Also update imdb/wikipedia links if provided
      if (imdbUrl) {
        db.prepare('UPDATE shows SET imdb = ? WHERE num = ?').run(imdbUrl, num);
      }
      if (wikiUrl) {
        db.prepare('UPDATE shows SET wikipedia = ? WHERE num = ?').run(wikiUrl, num);
      }

      return json({ success: true, source, size: processed.length }, req);
    }

    // ----- Auth: login -----
    if (pathname === '/api/auth/login' && method === 'POST') {
      // Rate limit check
      const ip = getClientIP(req);
      const rl = checkRateLimit(ip);
      if (!rl.ok) {
        return json({ error: `تلاش‌های ناموفق زیاد. لطفاً ${rl.retryAfter} ثانیه صبر کنید.` }, 429, req);
      }

      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400, req);
      const user = getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        recordFailedAttempt(ip);
        return json({ error: 'نام کاربری یا رمز عبور نادرست است' }, 401, req);
      }
      // Login success — clear rate limit
      clearRateLimit(ip);
      // Mark user as online immediately on login.
      db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowSec(), user.id);
      user.last_seen = nowSec();
      const token = createSession(user.id);
      // viewer = user themselves, so phone is included for self-editing
      return json({ token, user: publicUser(user, user) }, req);
    }

    // ----- Auth: logout -----
    if (pathname === '/api/auth/logout' && method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch {}
      const token = String(body?.token || '');
      const auth = req.headers.get('Authorization') || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      const t = token || (m ? m[1].trim() : '');
      if (t) destroySession(t);
      return json({ success: true }, req);
    }

    // ----- Auth: me -----
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      return json(publicUser(user, user), req);
    }

    // ----- Profile: self get -----
    // Returns the caller's full profile (name, job_title, deputy, phone, ...).
    if (pathname === '/api/profile' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      return json(publicUser(user, user), req);
    }

    // ----- Profile: self update -----
    // Lets any logged-in user update their own profile fields. Role / username
    // are NOT editable here (use admin endpoints for that).
    if (pathname === '/api/profile' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const name       = body?.name       !== undefined ? String(body.name).slice(0, 100) : user.name;
      const jobTitle   = body?.jobTitle   !== undefined ? String(body.jobTitle).slice(0, 100) : (user.job_title || '');
      const deputy     = body?.deputy     !== undefined ? String(body.deputy).slice(0, 100) : (user.deputy || '');
      const phone      = body?.phone      !== undefined ? String(body.phone).slice(0, 30) : (user.phone || '');
      // Avatar can be a data URL — cap at ~2MB to be safe.
      const avatarRaw  = body?.avatar     !== undefined ? String(body.avatar) : (user.avatar || '');
      const avatar     = avatarRaw.length > 2_000_000 ? (user.avatar || '') : avatarRaw;
      db.prepare('UPDATE users SET name = ?, job_title = ?, deputy = ?, phone = ?, avatar = ? WHERE id = ?')
        .run(name, jobTitle, deputy, phone, avatar, user.id);
      const updated = getUserById(user.id);
      return json(publicUser(updated, user), req);
    }

    // ----- Auth: change password -----
    if (pathname === '/api/auth/change-password' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const oldPassword = String(body?.oldPassword || '');
      const newPassword = String(body?.newPassword || '');
      if (!oldPassword || !newPassword) return json({ error: 'رمز قدیمی و جدید را وارد کنید' }, 400, req);
      if (newPassword.length < 4) return json({ error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' }, 400, req);
      if (!verifyPassword(oldPassword, user.password_hash)) {
        return json({ error: 'رمز فعلی نادرست است' }, 401, req);
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
      // Invalidate all sessions for this user, force re-login
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true }, req);
    }

    // ----- Shows: list -----
    if (pathname === '/api/shows' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM shows ORDER BY num ASC').all();
      return json({ shows: rows.map(rowToShow) }, req);
    }

    // ----- Shows: create -----
    if (pathname === '/api/shows' && method === 'POST') {
      const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
      if (!ok) return json({ error }, status, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      if (typeof body?.num !== 'number') {
        // Auto-assign next num
        const max = db.prepare('SELECT MAX(num) AS m FROM shows').get();
        body.num = (max?.m || 0) + 1;
      }
      const row = showToValues(body);
      try {
        db.prepare(`INSERT OR REPLACE INTO shows
          (num, name, category, source, size, viewers, style, effects, layout,
           elements, materials, colors, lighting, summary, descriptionFa,
           youtube, imdb, wikipedia, socialPost, images, videos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?)`).run(...row);
      } catch (e) {
        return json({ error: 'خطا در ایجاد برنامه: ' + e.message }, 500, req);
      }
      return json({ num: body.num }, req);
    }

    // ----- Shows: get by num / update / delete -----
    const showMatch = pathname.match(/^\/api\/shows\/(\d+)$/);
    if (showMatch) {
      const num = Number(showMatch[1]);

      if (method === 'GET') {
        const r = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
        if (!r) return json({ error: 'برنامه یافت نشد' }, 404, req);
        return json({ show: rowToShow(r) }, req);
      }

      if (method === 'PUT') {
        const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
        if (!ok) return json({ error }, status, req);
        let body;
        try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
        const existing = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
        if (!existing) return json({ error: 'برنامه یافت نشد' }, 404, req);
        const merged = { ...rowToShow(existing), ...body, num };
        try {
          db.prepare(`UPDATE shows SET
            name=?, category=?, source=?, size=?, viewers=?,
            style=?, effects=?, layout=?, elements=?, materials=?,
            colors=?, lighting=?, summary=?, descriptionFa=?,
            youtube=?, imdb=?, wikipedia=?, socialPost=?,
            images=?, videos=?
            WHERE num=?`).run(...showToValues(merged).slice(1), num);
        } catch (e) {
          return json({ error: 'خطا در بروزرسانی: ' + e.message }, 500, req);
        }
        return json({ success: true }, req);
      }

      if (method === 'DELETE') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status, req);
        const r = db.prepare('DELETE FROM shows WHERE num = ?').run(num);
        if (r.changes === 0) return json({ error: 'برنامه یافت نشد' }, 404, req);
        return json({ success: true }, req);
      }
    }

    // ----- Users: list / create / delete / update -----
    // Admins can list, create, delete, update any user.
    // Editors can list (read-only) so they can see who's online / last visit.
    if (pathname === '/api/users' && method === 'GET') {
      const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
      if (!ok) return json({ error }, status, req);
      const rows = db.prepare('SELECT * FROM users ORDER BY (last_seen > 0) DESC, last_seen DESC, id ASC').all();
      // Pass the viewer so phone is only included for admins.
      return json({ users: rows.map((u) => publicUser(u, user)), me: user ? user.id : null }, req);
    }

    if (pathname === '/api/users' && method === 'POST') {
      const { user, ok, status, error } = requireRole(req, ['admin']);
      if (!ok) return json({ error }, status, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      const role = ['admin', 'editor', 'viewer'].includes(body?.role) ? body.role : 'viewer';
      const name = String(body?.name || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400, req);
      if (password.length < 8) return json({ error: 'رمز باید حداقل ۸ کاراکتر باشد' }, 400, req);
      const exists = getUserByUsername(username);
      if (exists) return json({ error: 'این نام کاربری قبلاً ثبت شده است' }, 409, req);
      try {
        const r = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
          .run(username, hashPassword(password), role, name);
        return json({ id: Number(r.lastInsertRowid) }, req);
      } catch (e) {
        return json({ error: 'خطا در ایجاد کاربر: ' + e.message }, 500, req);
      }
    }

    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch) {
      const id = Number(userMatch[1]);

      if (method === 'DELETE') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status, req);
        if (user.id === id) return json({ error: 'نمی‌توانید حساب خودتان را حذف کنید' }, 400, req);
        const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (r.changes === 0) return json({ error: 'کاربر یافت نشد' }, 404, req);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        return json({ success: true }, req);
      }

      if (method === 'PUT') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status, req);
        let body;
        try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
        const target = getUserById(id);
        if (!target) return json({ error: 'کاربر یافت نشد' }, 404, req);
        const role = ['admin', 'editor', 'viewer'].includes(body?.role) ? body.role : target.role;
        const name = body?.name !== undefined ? String(body.name) : target.name;
        if (body?.password) {
          if (String(body.password).length < 4) return json({ error: 'رمز باید حداقل ۸ کاراکتر باشد' }, 400, req);
          db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ? WHERE id = ?')
            .run(hashPassword(String(body.password)), role, name, id);
        } else {
          db.prepare('UPDATE users SET role = ?, name = ? WHERE id = ?')
            .run(role, name, id);
        }
        return json({ success: true }, req);
      }
    }

    // 404
    return json({ error: 'Not Found', path: pathname }, 404, req);
  },
});

console.log(`[bankresaneh-api] listening on http://localhost:${server.port}`);
