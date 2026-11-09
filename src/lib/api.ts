// API client for BankResaneh API

const TOKEN_KEY = 'bankresaneh_token';

function defaultApiBase(): string {
  if (typeof window !== 'undefined') {
    const currentPort = window.location.port;
    const currentHost = window.location.hostname;
    if (currentPort === '81' || currentPort === '' || currentPort === '443' || currentHost.includes('space-z.ai')) return window.location.origin;
  }
  return 'http://127.0.0.1:3002';
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('server_url');
    if (custom) return custom;
  }
  return defaultApiBase();
}

export function getApiUrl(path: string, baseOverride?: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  const stored = typeof window !== 'undefined' ? localStorage.getItem('server_url') : null;
  const selected = (baseOverride ?? stored ?? '').trim();
  const base = (selected || getApiBase()).replace(/\/+$/, '');
  const isGatewayHost = typeof window !== 'undefined'
    && (window.location.port === '81' || window.location.port === '' || window.location.port === '443' || window.location.hostname.includes('space-z.ai'));
  const isCurrentGateway = typeof window !== 'undefined' && isGatewayHost && base === window.location.origin;
  if (isCurrentGateway) {
    const separator = cleanPath.includes('?') ? '&' : '?';
    return base + '/' + cleanPath + separator + 'XTransformPort=3002';
  }
  return base + '/' + cleanPath;
}

export function setApiBase(url: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = (url || '').trim().replace(/\/+$/, '');
  const previous = (localStorage.getItem('server_url') || defaultApiBase()).replace(/\/+$/, '');
  const next = cleaned || defaultApiBase();
  if (previous !== next) localStorage.removeItem(TOKEN_KEY);
  if (cleaned) localStorage.setItem('server_url', cleaned);
  else localStorage.removeItem('server_url');
}

export function getApiBaseUrl(): string { return getApiBase(); }
export function getShowImageUrl(showNum: number): string { return getApiUrl('api/image/' + showNum); }

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  name: string;
  jobTitle?: string;
  deputy?: string;
  avatar?: string;
  phone?: string;
  createdAt?: number;
  lastSeen?: number;
  online?: boolean;
  mustChangePassword?: boolean;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
}

// Exported so SPA code that calls Next.js API routes directly (e.g.
// /api/fetch-show-info, /api/translate) can attach the Bearer token too —
// those routes are permission-guarded server-side and returned 403 when the
// header was missing ("لینک عکس رو اضافه نمیکنه" bug).
export function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'درخواست ناموفق بود (' + res.status + ')');
  return data;
}

export const api = {
  async login(username: string, password: string) {
    const data = await request<{ token: string; user: User }>(getApiUrl('api/auth/login'), {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },
  async logout() {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) {
      try {
        await fetch(getApiUrl('api/auth/logout'), {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ token }),
        });
      } catch {}
    }
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  },
  async getShows() { return request<{ shows: any[]; pagination?: { totalPages?: number } }>(getApiUrl('api/shows?page=1&limit=500')); },
  async getAllShows() {
    const all: any[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await request<{ shows: any[]; pagination?: { totalPages?: number } }>(
        getApiUrl('api/shows?page=' + page + '&limit=500')
      );
      all.push(...(Array.isArray(result.shows) ? result.shows : []));
      totalPages = Math.max(1, Number(result.pagination?.totalPages) || 1);
      page += 1;
      if (page > 10000) throw new Error('تعداد صفحات آرشیو غیرعادی است');
    } while (page <= totalPages);
    return all;
  },
  async searchShows(params: { query?: string; category?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params.query) query.set('q', params.query);
    if (params.category) query.set('category', params.category);
    query.set('page', String(Math.max(1, params.page || 1)));
    query.set('limit', String(Math.min(100, Math.max(1, params.limit || 30))));
    return request<{
      shows: unknown[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      query: string;
    }>(getApiUrl('api/shows/search?' + query.toString()));
  },
  async saveShow(show: any) { return request(getApiUrl('api/shows'), { method: 'POST', body: JSON.stringify(show) }); },
  async updateShow(show: any) {
    return request(getApiUrl('api/shows/' + encodeURIComponent(show.num)), { method: 'PUT', body: JSON.stringify(show) });
  },
  async deleteShow(num: number) { return request(getApiUrl('api/shows?num=' + encodeURIComponent(num)), { method: 'DELETE' }); },
  async fetchImage(data: { num: number; imdb?: string; wikipedia?: string; name?: string }) {
    return request(getApiUrl('api/fetch-image'), { method: 'POST', body: JSON.stringify(data) });
  },
  async getProfile() { return request<User>(getApiUrl('api/profile')); },
  async updateProfile(data: Partial<User>) { return request<User>(getApiUrl('api/profile'), { method: 'PUT', body: JSON.stringify(data) }); },
  async changePassword(oldPassword: string, newPassword: string) {
    const data = await request<{ success: boolean; token?: string; user?: User }>(
      getApiUrl('api/auth/change-password'),
      { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }
    );
    // The API now rotates the session and returns a fresh token. Persist it
    // immediately so subsequent requests use the new token instead of the
    // now-invalidated old one (which was the root cause of the 401
    // "Unauthorized" errors the user saw after changing password).
    if (data?.token && typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    return data;
  },
  async getCustomGenres() {
    return request<{ genres: Array<{ id: string; nameFa: string; name?: string; color: string; description: string; aliases?: string[] }> }>(getApiUrl('api/genres'));
  },
  async createCustomGenre(genre: { id: string; nameFa: string; name?: string; color: string; description: string; aliases?: string[] }) {
    return request<{ genre: typeof genre }>(getApiUrl('api/genres'), { method: 'POST', body: JSON.stringify(genre) });
  },
  async updateCustomGenre(genre: { id: string; nameFa: string; name?: string; color: string; description: string; aliases?: string[] }) {
    return request<{ genre: typeof genre }>(getApiUrl('api/genres?id=' + encodeURIComponent(genre.id)), { method: 'PUT', body: JSON.stringify(genre) });
  },
  async deleteCustomGenre(id: string) {
    return request<{ success: boolean }>(getApiUrl('api/genres?id=' + encodeURIComponent(id)), { method: 'DELETE' });
  },
  async getUsers() { const data = await request<{ users: User[] }>(getApiUrl('api/users')); return data.users || []; },
  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined' || !localStorage.getItem(TOKEN_KEY)) return null;
    try { return await request<User>(getApiUrl('api/auth/me')); } catch { return null; }
  },
  async updateUser(id: number, data: any) { return request(getApiUrl('api/users?id=' + encodeURIComponent(id)), { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteUser(id: number) { return request(getApiUrl('api/users?id=' + encodeURIComponent(id)), { method: 'DELETE' }); },
  async createUser(data: any) { return request(getApiUrl('api/users'), { method: 'POST', body: JSON.stringify(data) }); },
  async getActivity(limit?: number) {
    const url = getApiUrl('api/activity') + (limit ? '?limit=' + limit : '');
    const data = await request<{ logs: any[] }>(url);
    return data.logs || [];
  },
  async trackAnalytics(action: string, targetType = 'show', targetId = '', details = '') {
    try {
      await request(getApiUrl('api/analytics/track'), {
        method: 'POST', body: JSON.stringify({ action, targetType, targetId, details }),
      });
    } catch { /* non-critical — analytics should never block UX */ }
  },
  async getAnalyticsReport(days = 30) {
    return request<any>(getApiUrl('api/analytics/report?days=' + days));
  },
};
