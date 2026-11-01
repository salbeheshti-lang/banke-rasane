// ============================================================================
//  BankResaneh local API service — Bun + bun:sqlite
//  Port: 3002
//
//  IMPORTANT: This service requires Bun (bun:sqlite is Bun-only).
//  When packaged with Electron, a bundled Bun binary is used.
//
//  Tables: users, sessions, shows
//  Default admin: admin / admin (SHA-256 hashed)
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

// Ensure parent dir exists
try {
  const dir = resolve(DB_PATH, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
} catch (e) { /* ignore */ }

// On first run inside Electron, copy the bundled seed DB
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
    role          TEXT NOT NULL DEFAULT 'viewer',
    created_at    INTEGER NOT NULL DEFAULT 0,
    last_seen     INTEGER NOT NULL DEFAULT 0,
    job_title     TEXT NOT NULL DEFAULT '',
    avatar        TEXT NOT NULL DEFAULT '',
    deputy        TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token    TEXT PRIMARY KEY,
    user_id  INTEGER NOT NULL,
    created  INTEGER NOT NULL,
    expires  INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
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
    images       TEXT NOT NULL DEFAULT '[]',
    videos       TEXT NOT NULL DEFAULT '[]'
  );
`);

// --- Add columns that may not exist in older bundled DBs ---
function addColumnIfMissing(table, column, definition) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`[migration] added ${table}.${column}`);
    }
  } catch (e) {
    console.warn(`[migration] failed to add ${table}.${column}:`, e.message);
  }
}
addColumnIfMissing('shows', 'image_data', 'BLOB');
addColumnIfMissing('shows', 'image_mime', "TEXT NOT NULL DEFAULT 'image/jpeg'");
addColumnIfMissing('shows', 'image_source', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('shows', 'is_film', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('shows', 'tags', "TEXT NOT NULL DEFAULT '[]'");

// ---------------------------------------------------------------------------
// CORS — allow any localhost/127.0.0.1 port + space-z.ai preview gateway
// ---------------------------------------------------------------------------
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/[^/]*\.space-z\.ai(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/[^/]*\.(lan|local)(:\d+)?$/.test(origin)) return true;
  return false;
}
function getCorsHeader(req) {
  const origin = req.headers.get('origin') || '';
  return isAllowedOrigin(origin) ? origin : '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(body, statusOrReq, maybeReq) {
  let status = 200, req = null;
  if (typeof statusOrReq === 'number') { status = statusOrReq; req = maybeReq; }
  else { req = statusOrReq; }
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
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }});
}

function publicUser(u, viewer) {
  if (!u) return null;
  const base = {
    id: u.id, username: u.username, role: u.role, name: u.name,
    createdAt: u.created_at, lastSeen: u.last_seen,
    online: u.last_seen && (nowSec() - u.last_seen) < 120,
    jobTitle: u.job_title || '', deputy: u.deputy || '', avatar: u.avatar || '',
  };
  // Phone visible only to admins (or self)
  if (viewer && viewer.role === 'admin') base.phone = u.phone || '';
  return base;
}

function rowToShow(r) {
  if (!r) return null;
  let images = [], videos = [];
  try { images = JSON.parse(r.images || '[]'); } catch {}
  try { videos = JSON.parse(r.videos || '[]'); } catch {}
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch {}
  return {
    num: r.num, name: r.name, category: r.category, source: r.source,
    size: r.size, viewers: r.viewers, style: r.style, effects: r.effects,
    layout: r.layout, elements: r.elements, materials: r.materials,
    colors: r.colors, lighting: r.lighting, summary: r.summary,
    descriptionFa: r.descriptionFa, youtube: r.youtube, imdb: r.imdb,
    wikipedia: r.wikipedia, socialPost: r.socialPost,
    images, videos, tags,
    isFilm: !!(r.is_film),
  };
}

const SHOW_COLUMNS = [
  'num', 'name', 'category', 'source', 'size', 'viewers', 'style', 'effects', 'layout',
  'elements', 'materials', 'colors', 'lighting', 'summary', 'descriptionFa',
  'youtube', 'imdb', 'wikipedia', 'socialPost', 'images', 'videos',
];
function showToValues(s) {
  return [
    s.num, s.name || '', s.category || '', s.source || '', s.size || '', s.viewers || '',
    s.style || '', s.effects || '', s.layout || '', s.elements || '', s.materials || '',
    s.colors || '', s.lighting || '', s.summary || '', s.descriptionFa || '',
    s.youtube || '', s.imdb || '', s.wikipedia || '', s.socialPost || '',
    JSON.stringify(Array.isArray(s.images) ? s.images : []),
    JSON.stringify(Array.isArray(s.videos) ? s.videos : []),
  ];
}

function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id); }
function getUserByUsername(username) { return db.prepare('SELECT * FROM users WHERE username = ?').get(username); }
function getUserByToken(token) {
  const row = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires > ?').get(token, nowSec());
  return row ? getUserById(row.user_id) : null;
}
function createSession(userId) {
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, user_id, created, expires) VALUES (?, ?, ?, ?)').run(token, userId, nowSec(), nowSec() + 7 * 86400);
  return token;
}
function destroySession(token) { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); }
function requireUser(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token ? getUserByToken(token) : null;
}
function requireRole(req, roles) {
  const user = requireUser(req);
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

function sha256(s) { return createHash('sha256').update(s, 'utf8').digest('hex'); }
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password, 'utf8').digest('hex');
  return salt + '$' + hash;
}
function verifyPassword(password, stored) {
  if (!stored.includes('$')) return stored === sha256(password);
  const [salt, hash] = stored.split('$');
  return hash === createHash('sha256').update(salt + password, 'utf8').digest('hex');
}
function genToken() { return randomBytes(32).toString('hex'); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function getClientIP(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// ---------------------------------------------------------------------------
// Login rate limiting
// ---------------------------------------------------------------------------
const loginAttempts = new Map();
function checkRateLimit(ip) {
  const entry = loginAttempts.get(ip);
  const now = nowSec();
  if (!entry || now > entry.blockedUntil) {
    if (entry && now > entry.blockedUntil) loginAttempts.delete(ip);
    return { ok: true };
  }
  return { ok: false, retryAfter: entry.blockedUntil - now };
}
function recordFailedAttempt(ip) {
  const now = nowSec();
  let entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= 5) entry.blockedUntil = now + 900;
  loginAttempts.set(ip, entry);
}
function clearRateLimit(ip) { loginAttempts.delete(ip); }

// ---------------------------------------------------------------------------
// Seed default admin + shows
// ---------------------------------------------------------------------------
function seedDefaultAdmin() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (existing.c === 0) {
    db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)').run('admin', sha256('admin'), 'admin', 'مدیر سیستم');
    console.log('[seed] created default admin: admin / admin');
  }
}

function seedShows() {
  const candidates = [
    resolve(import.meta.dir, 'talk-shows-data.json'),
    resolve(import.meta.dir, '../../public/talk-shows-data.json'),
    resolve(import.meta.dir, '../../../public/talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'api-service', 'talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'next-service-dist', 'public', 'talk-shows-data.json'),
  ];
  let jsonPath = null;
  for (const p of candidates) {
    if (existsSync(p)) { jsonPath = p; break; }
  }
  if (!jsonPath) {
    console.warn('[seed] talk-shows-data.json not found — skipping shows seed');
    return;
  }
  console.log(`[seed] loading shows from ${jsonPath}`);
  let shows;
  try { shows = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch (e) {
    console.warn('[seed] failed to parse:', e.message); return;
  }
  if (!Array.isArray(shows)) { console.warn('[seed] expected array'); return; }
  const existing = db.prepare('SELECT COUNT(*) AS c FROM shows').get();
  if (existing.c >= shows.length) {
    console.log(`[seed] DB has ${existing.c} shows, JSON has ${shows.length} — up to date, skipping`);
    return;
  }
  console.log(`[seed] DB has ${existing.c} shows, JSON has ${shows.length} — inserting new entries`);
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO shows
      (num, name, category, source, size, viewers, style, effects, layout,
       elements, materials, colors, lighting, summary, descriptionFa,
       youtube, imdb, wikipedia, socialPost, images, videos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const s of shows) {
      if (typeof s.num !== 'number') continue;
      try { stmt.run(...showToValues(s)); inserted++; } catch (e) {
        console.warn(`[seed] failed to insert show num=${s.num}:`, e.message);
      }
    }
  });
  tx();
  console.log(`[seed] inserted ${inserted} shows (now ${shows.length} total)`);
}

seedDefaultAdmin();
seedShows();

// ---------------------------------------------------------------------------
// Bun server
// ---------------------------------------------------------------------------
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') return corsOptions(req);

    // ----- Health -----
    if (pathname === '/api/health' && method === 'GET') {
      return json({ status: 'ok', time: nowSec() }, req);
    }

    // ----- Image serving -----
    if (pathname.startsWith('/api/image/') && method === 'GET') {
      const numStr = pathname.slice('/api/image/'.length).split('/')[0];
      const num = parseInt(numStr, 10);
      if (!Number.isFinite(num) || num < 1) return json({ error: 'invalid show number' }, 400, req);
      const row = db.prepare('SELECT image_data, image_mime FROM shows WHERE num = ?').get(num);
      if (!row || !row.image_data) return json({ error: 'no image for show ' + num }, 404, req);
      const origin = req.headers.get('origin') || '';
      const corsOrigin = isAllowedOrigin(origin) ? origin : '*';
      return new Response(new Uint8Array(row.image_data), {
        status: 200,
        headers: {
          'Content-Type': row.image_mime || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // ----- Fetch image from IMDb/Wikipedia -----
    if (pathname === '/api/fetch-image' && method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const num = parseInt(body?.num, 10);
      const imdbUrl = String(body?.imdb || '');
      const wikiUrl = String(body?.wikipedia || '');
      const showName = String(body?.name || '');
      if (!Number.isFinite(num) || num < 1) return json({ error: 'invalid show number' }, 400, req);

      const OMDB_API_KEY = 'thewdb';
      const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';
      const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      async function fetchRetry(url, opts = {}, retries = 2) {
        for (let i = 0; i <= retries; i++) {
          try { const r = await fetch(url, opts); if (r.ok) return r; if (r.status === 429) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; } if (r.status === 404) return r; }
          catch(e) { if (i === retries) throw e; await new Promise(x=>setTimeout(x,1500)); }
        }
        return null;
      }
      function cleanQ(s) { return (s||'').replace(/[?!]+$/,'').replace(/\(.*?\)/g,' ').replace(/[\u2013\u2014-]/g,' ').replace(/\s+/g,' ').trim(); }

      let imageUrl = null, source = '';
      const direct = imdbUrl?.match(/tt(\d+)/);
      if (direct) {
        const r = await fetchRetry(`https://www.omdbapi.com/?i=tt${direct[1]}&apikey=${OMDB_API_KEY}`,{},1);
        if (r && r.ok) { const d = await r.json(); if (d.Response==='True' && d.Poster && d.Poster!=='N/A') { imageUrl=d.Poster; source='omdb'; } }
      }
      if (!imageUrl && showName) {
        const q = cleanQ(showName);
        if (q) {
          const r = await fetchRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(q)}&apikey=${OMDB_API_KEY}`,{},1);
          if (r && r.ok) { const d = await r.json(); if (d.Search) for (const item of d.Search) if (item.Poster && item.Poster!=='N/A') { imageUrl=item.Poster; source='omdb'; break; } }
        }
      }
      if (!imageUrl && showName) {
        for (const lang of ['en','fa']) {
          for (const suffix of [' (TV series)',' (TV program)',' (film)','']) {
            const r = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQ(showName)+suffix)}`,{headers:{'User-Agent':UA}},1);
            if (r && r.ok) { const d = await r.json(); const img = d.originalimage?.source || d.thumbnail?.source; if (img) { imageUrl=img; source='wikipedia-'+lang; break; } }
          }
          if (imageUrl) break;
        }
      }
      if (!imageUrl) return json({ error: 'no image found' }, 404, req);

      const isWiki = imageUrl.includes('wikimedia.org') || imageUrl.includes('wikipedia.org');
      const ires = await fetchRetry(imageUrl, { headers: isWiki ? {'User-Agent':UA} : {'User-Agent':BROWSER_UA,'Referer':'https://www.imdb.com/'} }, 3);
      if (!ires || !ires.ok) return json({ error: 'download failed' }, 500, req);
      const buf = await ires.arrayBuffer();
      const raw = new Uint8Array(buf);
      if (raw.length < 200) return json({ error: 'image too small' }, 500, req);

      let processed;
      try {
        const sharp = (await import('sharp')).default;
        processed = await sharp(Buffer.from(raw)).resize(400, 600, { fit:'inside', withoutEnlargement:true }).jpeg({ quality:85, mozjpeg:true }).toBuffer();
      } catch(e) { processed = Buffer.from(raw); }

      db.prepare('UPDATE shows SET image_data = ?, image_mime = ?, image_source = ? WHERE num = ?').run(new Uint8Array(processed), 'image/jpeg', source, num);
      if (imdbUrl) db.prepare('UPDATE shows SET imdb = ? WHERE num = ?').run(imdbUrl, num);
      if (wikiUrl) db.prepare('UPDATE shows SET wikipedia = ? WHERE num = ?').run(wikiUrl, num);
      return json({ success: true, source, size: processed.length }, req);
    }

    // ----- Auth: login -----
    if (pathname === '/api/auth/login' && method === 'POST') {
      const ip = getClientIP(req);
      const rl = checkRateLimit(ip);
      if (!rl.ok) return json({ error: `تلاش‌های ناموفق زیاد. لطفاً ${rl.retryAfter} ثانیه صبر کنید.` }, 429, req);
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
      clearRateLimit(ip);
      db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowSec(), user.id);
      user.last_seen = nowSec();
      const token = createSession(user.id);
      return json({ token, user: publicUser(user, user) }, req);
    }

    // ----- Auth: logout -----
    if (pathname === '/api/auth/logout' && method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch {}
      const token = String(body?.token || '');
      const auth = req.headers.get('Authorization') || '';
      const t = auth.startsWith('Bearer ') ? auth.slice(7) : token;
      if (t) destroySession(t);
      return json({ success: true }, req);
    }

    // ----- Auth: me -----
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      return json(publicUser(user, user), req);
    }

    // ----- Profile -----
    if (pathname === '/api/profile' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      return json(publicUser(user, user), req);
    }
    if (pathname === '/api/profile' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const updated = db.prepare(`
        UPDATE users SET name = ?, job_title = ?, deputy = ?, avatar = ?, phone = ?
        WHERE id = ?
      `).run(
        body.name ?? user.name,
        body.jobTitle ?? user.job_title,
        body.deputy ?? user.deputy,
        body.avatar ?? user.avatar,
        body.phone ?? user.phone,
        user.id
      );
      return json(publicUser(getUserById(user.id), user), req);
    }

    // ----- Change password -----
    if (pathname === '/api/auth/change-password' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const oldPassword = String(body?.oldPassword || '');
      const newPassword = String(body?.newPassword || '');
      if (!oldPassword || !newPassword) return json({ error: 'رمز قدیمی و جدید را وارد کنید' }, 400, req);
      if (newPassword.length < 4) return json({ error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' }, 400, req);
      if (!verifyPassword(oldPassword, user.password_hash)) return json({ error: 'رمز فعلی نادرست است' }, 401, req);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true }, req);
    }

    // ----- Shows: list -----
    if (pathname === '/api/shows' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM shows ORDER BY num').all();
      return json({ shows: rows.map(rowToShow) }, req);
    }

    // ----- Shows: create -----
    if (pathname === '/api/shows' && method === 'POST') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      if (!body.num) {
        const max = db.prepare('SELECT MAX(num) AS m FROM shows').get();
        body.num = (max?.m || 0) + 1;
      }
      db.prepare(`INSERT OR REPLACE INTO shows (${SHOW_COLUMNS.join(', ')}) VALUES (${SHOW_COLUMNS.map(() => '?').join(', ')})`).run(...showToValues(body));
      return json(rowToShow(db.prepare('SELECT * FROM shows WHERE num = ?').get(body.num)), req);
    }

    // ----- Shows: update -----
    if (pathname.startsWith('/api/shows/') && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      const num = parseInt(pathname.slice('/api/shows/'.length));
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      body.num = num;
      const existing = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
      if (!existing) return json({ error: 'show not found' }, 404, req);
      const merged = { ...rowToShow(existing), ...body, num };
      db.prepare(`INSERT OR REPLACE INTO shows (${SHOW_COLUMNS.join(', ')}) VALUES (${SHOW_COLUMNS.map(() => '?').join(', ')})`).run(...showToValues(merged));
      return json(rowToShow(db.prepare('SELECT * FROM shows WHERE num = ?').get(num)), req);
    }

    // ----- Shows: delete -----
    if (pathname.startsWith('/api/shows') && method === 'DELETE') {
      const user = requireRole(req, ['admin', 'editor']);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      const num = parseInt(url.searchParams.get('num') || '0');
      if (!num) return json({ error: 'num required' }, 400, req);
      db.prepare('DELETE FROM shows WHERE num = ?').run(num);
      return json({ success: true }, req);
    }

    // ----- Users: list -----
    if (pathname === '/api/users' && method === 'GET') {
      const user = requireRole(req, ['admin']);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
      return json({ users: rows.map(u => publicUser(u, user)) }, req);
    }

    // ----- Users: create -----
    if (pathname === '/api/users' && method === 'POST') {
      const admin = requireRole(req, ['admin']);
      if (!admin) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز required' }, 400, req);
      const existing = getUserByUsername(username);
      if (existing) return json({ error: 'نام کاربری تکراری' }, 409, req);
      const result = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)').run(username, hashPassword(password), body.role || 'viewer', body.name || '');
      return json(publicUser(getUserById(result.lastInsertRowid), admin), req);
    }

    // ----- Users: update -----
    if (pathname.startsWith('/api/users') && method === 'PUT') {
      const admin = requireRole(req, ['admin']);
      if (!admin) return json({ error: 'Unauthorized' }, 401, req);
      const id = parseInt(url.searchParams.get('id') || '0');
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const target = getUserById(id);
      if (!target) return json({ error: 'user not found' }, 404, req);
      db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(body.name ?? target.name, body.role ?? target.role, id);
      return json(publicUser(getUserById(id), admin), req);
    }

    // ----- Users: delete -----
    if (pathname.startsWith('/api/users') && method === 'DELETE') {
      const admin = requireRole(req, ['admin']);
      if (!admin) return json({ error: 'Unauthorized' }, 401, req);
      const id = parseInt(url.searchParams.get('id') || '0');
      if (id === admin.id) return json({ error: 'cannot delete self' }, 400, req);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return json({ success: true }, req);
    }

    return json({ error: 'Not Found', path: pathname }, 404, req);
  },
});

console.log(`[bankresaneh-api] listening on http://localhost:${PORT}`);
