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
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PORT = 3002;

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
const DB_PATH = resolve(process.env.DB_PATH || join(import.meta.dir, 'bankresaneh.sqlite'));
const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer', -- admin | editor | viewer
    name          TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
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

// Backward-compatible schema migrations for databases created by older builds.
// Keep these additive so existing show records and user sessions are preserved.
const SHOW_MIGRATIONS = [
  ['image_data', 'BLOB'],
  ['image_mime', "TEXT NOT NULL DEFAULT 'image/jpeg'"],
  ['image_source', "TEXT NOT NULL DEFAULT ''"],
  ['is_film', 'INTEGER NOT NULL DEFAULT 0'],
];
const existingShowColumns = new Set(db.query('PRAGMA table_info(shows)').all().map((column) => column.name));
for (const [column, definition] of SHOW_MIGRATIONS) {
  if (!existingShowColumns.has(column)) {
    db.exec(`ALTER TABLE shows ADD COLUMN ${column} ${definition}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function allowedOrigins() {
  return new Set((process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins().has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      [3000, 3001, 3002].includes(Number(parsed.port || 80));
  } catch { return false; }
}

function corsHeaders(req) {
  const configuredOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  const origin = req?.headers.get('origin');
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Reflect only explicitly trusted origins. This supports localhost and
  // 127.0.0.1 development URLs without returning a mismatched ACAO header.
  if (!origin) {
    headers['Access-Control-Allow-Origin'] = configuredOrigin;
  } else if (origin === configuredOrigin || isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function json(body, status = 200, req = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(req),
    },
  });
}

function corsOptions(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, name: u.name };
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

function getUserByToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  // Expired?
  if (row.expires_at && row.expires_at < nowSec()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return getUserById(row.user_id);
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

function requireUser(req) {
  const auth = req.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return getUserByToken(m[1].trim());
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

function seedShows() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM shows').get();
  if (existing.c > 0) {
    console.log(`[seed] shows table already has ${existing.c} rows — skipping seed`);
    return;
  }
  // Try several candidate paths for the talk-shows JSON
  const candidates = [
    resolve(import.meta.dir, '../../public/talk-shows-data.json'),
    resolve(import.meta.dir, '../../../public/talk-shows-data.json'),
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
  console.log(`[seed] loading shows from ${path}`);
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
  console.log(`[seed] inserted ${inserted} shows`);
}

seedDefaultAdmin();
seedShows();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (method === 'OPTIONS') return corsOptions(req);

    // ----- Health -----
    if (pathname === '/api/health' && method === 'GET') {
      return json({ status: 'ok', time: nowSec() }, 200, req);
    }


    // ----- Image serving -----
    if (pathname.startsWith('/api/image/') && method === 'GET') {
      const numStr = pathname.slice('/api/image/'.length).split('/')[0];
      const num = parseInt(numStr, 10);
      if (!Number.isFinite(num) || num < 1) return json({ error: 'invalid show number' }, 400, req);
      const row = db.prepare('SELECT image_data, image_mime FROM shows WHERE num = ?').get(num);
      if (!row || !row.image_data) return json({ error: 'no image for show ' + num }, 404, req);
      const origin = req.headers.get('origin') || '';
      const corsOrigin = isAllowedOrigin(origin) ? origin : 'http://127.0.0.1:3000';
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
      // Try OMDb
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
      // Try Wikipedia
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
      return json({ success: true, source, size: processed.length }, 200, req);
    }

    // ----- Auth: login -----
    if (pathname === '/api/auth/login' && method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400, req); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400, req);
      const user = getUserByUsername(username);
      if (!user || user.password_hash !== sha256(password)) {
        return json({ error: 'نام کاربری یا رمز عبور نادرست است' }, 401, req);
      }
      const token = createSession(user.id);
      return json({ token, user: publicUser(user) }, 200, req);
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
      return json({ success: true }, 200, req);
    }

    // ----- Auth: me -----
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      return json(publicUser(user), 200, req);
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
      if (user.password_hash !== sha256(oldPassword)) {
        return json({ error: 'رمز فعلی نادرست است' }, 401, req);
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(sha256(newPassword), user.id);
      // Invalidate all sessions for this user, force re-login
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true }, 200, req);
    }

    // ----- Shows: list -----
    if (pathname === '/api/shows' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM shows ORDER BY num ASC').all();
      return json({ shows: rows.map(rowToShow) }, 200, req);
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
        db.prepare(`INSERT OR IGNORE INTO shows
          (num, name, category, source, size, viewers, style, effects, layout,
           elements, materials, colors, lighting, summary, descriptionFa,
           youtube, imdb, wikipedia, socialPost, images, videos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?)`).run(...row);
      } catch (e) {
        return json({ error: 'خطا در ایجاد برنامه: ' + e.message }, 500, req);
      }
      return json({ num: body.num }, 200, req);
    }

    // ----- Shows: get by num / update / delete -----
    const showMatch = pathname.match(/^\/api\/shows\/(\d+)$/);
    if (showMatch) {
      const num = Number(showMatch[1]);

      if (method === 'GET') {
        const r = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
        if (!r) return json({ error: 'برنامه یافت نشد' }, 404, req);
        return json({ show: rowToShow(r) }, 200, req);
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
        return json({ success: true }, 200, req);
      }

      if (method === 'DELETE') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status, req);
        const r = db.prepare('DELETE FROM shows WHERE num = ?').run(num);
        if (r.changes === 0) return json({ error: 'برنامه یافت نشد' }, 404, req);
        return json({ success: true }, 200, req);
      }
    }

    // ----- Users: list / create / delete / update -----
    if (pathname === '/api/users' && method === 'GET') {
      const { user, ok, status, error } = requireRole(req, ['admin']);
      if (!ok) return json({ error }, status, req);
      const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
      return json({ users: rows.map(publicUser) }, 200, req);
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
      if (password.length < 4) return json({ error: 'رمز باید حداقل ۴ کاراکتر باشد' }, 400, req);
      const exists = getUserByUsername(username);
      if (exists) return json({ error: 'این نام کاربری قبلاً ثبت شده است' }, 409, req);
      try {
        const r = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
          .run(username, sha256(password), role, name);
        return json({ id: Number(r.lastInsertRowid) }, 200, req);
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
        return json({ success: true }, 200, req);
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
          if (String(body.password).length < 4) return json({ error: 'رمز باید حداقل ۴ کاراکتر باشد' }, 400, req);
          db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ? WHERE id = ?')
            .run(sha256(String(body.password)), role, name, id);
        } else {
          db.prepare('UPDATE users SET role = ?, name = ? WHERE id = ?')
            .run(role, name, id);
        }
        return json({ success: true }, 200, req);
      }
    }

    // 404
    return json({ error: 'Not Found', path: pathname }, 404, req);
  },
});

console.log(`[bankresaneh-api] listening on http://localhost:${server.port}`);
