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

const PORT = parseInt(process.env.PORT || '3002', 10);

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
db.exec('PRAGMA recursive_triggers = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',
    name          TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT 0,
    last_seen     INTEGER NOT NULL DEFAULT 0,
    job_title     TEXT NOT NULL DEFAULT '',
    avatar        TEXT NOT NULL DEFAULT '',
    deputy        TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    must_change_password INTEGER NOT NULL DEFAULT 0
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
// Migrate old sessions table columns (created_at → created, expires_at → expires)
// Atomic, fail-safe migration: retain the old table unless copy and validation succeed.
{
  const sessionCols = db.prepare('PRAGMA table_info(sessions)').all();
  const names = new Set(sessionCols.map(c => c.name));
  const hasLegacyColumns = names.has('created_at') || names.has('expires_at');
  const hasCurrentColumns = names.has('created') && names.has('expires');
  if (sessionCols.length && hasLegacyColumns && !hasCurrentColumns) {
    if (!names.has('token') || !names.has('user_id')) throw new Error('[migration] sessions table lacks token/user_id; refusing destructive migration');
    const createdExpr = names.has('created_at') ? 'created_at' : '0';
    const expiresExpr = names.has('expires_at') ? 'expires_at' : '0';
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DROP TABLE IF EXISTS sessions_new');
      db.exec('CREATE TABLE sessions_new (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))');
      db.exec(`INSERT INTO sessions_new (token, user_id, created, expires) SELECT token, user_id, ${createdExpr}, ${expiresExpr} FROM sessions`);
      const oldCount = db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count;
      const newCount = db.prepare('SELECT COUNT(*) AS count FROM sessions_new').get().count;
      if (oldCount !== newCount) throw new Error(`session migration row count mismatch: ${oldCount} -> ${newCount}`);
      db.exec('DROP TABLE sessions');
      db.exec('ALTER TABLE sessions_new RENAME TO sessions');
      db.exec('COMMIT');
      console.log(`[migration] migrated ${newCount} sessions atomically`);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
}

addColumnIfMissing('users', 'name', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'last_seen', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'job_title', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'avatar', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'deputy', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'phone', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('users', 'created_at', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('users', 'is_super_admin', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'permissions', "TEXT NOT NULL DEFAULT ''");

// Activity log table — records who did what, when.
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    username      TEXT NOT NULL DEFAULT '',
    action        TEXT NOT NULL,
    target_type   TEXT NOT NULL DEFAULT '',
    target_id     TEXT NOT NULL DEFAULT '',
    details       TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT 0
  );
`);
addColumnIfMissing('shows', 'image_data', 'BLOB');
addColumnIfMissing('shows', 'image_mime', "TEXT NOT NULL DEFAULT 'image/jpeg'");
addColumnIfMissing('shows', 'image_source', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('shows', 'is_film', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('shows', 'tags', "TEXT NOT NULL DEFAULT '[]'");

// Full-text search index for the archive. Triggers keep it in sync with show edits.
let showsFtsAvailable = false;
try {
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
  showsFtsAvailable = true;
} catch (error) {
  console.warn('[search] FTS5 unavailable; using SQL fallback:', error.message);
}


// ---------------------------------------------------------------------------
// CORS — allow any localhost/127.0.0.1 port + space-z.ai preview gateway
// ---------------------------------------------------------------------------
function isAllowedOrigin(origin) {
  if (!origin) return false;
  // Check env-based additional origins
  const extraOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (extraOrigins.includes(origin)) return true;
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
  const perms = getUserPermissions(u);
  const base = {
    id: u.id, username: u.username, role: u.role, name: u.name,
    createdAt: u.created_at, lastSeen: u.last_seen,
    online: u.last_seen && (nowSec() - u.last_seen) < 120,
    jobTitle: u.job_title || '', deputy: u.deputy || '', avatar: u.avatar || '',
    mustChangePassword: !!u.must_change_password,
    isActive: !u.is_active ? false : true,
    isSuperAdmin: !!u.is_super_admin,
    permissions: Array.from(perms),
  };
  // Phone visible only to admins (or self)
  if (viewer && (viewer.role === 'admin' || viewer.id === u.id)) base.phone = u.phone || '';
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
  'youtube', 'imdb', 'wikipedia', 'socialPost', 'images', 'videos', 'tags',
  'is_film',
];
function showToValues(s) {
  return [
    s.num, s.name || '', s.category || '', s.source || '', s.size || '', s.viewers || '',
    s.style || '', s.effects || '', s.layout || '', s.elements || '', s.materials || '',
    s.colors || '', s.lighting || '', s.summary || '', s.descriptionFa || '',
    s.youtube || '', s.imdb || '', s.wikipedia || '', s.socialPost || '',
    JSON.stringify(Array.isArray(s.images) ? s.images : []),
    JSON.stringify(Array.isArray(s.videos) ? s.videos : []),
    JSON.stringify(Array.isArray(s.tags) ? s.tags : []),
    s.isFilm ? 1 : 0,
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

// === Activity Log — records who did what, when ===
function logActivity(user, action, targetType, targetId, details) {
  try {
    db.prepare('INSERT INTO activity_log (user_id, username, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(user.id, user.username, action, targetType, String(targetId || ''), String(details || ''), nowSec());
  } catch(e) { /* non-critical */ }
}

// === Permission helpers ===
function isSuperAdmin(user) {
  return user && !!user.is_super_admin;
}

// All permission keys and their default roles (what each role CAN do by default).
const ALL_PERMISSIONS = {
  manage_users:     ['admin'],           // create/list/update/delete users
  create_admins:    ['admin'],           // create new admin-role users
  suspend_users:    ['admin'],           // suspend/activate users
  add_shows:        ['admin', 'editor'], // add new programs
  edit_shows:       ['admin', 'editor'], // edit existing programs
  delete_shows:     ['admin'],           // delete programs
  manage_genres:    ['admin'],           // add/edit/delete custom genres
  manage_settings:  ['admin'],           // change server URL, report settings
  view_activity:    ['admin'],           // view activity log
  export_reports:   ['admin', 'editor'], // export PDF/Excel
};

// Parse a user's permissions string into a Set of granted permissions.
// Super admins have ALL permissions.
// Regular admins have ALL permissions by default UNLESS the super admin has
// explicitly set a custom permissions string (non-empty) — in which case
// only the stored permissions are granted.
// Editors have: add_shows, edit_shows, export_reports.
// Viewers have: none.
function getUserPermissions(user) {
  if (!user) return new Set();
  if (isSuperAdmin(user)) return new Set(Object.keys(ALL_PERMISSIONS));
  
  // If user has a custom permissions string stored, use ONLY those.
  const storedPerms = (user.permissions || '').trim();
  if (storedPerms === 'NONE') {
    // Explicitly revoked all permissions
    return new Set();
  }
  if (storedPerms) {
    return new Set(storedPerms.split(',').filter(p => ALL_PERMISSIONS[p]));
  }
  
  // No custom permissions — use role-based defaults.
  if (user.role === 'admin') return new Set(Object.keys(ALL_PERMISSIONS));
  if (user.role === 'editor') return new Set(['add_shows', 'edit_shows', 'export_reports']);
  return new Set();
}

// Check if a user has a specific permission.
function hasPermission(user, perm) {
  return getUserPermissions(user).has(perm);
}

// Require a specific permission (not just a role).
function requirePermission(req, perm) {
  const user = requireUser(req);
  if (!user || user.must_change_password) return null;
  if (!hasPermission(user, perm)) return null;
  return user;
}

// Distinguish missing/invalid authentication (401) from insufficient privilege (403).
function permissionFailure(req, message = 'Forbidden') {
  const user = requireUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);
  if (user.must_change_password) return json({ error: 'Password change required' }, 403, req);
  return json({ error: message }, 403, req);
}

function requireUser(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const user = getUserByToken(token);
  // Block suspended/inactive users from all API access
  if (user && user.is_active === 0) return null;
  return user;
}
function requireRole(req, roles) {
  const user = requireUser(req);
  if (!user || user.must_change_password || !roles.includes(user.role)) return null;
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
    db.prepare('INSERT INTO users (username, password_hash, role, name, must_change_password) VALUES (?, ?, ?, ?, 1)')
      .run('admin', sha256('admin'), 'admin', 'مدیر سیستم');
    console.log('[seed] created default admin; password change is required at first login');
  } else {
    db.prepare('UPDATE users SET must_change_password = 1 WHERE username = ? AND password_hash = ?')
      .run('admin', sha256('admin'));
  }
}

function seedShows() {
  const candidates = [
    process.env.BANKRESANEH_SEED_PATH,
    resolve(import.meta.dir, 'talk-shows-data.json'),
    resolve(import.meta.dir, '../../public/talk-shows-data.json'),
    resolve(import.meta.dir, '../../../public/talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'api-service', 'talk-shows-data.json'),
    resolve(process.resourcesPath || '', 'next-service-dist', 'public', 'talk-shows-data.json'),
  ].filter(Boolean);
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
       youtube, imdb, wikipedia, socialPost, images, videos, tags, is_film)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// Mark the first user (id=1) as super admin — cannot be deleted or demoted.
// Runs AFTER seeding so the row exists. Safe to call on every startup (idempotent).
try {
  db.prepare("UPDATE users SET is_super_admin = 1, role = 'admin' WHERE id = 1").run();
} catch(e) { console.warn('[seed] failed to mark super admin:', e.message); }

// ---------------------------------------------------------------------------
// Bun server
// ---------------------------------------------------------------------------
const server = Bun.serve({
  port: PORT,
  hostname: process.env.BANKRESANEH_HOST || '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') return corsOptions(req);

    // Private readiness handshake: prevents mistaking another local service for this API.
    if (pathname === '/api/internal/ready' && method === 'GET') {
      if (!process.env.BANKRESANEH_STARTUP_TOKEN || req.headers.get('x-bankresaneh-startup-token') !== process.env.BANKRESANEH_STARTUP_TOKEN) {
        return json({ error: 'Not Found' }, 404, req);
      }
      return json({ status: 'ready' }, req);
    }

    // ----- Health -----
    if (pathname === '/api/health' && method === 'GET') {
      const showsCount = db.prepare('SELECT COUNT(*) AS count FROM shows').get()?.count || 0;
      return json({ status: 'ok', time: nowSec(), showsCount }, req);
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

    // ----- Fetch image from Wikipedia ONLY (exact show decor photos) -----
    // Per user requirement: do NOT use IMDb/OMDb (returns movie posters, not decor).
    // Search Wikipedia for the EXACT show name, prefer TV series/program pages,
    // and only accept images from wikimedia.org (Wikipedia's official image host).
    if (pathname === '/api/fetch-image' && method === 'POST') {
      const authUser = requirePermission(req, 'edit_shows');
      if (!authUser) return permissionFailure(req, 'شما اجازه ویرایش برنامه‌ها را ندارید');
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const num = parseInt(body?.num, 10);
      const wikiUrl = String(body?.wikipedia || '');
      const showName = String(body?.name || '');
      if (!Number.isFinite(num) || num < 1) return json({ error: 'invalid show number' }, 400, req);
      if (!showName && !wikiUrl) return json({ error: 'show name or wikipedia URL required' }, 400, req);

      const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';
      async function fetchRetry(url, opts = {}, retries = 2) {
        for (let i = 0; i <= retries; i++) {
          try { const r = await fetch(url, opts); if (r.ok) return r; if (r.status === 429) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; } if (r.status === 404) return r; }
          catch(e) { if (i === retries) throw e; await new Promise(x=>setTimeout(x,1500)); }
        }
        return null;
      }
      // Normalize the search query: strip parenthetical disambiguators, collapse spaces.
      function cleanQ(s) { return (s||'').replace(/[?!]+$/,'').replace(/\(.*?\)/g,' ').replace(/[\u2013\u2014-]/g,' ').replace(/\s+/g,' ').trim(); }

      let imageUrl = null, source = '';

      // Step 1: If the user supplied a Wikipedia URL, use it directly (most accurate).
      if (wikiUrl) {
        // Extract the page title from the URL: /wiki/Page_Title or ?search=...
        let pageTitle = '';
        try {
          const u = new URL(wikiUrl);
          if (u.pathname.startsWith('/wiki/')) {
            pageTitle = decodeURIComponent(u.pathname.slice('/wiki/'.length).replace(/_/g, ' '));
          } else if (u.searchParams.get('search')) {
            pageTitle = u.searchParams.get('search');
          }
        } catch {}
        if (pageTitle) {
          // Try both en and fa Wikipedia REST API for the exact page summary
          for (const lang of ['fa','en']) {
            const r = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`, { headers: { 'User-Agent': UA } }, 1);
            if (r && r.ok) {
              const d = await r.json();
              const img = d.originalimage?.source || d.thumbnail?.source;
              // Only accept images hosted on Wikimedia (Wikipedia's official image CDN).
              if (img && (img.includes('wikimedia.org') || img.includes('upload.wikimedia.org'))) {
                imageUrl = img; source = `wikipedia-url-${lang}`;
                break;
              }
            }
          }
        }
      }

      // Step 2: If no URL (or URL didn't yield an image), search by show name with
      // disambiguation suffixes commonly used for TV programs. Wikipedia-only.
      if (!imageUrl && showName) {
        const q = cleanQ(showName);
        if (q) {
          for (const lang of ['fa','en']) {
            // Try common TV-program disambiguators first, then plain name as last resort.
            for (const suffix of [' (برنامه تلویزیونی)',' (مجموعه تلویزیونی)',' (TV series)',' (TV program)',' (TV show)',' (talk show)',' (film)','']) {
              const r = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q + suffix)}`, { headers: { 'User-Agent': UA } }, 1);
              if (r && r.ok) {
                const d = await r.json();
                const img = d.originalimage?.source || d.thumbnail?.source;
                if (img && (img.includes('wikimedia.org') || img.includes('upload.wikimedia.org'))) {
                  imageUrl = img; source = `wikipedia-${lang}`;
                  break;
                }
              }
            }
            if (imageUrl) break;
          }

          // Step 3: If REST summary didn't match, fall back to Wikipedia's search API.
          // This handles cases where the exact page title differs from the show name.
          if (!imageUrl) {
            for (const lang of ['fa','en']) {
              const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q + ' TV')}&format=json&srlimit=5`;
              const r = await fetchRetry(searchUrl, { headers: { 'User-Agent': UA } }, 1);
              if (r && r.ok) {
                const d = await r.json();
                if (d.query?.search) {
                  for (const item of d.query.search) {
                    const title = item.title;
                    const r2 = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { 'User-Agent': UA } }, 1);
                    if (r2 && r2.ok) {
                      const d2 = await r2.json();
                      const img = d2.originalimage?.source || d2.thumbnail?.source;
                      if (img && (img.includes('wikimedia.org') || img.includes('upload.wikimedia.org'))) {
                        imageUrl = img; source = `wikipedia-search-${lang}`;
                        break;
                      }
                    }
                  }
                }
              }
              if (imageUrl) break;
            }
          }
        }
      }

      if (!imageUrl) return json({ error: 'no Wikipedia image found for this show' }, 404, req);

      // Download the image (Wikimedia requires a User-Agent).
      const ires = await fetchRetry(imageUrl, { headers: { 'User-Agent': UA } }, 3);
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
      if (!user || !verifyPassword(password, user.password_hash) || user.is_active === 0) {
        // Suspended accounts must never receive a new session; do not disclose status.
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
      if (newPassword.length < 8) return json({ error: 'رمز جدید باید حداقل ۸ کاراکتر باشد' }, 400, req);
      if (!verifyPassword(oldPassword, user.password_hash)) return json({ error: 'رمز فعلی نادرست است' }, 401, req);
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(newPassword), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return json({ success: true }, req);
    }

    // ----- Persian full-text archive search with bounded pagination -----
    if (pathname === '/api/shows/search' && method === 'GET') {
      const user = requireRole(req, ['admin', 'editor', 'viewer']);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);

      const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase()
        .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
        .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u200c\u200d\uFEFF]/g, ' ')
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
      const query = normalize(url.searchParams.get('q') || url.searchParams.get('search') || '');
      const category = normalize(url.searchParams.get('category') || '');
      const page = Math.max(1, Math.min(1000000, parseInt(url.searchParams.get('page') || '1', 10) || 1));
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '30', 10) || 30));
      const terms = query.split(' ').filter(Boolean).slice(0, 8);
      const offset = (page - 1) * limit;
      const categorySql = category ? ' AND LOWER(shows.category) LIKE ?' : '';
      const categoryParams = category ? ['%' + category + '%'] : [];
      let total = 0;
      let rows = [];

      if (terms.length && showsFtsAvailable) {
        const match = terms.map(term => '"' + term.replace(/"/g, '""') + '"*').join(' AND ');
        try {
          total = db.prepare(`SELECT COUNT(*) AS total FROM shows_fts JOIN shows ON shows.num = shows_fts.rowid WHERE shows_fts MATCH ?${categorySql}`).get(match, ...categoryParams).total;
          rows = db.prepare(`SELECT shows.* FROM shows_fts JOIN shows ON shows.num = shows_fts.rowid
            WHERE shows_fts MATCH ?${categorySql}
            ORDER BY bm25(shows_fts, 12, 8, 6, 5, 3, 3, 3, 3, 3, 2, 2, 2),
              CASE WHEN LOWER(shows.name) = ? THEN 0 WHEN LOWER(shows.name) LIKE ? THEN 1 ELSE 2 END,
              shows.num ASC LIMIT ? OFFSET ?`).all(match, ...categoryParams, query, query + '%', limit, offset);
        } catch (error) {
          console.warn('[search] FTS query failed; using SQL fallback:', error.message);
        }
      }

      if (!terms.length || !showsFtsAvailable || (terms.length && rows.length === 0 && total === 0)) {
        const conditions = [];
        const params = [];
        for (const term of terms) {
          const pattern = '%' + term + '%';
          conditions.push('(name LIKE ? OR category LIKE ? OR summary LIKE ? OR descriptionFa LIKE ? OR source LIKE ? OR style LIKE ? OR effects LIKE ? OR layout LIKE ? OR elements LIKE ? OR materials LIKE ? OR colors LIKE ? OR lighting LIKE ?)');
          params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
        }
        if (category) { conditions.push('LOWER(category) LIKE ?'); params.push('%' + category + '%'); }
        const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
        total = db.prepare('SELECT COUNT(*) AS total FROM shows' + where).get(...params).total;
        rows = db.prepare(`SELECT * FROM shows${where}
          ORDER BY CASE WHEN LOWER(name) = ? THEN 0 WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END, num ASC
          LIMIT ? OFFSET ?`).all(...params, query, query + '%', limit, offset);
      }

      return json({
        shows: rows.map(rowToShow),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        query,
      }, req);
    }

    // ----- Shows: list -----
    if (pathname === '/api/shows' && method === 'GET') {
      const user = requireRole(req, ['admin', 'editor', 'viewer']);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      const rows = db.prepare('SELECT * FROM shows ORDER BY num').all();
      return json({ shows: rows.map(rowToShow) }, req);
    }

    // ----- Shows: create -----
    if (pathname === '/api/shows' && method === 'POST') {
      const user = requirePermission(req, 'add_shows');
      if (!user) return permissionFailure(req, 'شما اجازه افزودن برنامه را ندارید');
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      if (!body.num) {
        const max = db.prepare('SELECT MAX(num) AS m FROM shows').get();
        body.num = (max?.m || 0) + 1;
      }
      db.prepare(`INSERT OR REPLACE INTO shows (${SHOW_COLUMNS.join(', ')}) VALUES (${SHOW_COLUMNS.map(() => '?').join(', ')})`).run(...showToValues(body));
      logActivity(user, 'create_show', 'show', body.num, `Created show "${body.name}"`);
      return json(rowToShow(db.prepare('SELECT * FROM shows WHERE num = ?').get(body.num)), req);
    }

    // ----- Shows: update -----
    if (pathname.startsWith('/api/shows/') && method === 'PUT') {
      const user = requirePermission(req, 'edit_shows');
      if (!user) return permissionFailure(req, 'شما اجازه ویرایش برنامه را ندارید');
      const num = parseInt(pathname.slice('/api/shows/'.length));
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      body.num = num;
      const existing = db.prepare('SELECT * FROM shows WHERE num = ?').get(num);
      if (!existing) return json({ error: 'show not found' }, 404, req);
      const merged = { ...rowToShow(existing), ...body, num };
      db.prepare(`INSERT OR REPLACE INTO shows (${SHOW_COLUMNS.join(', ')}) VALUES (${SHOW_COLUMNS.map(() => '?').join(', ')})`).run(...showToValues(merged));
      logActivity(user, 'update_show', 'show', num, `Updated show "${merged.name}"`);
      return json(rowToShow(db.prepare('SELECT * FROM shows WHERE num = ?').get(num)), req);
    }

    // ----- Shows: delete -----
    if (pathname.startsWith('/api/shows') && method === 'DELETE') {
      const user = requirePermission(req, 'delete_shows');
      if (!user) return permissionFailure(req, 'شما اجازه حذف برنامه را ندارید');
      const num = parseInt(url.searchParams.get('num') || '0');
      if (!num) return json({ error: 'num required' }, 400, req);
      const show = db.prepare('SELECT name FROM shows WHERE num = ?').get(num);
      db.prepare('DELETE FROM shows WHERE num = ?').run(num);
      logActivity(user, 'delete_show', 'show', num, `Deleted show "${show?.name || num}"`);
      return json({ success: true }, req);
    }

    // ----- Users: list -----
    if (pathname === '/api/users' && method === 'GET') {
      const user = requirePermission(req, 'manage_users');
      if (!user) return permissionFailure(req, 'شما اجازه مدیریت کاربران را ندارید');
      const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
      return json({ users: rows.map(u => publicUser(u, user)) }, req);
    }

    // ----- Users: create -----
    if (pathname === '/api/users' && method === 'POST') {
      const admin = requirePermission(req, 'manage_users');
      if (!admin) return permissionFailure(req, 'شما اجازه مدیریت کاربران را ندارید');
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      // Creating an admin requires the create_admins permission
      const role = ['admin', 'editor', 'viewer'].includes(body.role) ? body.role : 'viewer';
      if (role === 'admin' && !hasPermission(admin, 'create_admins')) {
        return json({ error: 'شما اجازه ساخت مدیر جدید ندارید' }, 403, req);
      }
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) return json({ error: 'نام کاربری و رمز عبور را وارد کنید' }, 400, req);
      if (password.length < 8) return json({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }, 400, req);
      const existing = getUserByUsername(username);
      if (existing) return json({ error: 'نام کاربری تکراری' }, 409, req);
      const result = db.prepare('INSERT INTO users (username, password_hash, role, name, job_title, deputy, phone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        username, hashPassword(password), role, body.name || '', body.jobTitle || '', body.deputy || '', body.phone || ''
      );
      logActivity(admin, 'create_user', 'user', result.lastInsertRowid, `Created user "${username}" with role "${role}"`);
      return json(publicUser(getUserById(result.lastInsertRowid), admin), req);
    }

    // ----- Users: update -----
    if (pathname.startsWith('/api/users') && method === 'PUT') {
      const admin = requirePermission(req, 'manage_users');
      if (!admin) return permissionFailure(req, 'شما اجازه مدیریت کاربران را ندارید');
      const id = parseInt(url.searchParams.get('id') || '0');
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const target = getUserById(id);
      if (!target) return json({ error: 'user not found' }, 404, req);

      // Super admin protection: cannot demote or suspend super admin
      if (isSuperAdmin(target) && body.role && body.role !== 'admin') {
        return json({ error: 'مدیر اصلی قابل تنزل سطح دسترسی نیست' }, 403, req);
      }
      if (isSuperAdmin(target) && body.isActive === false) {
        return json({ error: 'مدیر اصلی قابل تعلیق نیست' }, 403, req);
      }

      // If upgrading a user TO admin role, check create_admins permission
      if (body.role === 'admin' && target.role !== 'admin') {
        if (!hasPermission(admin, 'create_admins')) {
          return json({ error: 'شما اجازه ارتقا به مدیر را ندارید' }, 403, req);
        }
      }

      // If suspending/activating a user, check suspend_users permission
      if (body.isActive !== undefined && body.isActive !== !!target.is_active) {
        if (!hasPermission(admin, 'suspend_users')) {
          return json({ error: 'شما اجازه تعلیق کاربران را ندارید' }, 403, req);
        }
      }

      // SECURITY: Only super admin can change permissions
      // Regular admins CANNOT modify permissions (theirs or anyone else's)
      let newPerms = target.permissions || '';
      if (Array.isArray(body.permissions)) {
        if (!isSuperAdmin(admin)) {
          return json({ error: 'تنها مدیر اصلی می‌تواند اختیارات را تغییر دهد' }, 403, req);
        }
        // Super admin can set any permissions (including empty = revoke all)
        newPerms = body.permissions.filter(p => ALL_PERMISSIONS[p]).join(',');
        if (newPerms === '') {
          newPerms = 'NONE'; // Special marker: explicitly no permissions
        }
        logActivity(admin, 'update_permissions', 'user', id, `Changed permissions for "${target.username}" to: ${newPerms}`);
      }

      // SECURITY: Only super admin can change another admin's role
      // Regular admins can only change role for non-admin users (e.g. viewer→editor)
      if (body.role && body.role !== target.role) {
        if (target.role === 'admin' && !isSuperAdmin(admin)) {
          return json({ error: 'تنها مدیر اصلی می‌تواند نقش مدیران را تغییر دهد' }, 403, req);
        }
      }

      // Update name, role, isActive, and permissions
      const newRole = body.role || target.role;
      const newName = body.name ?? target.name;
      const newActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : target.is_active;
      db.prepare('UPDATE users SET name = ?, role = ?, is_active = ?, permissions = ? WHERE id = ?').run(newName, newRole, newActive, newPerms, id);
      logActivity(admin, 'update_user', 'user', id, `Updated user "${target.username}": role=${newRole}, active=${newActive}`);
      return json(publicUser(getUserById(id), admin), req);
    }

    // ----- Users: delete -----
    if (pathname.startsWith('/api/users') && method === 'DELETE') {
      const admin = requirePermission(req, 'manage_users');
      if (!admin) return permissionFailure(req, 'شما اجازه مدیریت کاربران را ندارید');
      const id = parseInt(url.searchParams.get('id') || '0');
      // Cannot delete self
      if (id === admin.id) return json({ error: 'نمی‌توانید حساب خودتان را حذف کنید' }, 400, req);
      // Cannot delete super admin
      const target = getUserById(id);
      if (!target) return json({ error: 'کاربر یافت نشد' }, 404, req);
      if (isSuperAdmin(target)) return json({ error: 'مدیر اصلی قابل حذف نیست' }, 403, req);
      // Destroy all sessions of the deleted user
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      logActivity(admin, 'delete_user', 'user', id, `Deleted user "${target.username}"`);
      return json({ success: true }, req);
    }

    // ----- Activity log -----
    if (pathname === '/api/activity' && method === 'GET') {
      const admin = requirePermission(req, 'view_activity');
      if (!admin) return permissionFailure(req, 'شما اجازه مشاهده گزارش فعالیت را ندارید');
      const requestedLimit = parseInt(url.searchParams.get('limit') || '50', 10);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 50;
      const logs = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?').all(limit);
      return json({ logs }, req);
    }

    // ----- Permissions list -----
    if (pathname === '/api/permissions' && method === 'GET') {
      const admin = requirePermission(req, 'manage_users');
      if (!admin) return permissionFailure(req, 'شما اجازه مشاهده اختیارات را ندارید');
      return json({ permissions: Object.keys(ALL_PERMISSIONS) }, req);
    }

    // ----- Analytics: track a user action (view_show, export_pdf, publish_show) -----
    // Any authenticated user can track their own actions for analytics.
    if (pathname === '/api/analytics/track' && method === 'POST') {
      const user = requireUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401, req);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'invalid body' }, 400, req); }
      const action = String(body?.action || '').trim();
      const targetType = String(body?.targetType || 'show').trim();
      const targetId = String(body?.targetId || '').trim();
      const details = String(body?.details || '').trim();
      const validActions = ['view_show', 'export_pdf', 'export_excel', 'publish_show', 'open_show_details'];
      if (!validActions.includes(action)) {
        return json({ error: 'invalid action' }, 400, req);
      }
      logActivity(user, action, targetType, targetId, details);
      return json({ success: true }, req);
    }

    // ----- Analytics: comprehensive report for the Reports tab in Settings -----
    if (pathname === '/api/analytics/report' && method === 'GET') {
      const user = requirePermission(req, 'export_reports');
      if (!user) return permissionFailure(req, 'شما اجازه دریافت گزارش‌ها را ندارید');

      // Time window: default 30 days
      const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 365);
      const since = nowSec() - days * 86400;

      // 1. Daily active users (last N days) — count DISTINCT users per day from activity_log
      const dailyActive = db.prepare(`
        SELECT date(created_at, 'unixepoch') AS day, COUNT(DISTINCT user_id) AS users
        FROM activity_log
        WHERE created_at >= ? AND user_id > 0
        GROUP BY day ORDER BY day ASC
      `).all(since);

      // 2. Total views, exports, publishes in the window
      const totals = db.prepare(`
        SELECT
          SUM(CASE WHEN action = 'view_show' THEN 1 ELSE 0 END) AS views,
          SUM(CASE WHEN action = 'export_pdf' THEN 1 ELSE 0 END) AS pdfExports,
          SUM(CASE WHEN action = 'export_excel' THEN 1 ELSE 0 END) AS excelExports,
          SUM(CASE WHEN action = 'publish_show' THEN 1 ELSE 0 END) AS publishes
        FROM activity_log WHERE created_at >= ?
      `).get(since);

      // 3. Most-viewed shows (top 10) in the window
      const topShows = db.prepare(`
        SELECT target_id AS num, COUNT(*) AS views
        FROM activity_log
        WHERE action = 'view_show' AND created_at >= ? AND target_id != ''
        GROUP BY target_id ORDER BY views DESC LIMIT 10
      `).all(since);

      // 4. Most-exported shows (PDF) in the window
      const topExports = db.prepare(`
        SELECT target_id AS num, COUNT(*) AS exports
        FROM activity_log
        WHERE action IN ('export_pdf', 'export_excel') AND created_at >= ? AND target_id != ''
        GROUP BY target_id ORDER BY exports DESC LIMIT 10
      `).all(since);

      // 5. Incomplete programs — shows missing critical fields
      // Critical fields: name, summary, descriptionFa, materials, style, colors
      const allShows = db.prepare(`
        SELECT num, name, summary, descriptionFa, materials, style, colors, layout, elements, lighting
        FROM shows
      `).all();
      const incomplete = [];
      for (const s of allShows) {
        const missing = [];
        if (!s.name || s.name.trim() === '') missing.push('name');
        if (!s.summary || s.summary.trim() === '') missing.push('summary');
        if (!s.descriptionFa || s.descriptionFa.trim() === '') missing.push('descriptionFa');
        if (!s.materials || s.materials.trim() === '') missing.push('materials');
        if (!s.style || s.style.trim() === '') missing.push('style');
        if (!s.colors || s.colors.trim() === '') missing.push('colors');
        if (!s.layout || s.layout.trim() === '') missing.push('layout');
        if (missing.length > 0) incomplete.push({ num: s.num, name: s.name, missing });
      }

      // 6. Online users right now (active in last 2 minutes from sessions + last_seen)
      const onlineUsers = db.prepare(`
        SELECT id, username, name, role, last_seen
        FROM users
        WHERE is_active = 1 AND last_seen > ?
        ORDER BY last_seen DESC
      `).all(nowSec() - 120);

      return json({
        windowDays: days,
        dailyActive,
        totals: {
          views: totals?.views || 0,
          pdfExports: totals?.pdfExports || 0,
          excelExports: totals?.excelExports || 0,
          publishes: totals?.publishes || 0,
        },
        topShows,
        topExports,
        incompletePrograms: incomplete,
        incompleteCount: incomplete.length,
        totalShows: allShows.length,
        onlineUsers: onlineUsers.map(u => ({
          id: u.id, username: u.username, name: u.name, role: u.role,
          lastSeenSecondsAgo: nowSec() - (u.last_seen || 0),
        })),
        onlineCount: onlineUsers.length,
      }, req);
    }

    return json({ error: 'Not Found', path: pathname }, 404, req);
  },
});

console.log(`[bankresaneh-api] listening on http://localhost:${PORT}`);
