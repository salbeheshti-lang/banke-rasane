/**
 * BankResaneh API — Cloudflare Worker
 * Multi-user authentication + D1 database
 */

const JWT_SECRET = 'bank-resaneh-jwt-secret-2025-very-secure-key-xyz';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper: JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper: Hash password with PBKDF2
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-512',
    },
    keyMaterial,
    512
  );
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Generate random token
function generateToken() {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Verify session token
async function verifySession(env, token) {
  if (!token) return null;
  const result = await env.DB.prepare(
    'SELECT u.id, u.username, u.role, u.name, s.expires_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime(\'now\')'
  ).bind(token).first();
  return result;
}

// Helper: Parse Bearer token from request
function getBearerToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// Helper: Require auth
async function requireAuth(env, request) {
  const token = getBearerToken(request);
  const user = await verifySession(env, token);
  return user;
}

// Helper: Check role
function hasRole(user, ...roles) {
  return user && roles.includes(user.role);
}

// Main handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ===== AUTH ROUTES (no auth required) =====

      // POST /api/auth/login — Login
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
          return jsonResponse({ error: 'نام کاربری و رمز عبور الزامی است' }, 400);
        }

        const user = await env.DB.prepare(
          'SELECT * FROM users WHERE username = ?'
        ).bind(username).first();

        if (!user) {
          return jsonResponse({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401);
        }

        const hash = await hashPassword(password, user.salt);
        if (hash !== user.password_hash) {
          return jsonResponse({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401);
        }

        // Create session (valid for 30 days)
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, user.id, expiresAt).run();

        return jsonResponse({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
          },
        });
      }

      // POST /api/auth/logout — Logout
      if (path === '/api/auth/logout' && method === 'POST') {
        const token = getBearerToken(request);
        if (token) {
          await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        }
        return jsonResponse({ success: true });
      }

      // GET /api/auth/me — Get current user
      if (path === '/api/auth/me' && method === 'GET') {
        const user = await requireAuth(env, request);
        if (!user) return jsonResponse({ error: 'احراز هویت نشده' }, 401);
        return jsonResponse({
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
        });
      }

      // ===== PROTECTED ROUTES (auth required) =====

      const user = await requireAuth(env, request);
      if (!user) {
        return jsonResponse({ error: 'احراز هویت نشده — لطفاً وارد شوید' }, 401);
      }

      // GET /api/shows/search — Persian-normalized search with bounded pagination
      if (path === '/api/shows/search' && method === 'GET') {
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
        const countStmt = env.DB.prepare('SELECT COUNT(*) AS total FROM shows' + where);
        const countResult = params.length ? await countStmt.bind(...params).first() : await countStmt.first();
        const sql = `SELECT * FROM shows${where}
          ORDER BY CASE WHEN LOWER(name) = ? THEN 0 WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END, num ASC
          LIMIT ? OFFSET ?`;
        const stmt = env.DB.prepare(sql);
        const allParams = [...params, query, query + '%', limit, (page - 1) * limit];
        const result = await stmt.bind(...allParams).all();
        const shows = result.results.map(s => ({
          ...s,
          images: s.images ? JSON.parse(s.images) : [],
          videos: s.videos ? JSON.parse(s.videos) : [],
        }));
        const total = countResult?.total || 0;
        return jsonResponse({ shows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, query: rawSearch });
      }

      // GET /api/shows — List all shows (with optional search/filter)
      if (path === '/api/shows' && method === 'GET') {
        const search = url.searchParams.get('search');
        const category = url.searchParams.get('category');
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        let sql = 'SELECT * FROM shows';
        const conditions = [];
        const params = [];

        if (search) {
          conditions.push('(name LIKE ? OR summary LIKE ? OR category LIKE ? OR descriptionFa LIKE ?)');
          const pattern = `%${search}%`;
          params.push(pattern, pattern, pattern, pattern);
        }
        if (category) {
          conditions.push('category LIKE ?');
          params.push(`%${category}%`);
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ` LIMIT ${Math.min(limit, 1000)}`;

        const stmt = env.DB.prepare(sql);
        const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

        // Parse images and videos from JSON
        const shows = result.results.map(s => ({
          ...s,
          images: s.images ? JSON.parse(s.images) : [],
          videos: s.videos ? JSON.parse(s.videos) : [],
        }));

        return jsonResponse({ shows, count: shows.length });
      }

      // GET /api/shows/:num — Get single show
      const showMatch = path.match(/^\/api\/shows\/(\d+)$/);
      if (showMatch && method === 'GET') {
        const num = parseInt(showMatch[1]);
        const show = await env.DB.prepare('SELECT * FROM shows WHERE num = ?').bind(num).first();
        if (!show) return jsonResponse({ error: 'برنامه یافت نشد' }, 404);
        show.images = show.images ? JSON.parse(show.images) : [];
        show.videos = show.videos ? JSON.parse(show.videos) : [];
        return jsonResponse({ show });
      }

      // POST /api/shows — Create new show (admin/editor only)
      if (path === '/api/shows' && method === 'POST') {
        if (!hasRole(user, 'admin', 'editor')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز' }, 403);
        }
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO shows (num, name, category, source, size, viewers, style, effects, layout, elements, materials, colors, lighting, summary, descriptionFa, youtube, imdb, wikipedia, socialPost, images, videos)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.num, body.name || '', body.category || '', body.source || 'متن',
          body.size || 'متوسط/استاندارد', body.viewers || 'بدون تماشاگر',
          body.style || 'مدرن', body.effects || 'ترکیبی', body.layout || 'پنل/میزگرد',
          body.elements || '', body.materials || '', body.colors || '',
          body.lighting || 'خنثی', body.summary || '', body.descriptionFa || '',
          body.youtube || '', body.imdb || '', body.wikipedia || '',
          body.socialPost || '',
          JSON.stringify(body.images || []),
          JSON.stringify(body.videos || [])
        ).run();
        return jsonResponse({ success: true, num: body.num }, 201);
      }

      // PUT /api/shows/:num — Update show (admin/editor only)
      const updateMatch = path.match(/^\/api\/shows\/(\d+)$/);
      if (updateMatch && method === 'PUT') {
        if (!hasRole(user, 'admin', 'editor')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز' }, 403);
        }
        const num = parseInt(updateMatch[1]);
        const body = await request.json();
        await env.DB.prepare(
          `UPDATE shows SET name = ?, category = ?, source = ?, size = ?, viewers = ?, style = ?, effects = ?, layout = ?, elements = ?, materials = ?, colors = ?, lighting = ?, summary = ?, descriptionFa = ?, youtube = ?, imdb = ?, wikipedia = ?, socialPost = ?, images = ?, videos = ?, updated_at = CURRENT_TIMESTAMP WHERE num = ?`
        ).bind(
          body.name || '', body.category || '', body.source || '',
          body.size || '', body.viewers || '', body.style || '',
          body.effects || '', body.layout || '', body.elements || '',
          body.materials || '', body.colors || '', body.lighting || '',
          body.summary || '', body.descriptionFa || '', body.youtube || '',
          body.imdb || '', body.wikipedia || '', body.socialPost || '',
          JSON.stringify(body.images || []),
          JSON.stringify(body.videos || []),
          num
        ).run();
        return jsonResponse({ success: true });
      }

      // DELETE /api/shows/:num — Delete show (admin only)
      const deleteMatch = path.match(/^\/api\/shows\/(\d+)$/);
      if (deleteMatch && method === 'DELETE') {
        if (!hasRole(user, 'admin')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز — فقط مدیر می‌تواند حذف کند' }, 403);
        }
        const num = parseInt(deleteMatch[1]);
        await env.DB.prepare('DELETE FROM shows WHERE num = ?').bind(num).run();
        return jsonResponse({ success: true });
      }

      // ===== USER MANAGEMENT (admin only) =====

      // GET /api/users — List users
      if (path === '/api/users' && method === 'GET') {
        if (!hasRole(user, 'admin')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز' }, 403);
        }
        const result = await env.DB.prepare(
          'SELECT id, username, role, name, created_at FROM users ORDER BY id'
        ).all();
        return jsonResponse({ users: result.results });
      }

      // POST /api/users — Create user (admin only)
      if (path === '/api/users' && method === 'POST') {
        if (!hasRole(user, 'admin')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز' }, 403);
        }
        const body = await request.json();
        const { username, password, role, name } = body;
        if (!username || !password) {
          return jsonResponse({ error: 'نام کاربری و رمز عبور الزامی است' }, 400);
        }
        const salt = generateToken().substring(0, 64);
        const hash = await hashPassword(password, salt);
        try {
          await env.DB.prepare(
            'INSERT INTO users (username, password_hash, salt, role, name) VALUES (?, ?, ?, ?, ?)'
          ).bind(username, hash, salt, role || 'editor', name || '').run();
          return jsonResponse({ success: true }, 201);
        } catch (e) {
          return jsonResponse({ error: 'نام کاربری قبلاً وجود دارد' }, 400);
        }
      }

      // DELETE /api/users/:id — Delete user (admin only)
      const deleteUserMatch = path.match(/^\/api\/users\/(\d+)$/);
      if (deleteUserMatch && method === 'DELETE') {
        if (!hasRole(user, 'admin')) {
          return jsonResponse({ error: 'دسترسی غیرمجاز' }, 403);
        }
        const id = parseInt(deleteUserMatch[1]);
        if (id === user.id) {
          return jsonResponse({ error: 'نمی‌توانید خودتان را حذف کنید' }, 400);
        }
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true });
      }

      // ===== STATS =====
      if (path === '/api/stats' && method === 'GET') {
        const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM shows').first();
        const categoryResult = await env.DB.prepare(
          'SELECT category, COUNT(*) as count FROM shows GROUP BY category ORDER BY count DESC'
        ).all();
        return jsonResponse({
          total: totalResult.count,
          categories: categoryResult.results,
        });
      }

      // 404
      return jsonResponse({ error: 'مسیر یافت نشد', path }, 404);

    } catch (error) {
      return jsonResponse({ error: 'خطای سرور', details: error.message }, 500);
    }
  },
};
