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

// Full-text index: created once and maintained transactionally by SQLite triggers.
const hadShowsFts = !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'shows_fts'").get();
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS shows_fts USING fts5(
    name, category, summary, descriptionFa, source, style, effects, layout,
    elements, materials, colors, lighting,
    content='shows', content_rowid='num',
    tokenize='unicode61 remove_diacritics 2',
    prefix='2 3'
  );
  CREATE TRIGGER IF NOT EXISTS shows_fts_ai AFTER INSERT ON shows BEGIN
    INSERT INTO shows_fts(rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
    VALUES (new.num, new.name, new.category, new.summary, new.descriptionFa, new.source, new.style, new.effects, new.layout, new.elements, new.materials, new.colors, new.lighting);
  END;
  CREATE TRIGGER IF NOT EXISTS shows_fts_ad AFTER DELETE ON shows BEGIN
    INSERT INTO shows_fts(shows_fts, rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
    VALUES ('delete', old.num, old.name, old.category, old.summary, old.descriptionFa, old.source, old.style, old.effects, old.layout, old.elements, old.materials, old.colors, old.lighting);
  END;
  CREATE TRIGGER IF NOT EXISTS shows_fts_au AFTER UPDATE ON shows BEGIN
    INSERT INTO shows_fts(shows_fts, rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
    VALUES ('delete', old.num, old.name, old.category, old.summary, old.descriptionFa, old.source, old.style, old.effects, old.layout, old.elements, old.materials, old.colors, old.lighting);
    INSERT INTO shows_fts(rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
    VALUES (new.num, new.name, new.category, new.summary, new.descriptionFa, new.source, new.style, new.effects, new.layout, new.elements, new.materials, new.colors, new.lighting);
  END;
`);
if (!hadShowsFts) db.exec("INSERT INTO shows_fts(shows_fts) VALUES ('rebuild')");

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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function corsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
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
  console.log(`[seed] inserted ${inserted} shows`);
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

    if (method === 'OPTIONS') return corsOptions();

    // ----- Health -----
    if (pathname === '/api/health' && method === 'GET') {
      return json({ status: 'ok', time: nowSec() });
    }

    // ----- Auth: login -----
    if (pathname === '/api/auth/login' && method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'پاسخ نامعتبر است' }, 400); }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400);
      const user = getUserByUsername(username);
      if (!user || user.password_hash !== sha256(password)) {
        return json({ error: 'نام کاربری یا رمز عبور نادرست است' }, 401);
      }
      const token = createSession(user.id);
      return json({ token, user: publicUser(user) });
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
      return json(publicUser(user));
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
      if (user.password_hash !== sha256(oldPassword)) {
        return json({ error: 'رمز فعلی نادرست است' }, 401);
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(sha256(newPassword), user.id);
      // Invalidate all sessions for this user, force re-login
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true });
    }

    // ----- Shows: indexed-style search with bounded pagination -----
    if (pathname === '/api/shows/search' && method === 'GET') {
      const rawSearch = url.searchParams.get('q') || url.searchParams.get('search') || '';
      const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase()
        .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
        .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u200c\u200d\uFEFF]/g, ' ')
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
      const query = normalize(rawSearch);
      const category = normalize(url.searchParams.get('category') || '');
      const page = Math.max(1, Math.min(1000000, parseInt(url.searchParams.get('page') || '1', 10) || 1));
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '30', 10) || 30));
      const terms = query.split(' ').filter(Boolean).slice(0, 8);
      const conditions = [];
      const params = [];
      if (terms.length) {
        conditions.push('(' + terms.map(() => "(name LIKE ? OR category LIKE ? OR summary LIKE ? OR descriptionFa LIKE ? OR source LIKE ? OR style LIKE ? OR effects LIKE ? OR layout LIKE ? OR elements LIKE ? OR materials LIKE ? OR colors LIKE ? OR lighting LIKE ?)").join(' AND ') + ')');
        for (const term of terms) {
          const pattern = '%' + term + '%';
          params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
        }
      }
      if (category) { conditions.push('LOWER(category) LIKE ?'); params.push('%' + category + '%'); }
      const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
      const total = db.prepare('SELECT COUNT(*) AS total FROM shows' + where).get(...params).total;
      const rows = db.prepare(`SELECT * FROM shows${where}
        ORDER BY CASE WHEN LOWER(name) = ? THEN 0 WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END, num ASC
        LIMIT ? OFFSET ?`).all(...params, query, query + '%', limit, (page - 1) * limit);
      return json({ shows: rows.map(rowToShow), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, query: rawSearch });
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
    if (pathname === '/api/users' && method === 'GET') {
      const { user, ok, status, error } = requireRole(req, ['admin']);
      if (!ok) return json({ error }, status);
      const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
      return json({ users: rows.map(publicUser) });
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
      if (password.length < 4) return json({ error: 'رمز باید حداقل ۴ کاراکتر باشد' }, 400);
      const exists = getUserByUsername(username);
      if (exists) return json({ error: 'این نام کاربری قبلاً ثبت شده است' }, 409);
      try {
        const r = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
          .run(username, sha256(password), role, name);
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
          if (String(body.password).length < 4) return json({ error: 'رمز باید حداقل ۴ کاراکتر باشد' }, 400);
          db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ? WHERE id = ?')
            .run(sha256(String(body.password)), role, name, id);
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
