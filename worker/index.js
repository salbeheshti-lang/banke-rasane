/**
 * BankResaneh API — Cloudflare Worker
 * Multi-user authentication + D1 database
 */

// Authentication uses database-backed opaque session tokens; no JWT secret is needed here.

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
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      ...corsHeaders,
    },
  });
}

// Helper: Hash password with PBKDF2
function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

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

async function hashRateKey(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function recordFailedLogin(env, key, now) {
  const current = await env.DB.prepare(
    'SELECT window_start, attempt_count FROM auth_login_attempts WHERE attempt_key = ?'
  ).bind(key).first();

  if (!current || current.window_start <= now - 900) {
    await env.DB.prepare(
      'INSERT INTO auth_login_attempts (attempt_key, window_start, attempt_count) VALUES (?, ?, 1) ON CONFLICT(attempt_key) DO UPDATE SET window_start = excluded.window_start, attempt_count = 1'
    ).bind(key, now).run();
    return;
  }

  await env.DB.prepare(
    'UPDATE auth_login_attempts SET attempt_count = attempt_count + 1 WHERE attempt_key = ?'
  ).bind(key).run();
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
    const origin = request.headers.get('Origin');
    const configuredOrigins = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const originIsAllowed = configuredOrigins.length === 0 || configuredOrigins.includes(origin || '');
    const corsHeaders = {
      ...(configuredOrigins.length === 0
        ? { 'Access-Control-Allow-Origin': '*' }
        : (origin && originIsAllowed ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {})),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    // Use request-scoped headers so deployments can configure an explicit origin allowlist.
    const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        ...corsHeaders,
      },
    });

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    try {
      // ===== AUTH ROUTES (no auth required) =====

      // POST /api/auth/login — Login
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json();
        const username = typeof body?.username === 'string' ? body.username.trim() : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        if (!username || !password || username.length > 128 || password.length > 1024) {
          return jsonResponse({ error: 'نام کاربری و رمز عبور معتبر الزامی است' }, 400);
        }

        const now = Math.floor(Date.now() / 1000);
        // Cleanup old rows to keep the shared rate-limit table bounded.
        await env.DB.prepare('DELETE FROM auth_login_attempts WHERE window_start < ?').bind(now - 86400).run();

        // Include the edge-provided client IP and normalized username, but only
        // persist a one-way digest rather than raw identifiers.
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        const attemptKey = await hashRateKey(clientIp + '\n' + username.toLocaleLowerCase('en-US'));
        const attempt = await env.DB.prepare(
          'SELECT window_start, attempt_count FROM auth_login_attempts WHERE attempt_key = ?'
        ).bind(attemptKey).first();

        if (attempt && attempt.window_start > now - 900 && attempt.attempt_count >= 8) {
          return jsonResponse({ error: 'تعداد تلاش‌های ورود بیش از حد مجاز است؛ ۱۵ دقیقه دیگر تلاش کنید' }, 429);
        }

        const user = await env.DB.prepare(
          'SELECT * FROM users WHERE username = ?'
        ).bind(username).first();

        if (!user) {
          await recordFailedLogin(env, attemptKey, now);
          return jsonResponse({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401);
        }

        const hash = await hashPassword(password, user.salt);
        if (!constantTimeEqual(hash, user.password_hash)) {
          await recordFailedLogin(env, attemptKey, now);
          return jsonResponse({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401);
        }

        await env.DB.prepare('DELETE FROM auth_login_attempts WHERE attempt_key = ?').bind(attemptKey).run();

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
      // Keep internal SQL/runtime details in platform logs, never in API responses.
      console.error('Worker request failed', { path, method, message: error instanceof Error ? error.message : 'unknown error' });
      return jsonResponse({ error: 'خطای سرور' }, 500);
    }
  },
};
