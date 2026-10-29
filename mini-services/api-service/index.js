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
const DB_PATH = resolve(import.meta.dir, 'bankresaneh.sqlite');
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

// Allowed CORS origins — restrict to known frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:81',
  'http://127.0.0.1:81',
];

function getCorsHeader(req) {
  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0]; // default to first allowed origin
}

function json(body, status = 200, req) {
  const corsOrigin = req ? getCorsHeader(req) : ALLOWED_ORIGINS[0];
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
  const corsOrigin = req ? getCorsHeader(req) : ALLOWED_ORIGINS[0];
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
  console.log(`[seed] DB has ${existing.c} shows, JSON has ${shows.length} — upserting new entries`);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO shows
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
      return json({ status: 'ok', time: nowSec() });
    }

    // ----- Auth: login -----
    if (pathname === '/api/auth/login' && method === 'POST') {
      // Rate limit check
      const ip = getClientIP(req);
      const rl = checkRateLimit(ip);
      if (!rl.ok) {
        return json({ error: `تلاش‌های ناموفق زیاد. لطفاً ${rl.retryAfter} ثانیه صبر کنید.` }, 429);
      }

      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400);
      const user = getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        recordFailedAttempt(ip);
        return json({ error: 'نام کاربری یا رمز عبور نادرست است' }, 401);
      }
      // Login success — clear rate limit
      clearRateLimit(ip);
      // Mark user as online immediately on login.
      db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowSec(), user.id);
      user.last_seen = nowSec();
      const token = createSession(user.id);
      // viewer = user themselves, so phone is included for self-editing
      return json({ token, user: publicUser(user, user) });
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
      return json({ success: true });
    }

    // ----- Auth: me -----
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      return json(publicUser(user, user));
    }

    // ----- Profile: self get -----
    // Returns the caller's full profile (name, job_title, deputy, phone, ...).
    if (pathname === '/api/profile' && method === 'GET') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      return json(publicUser(user, user));
    }

    // ----- Profile: self update -----
    // Lets any logged-in user update their own profile fields. Role / username
    // are NOT editable here (use admin endpoints for that).
    if (pathname === '/api/profile' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
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
      return json(publicUser(updated, user));
    }

    // ----- Auth: change password -----
    if (pathname === '/api/auth/change-password' && method === 'PUT') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
      const oldPassword = String(body?.oldPassword || '');
      const newPassword = String(body?.newPassword || '');
      if (!oldPassword || !newPassword) return json({ error: 'رمز قدیمی و جدید را وارد کنید' }, 400);
      if (newPassword.length < 4) return json({ error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' }, 400);
      if (!verifyPassword(oldPassword, user.password_hash)) {
        return json({ error: 'رمز فعلی نادرست است' }, 401);
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
      // Invalidate all sessions for this user, force re-login
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true });
    }

    // ----- Shows: list -----
    if (pathname === '/api/shows' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM shows ORDER BY num ASC').all();
      return json({ shows: rows.map(rowToShow) });
    }

    // ----- Shows: create -----
    if (pathname === '/api/shows' && method === 'POST') {
      const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
      if (!ok) return json({ error }, status);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
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
        return json({ error: 'خطا در ایجاد برنامه: ' + e.message }, 500);
      }
      return json({ num: body.num });
    }

    // ----- Shows: get by num / update / delete -----
    const showMatch = pathname.match(/^\/api\/shows\/(\d+)$/);
    if (showMatch) {
      const num = Number(showMatch[1]);

      if (method === 'GET') {
        const r = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
        if (!r) return json({ error: 'برنامه یافت نشد' }, 404);
        return json({ show: rowToShow(r) });
      }

      if (method === 'PUT') {
        const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
        if (!ok) return json({ error }, status);
        let body;
        try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
        const existing = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
        if (!existing) return json({ error: 'برنامه یافت نشد' }, 404);
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
          return json({ error: 'خطا در بروزرسانی: ' + e.message }, 500);
        }
        return json({ success: true });
      }

      if (method === 'DELETE') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status);
        const r = db.prepare('DELETE FROM shows WHERE num = ?').run(num);
        if (r.changes === 0) return json({ error: 'برنامه یافت نشد' }, 404);
        return json({ success: true });
      }
    }

    // ----- Users: list / create / delete / update -----
    // Admins can list, create, delete, update any user.
    // Editors can list (read-only) so they can see who's online / last visit.
    if (pathname === '/api/users' && method === 'GET') {
      const { user, ok, status, error } = requireRole(req, ['admin', 'editor']);
      if (!ok) return json({ error }, status);
      const rows = db.prepare('SELECT * FROM users ORDER BY (last_seen > 0) DESC, last_seen DESC, id ASC').all();
      // Pass the viewer so phone is only included for admins.
      return json({ users: rows.map((u) => publicUser(u, user)), me: user ? user.id : null });
    }

    if (pathname === '/api/users' && method === 'POST') {
      const { user, ok, status, error } = requireRole(req, ['admin']);
      if (!ok) return json({ error }, status);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      const role = ['admin', 'editor', 'viewer'].includes(body?.role) ? body.role : 'viewer';
      const name = String(body?.name || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400);
      if (password.length < 8) return json({ error: 'رمز باید حداقل ۸ کاراکتر باشد' }, 400);
      const exists = getUserByUsername(username);
      if (exists) return json({ error: 'این نام کاربری قبلاً ثبت شده است' }, 409);
      try {
        const r = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
          .run(username, hashPassword(password), role, name);
        return json({ id: Number(r.lastInsertRowid) });
      } catch (e) {
        return json({ error: 'خطا در ایجاد کاربر: ' + e.message }, 500);
      }
    }

    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch) {
      const id = Number(userMatch[1]);

      if (method === 'DELETE') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status);
        if (user.id === id) return json({ error: 'نمی‌توانید حساب خودتان را حذف کنید' }, 400);
        const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (r.changes === 0) return json({ error: 'کاربر یافت نشد' }, 404);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        return json({ success: true });
      }

      if (method === 'PUT') {
        const { user, ok, status, error } = requireRole(req, ['admin']);
        if (!ok) return json({ error }, status);
        let body;
        try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
        const target = getUserById(id);
        if (!target) return json({ error: 'کاربر یافت نشد' }, 404);
        const role = ['admin', 'editor', 'viewer'].includes(body?.role) ? body.role : target.role;
        const name = body?.name !== undefined ? String(body.name) : target.name;
        if (body?.password) {
          if (String(body.password).length < 4) return json({ error: 'رمز باید حداقل ۸ کاراکتر باشد' }, 400);
          db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ? WHERE id = ?')
            .run(hashPassword(String(body.password)), role, name, id);
        } else {
          db.prepare('UPDATE users SET role = ?, name = ? WHERE id = ?')
            .run(role, name, id);
        }
        return json({ success: true });
      }
    }

    // 404
    return json({ error: 'Not Found', path: pathname }, 404);
  },
});

console.log(`[bankresaneh-api] listening on http://localhost:${server.port}`);
