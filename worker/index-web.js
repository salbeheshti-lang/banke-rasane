/**
 * BankResaneh Frontend — Cloudflare Worker
 * Serves the web UI and proxies to the API
 */

const API_BASE = 'https://banke-rasane-api.salbeheshti-lang.workers.dev';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders,
    },
  });
}

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بانک رسانه — ورود</title>
<style>
@import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Vazirmatn', 'Tahoma', sans-serif;
  background: radial-gradient(ellipse 80% 60% at 70% 20%, rgba(2, 144, 72, 0.45) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 25% 80%, rgba(2, 144, 72, 0.4) 0%, transparent 60%), linear-gradient(135deg, #042817 0%, #035932 50%, #042817 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}
.login-card {
  background: rgba(1, 30, 15, 0.85);
  backdrop-filter: blur(28px);
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: 24px;
  padding: 48px 40px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(74, 222, 128, 0.2);
}
.logo {
  text-align: center;
  margin-bottom: 32px;
}
.logo h1 {
  font-size: 28px;
  font-weight: 900;
  color: #4ade80;
  margin-bottom: 8px;
  text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
}
.logo p {
  color: rgba(168, 230, 193, 0.7);
  font-size: 14px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  color: rgba(168, 230, 193, 0.9);
  font-size: 14px;
  font-weight: 600;
}
.form-group input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(74, 222, 128, 0.3);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: all 0.3s;
}
.form-group input:focus {
  border-color: #4ade80;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.15);
}
.btn-login {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #029048 0%, #016035 100%);
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
  box-shadow: 0 8px 24px rgba(2, 144, 72, 0.4);
  margin-top: 8px;
}
.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(2, 144, 72, 0.5);
}
.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.4);
  color: #fca5a5;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 14px;
  display: none;
}
.error.show { display: block; }
.footer {
  text-align: center;
  margin-top: 32px;
  color: rgba(168, 230, 193, 0.5);
  font-size: 12px;
}
</style>
</head>
<body>
<div class="login-card">
  <div class="logo">
    <h1>بانک رسانه</h1>
    <p>آرشیو تخصصی برنامه‌های تلویزیونی</p>
  </div>
  <div class="error" id="error"></div>
  <form id="loginForm">
    <div class="form-group">
      <label>نام کاربری</label>
      <input type="text" id="username" placeholder="نام کاربری" required autocomplete="username">
    </div>
    <div class="form-group">
      <label>رمز عبور</label>
      <input type="password" id="password" placeholder="رمز عبور" required autocomplete="current-password">
    </div>
    <button type="submit" class="btn-login" id="btnLogin">ورود به برنامه</button>
  </form>
  <div class="footer">
    نسخهٔ ابری ۲.۰.۰ • چند کاربره با همگام‌سازی
  </div>
</div>
<script>
const API_BASE = '${API_BASE}';
const errorEl = document.getElementById('error');
const btn = document.getElementById('btnLogin');

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'در حال ورود...';
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
    const resp = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    
    if (data.success || data.token) {
      localStorage.setItem('bankresaneh_token', data.token);
      localStorage.setItem('bankresaneh_user', JSON.stringify(data.user));
      window.location.href = '/?t=' + Date.now();
    } else {
      throw new Error(data.error || 'خطا در ورود');
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'ورود به برنامه';
  }
});

// If already logged in, redirect to dashboard
const token = localStorage.getItem('bankresaneh_token');
if (token) {
  window.location.href = '/?t=' + Date.now();
}
</script>
</body>
</html>`;

const DASHBOARD_PAGE = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بانک رسانه — داشبورد</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Vazirmatn', 'Tahoma', sans-serif;
  background: linear-gradient(180deg, #EEF2F0 0%, #E8EDEB 100%);
  min-height: 100vh;
  color: #1a2e22;
}
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 40;
  background: linear-gradient(180deg, rgba(4, 40, 23, 0.98) 0%, rgba(2, 80, 45, 0.96) 100%);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(74, 222, 128, 0.4);
  padding: 14px 28px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 8px 32px rgba(2, 144, 72, 0.25);
}
.topbar .brand { color: white; font-weight: 700; font-size: 18px; }
.topbar .brand span { color: #4ade80; }
.topbar .user-info {
  display: flex; align-items: center; gap: 12px;
  color: rgba(168, 230, 193, 0.9); font-size: 14px;
}
.topbar .btn-logout {
  padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(220, 38, 38, 0.4);
  background: rgba(220, 38, 38, 0.15); color: #fca5a5; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
}
.main { padding: 80px 28px 28px; max-width: 1400px; margin: 0 auto; }
.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px; margin-bottom: 32px;
}
.stat-card {
  background: white; border-radius: 18px; padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border-top: 4px solid #029048;
}
.stat-card .num { font-size: 36px; font-weight: 900; color: #029048; }
.stat-card .label { color: #4a5d52; font-size: 14px; margin-top: 4px; }
.shows-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.show-card {
  background: white; border-radius: 18px; overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;
}
.show-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.12); }
.show-card .thumb {
  height: 160px; background: linear-gradient(135deg, #029048 0%, #016035 100%);
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 14px; font-weight: 700; padding: 16px; text-align: center;
}
.show-card .body { padding: 16px; }
.show-card .name { font-weight: 700; font-size: 15px; margin-bottom: 6px; direction: ltr; text-align: right; }
.show-card .cat { color: #4a5d52; font-size: 12px; }
.show-card .desc { color: #7a8a80; font-size: 12px; margin-top: 8px; line-height: 1.6; }
.search-bar {
  background: white; border-radius: 16px; padding: 16px; margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}
.search-bar input {
  width: 100%; padding: 12px 16px; border-radius: 12px;
  border: 1px solid #e0e8e4; font-family: inherit; font-size: 14px; outline: none;
}
.search-bar input:focus { border-color: #029048; }
.loading { text-align: center; padding: 60px; color: #7a8a80; }
</style>
</head>
<body>
<div class="topbar">
  <div class="brand">بانک <span>رسانه</span></div>
  <div class="user-info">
    <span id="userName"></span>
    <span id="userRole" style="background: rgba(74, 222, 128, 0.2); padding: 4px 10px; border-radius: 8px; font-size: 12px; color: #4ade80;"></span>
    <button class="btn-logout" onclick="logout()">خروج</button>
  </div>
</div>
<div class="main">
  <div class="stats-grid" id="stats"></div>
  <div class="search-bar">
    <input type="text" id="search" placeholder="جستجو در برنامه‌ها...">
  </div>
  <div class="shows-grid" id="shows"></div>
</div>
<script>
const API_BASE = '${API_BASE}';
const token = localStorage.getItem('bankresaneh_token');
const user = JSON.parse(localStorage.getItem('bankresaneh_user') || '{}');

if (!token) {
  window.location.href = '/login';
}

document.getElementById('userName').textContent = user.name || user.username;
document.getElementById('userRole').textContent = user.role === 'admin' ? 'مدیر' : user.role === 'editor' ? 'ویرایشگر' : 'بیننده';

async function api(path, options = {}) {
  const resp = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    if (resp.status === 401) {
      localStorage.removeItem('bankresaneh_token');
      window.location.href = '/login';
    }
    throw new Error('API error: ' + resp.status);
  }
  return resp.json();
}

function logout() {
  api('/api/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('bankresaneh_token');
    localStorage.removeItem('bankresaneh_user');
    window.location.href = '/login';
  });
}

async function loadStats() {
  try {
    const data = await api('/api/stats');
    document.getElementById('stats').innerHTML = 
      '<div class="stat-card"><div class="num">' + data.total + '</div><div class="label">کل برنامه‌ها</div></div>' +
      '<div class="stat-card"><div class="num">' + data.categories.length + '</div><div class="label">دسته‌بندی‌ها</div></div>' +
      data.categories.slice(0, 4).map(c => 
        '<div class="stat-card" style="border-top-color: #2563eb;"><div class="num" style="color: #2563eb;">' + c.count + '</div><div class="label">' + c.category.replace(/^\\d+\\.\\s*/, '').substring(0, 25) + '</div></div>'
      ).join('');
  } catch (e) { console.error(e); }
}

let allShows = [];
async function loadShows() {
  document.getElementById('shows').innerHTML = '<div class="loading">در حال بارگذاری...</div>';
  try {
    const data = await api('/api/shows?limit=1000');
    allShows = data.shows;
    renderShows(allShows);
  } catch (e) {
    document.getElementById('shows').innerHTML = '<div class="loading">خطا در بارگذاری</div>';
  }
}

function renderShows(shows) {
  document.getElementById('shows').innerHTML = shows.slice(0, 60).map(s => 
    '<div class="show-card" onclick="showDetails(' + s.num + ')">' +
      '<div class="thumb">' + (s.name || '').substring(0, 30) + '</div>' +
      '<div class="body">' +
        '<div class="name">' + (s.name || '') + '</div>' +
        '<div class="cat">' + (s.category || '').replace(/^\\d+\\.\\s*/, '').substring(0, 30) + '</div>' +
        '<div class="desc">' + (s.descriptionFa || '').substring(0, 80) + '...</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

function showDetails(num) {
  alert('جزئیات برنامهٔ ' + num + ' — این بخش در حال توسعه است');
}

document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allShows.filter(s => 
    (s.name || '').toLowerCase().includes(q) ||
    (s.category || '').includes(q) ||
    (s.descriptionFa || '').includes(q)
  );
  renderShows(filtered);
});

loadStats();
loadShows();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Login page
    if (path === '/login' || path === '/login/') {
      return htmlResponse(LOGIN_PAGE);
    }

    // Dashboard (default)
    return htmlResponse(DASHBOARD_PAGE);
  },
};
