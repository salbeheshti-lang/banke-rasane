// API client for BankResaneh API

const TOKEN_KEY = 'bankresaneh_token';

function defaultApiBase(): string {
  if (typeof window !== 'undefined') {
    const currentPort = window.location.port;
    const currentHost = window.location.hostname;
    if (currentPort === '81' || currentPort === '' || currentPort === '443' || currentHost.includes('space-z.ai')) return window.location.origin;
  }
  return 'http://localhost:3002';
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
}

function authHeaders(): Record<string, string> {
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
  async getShows() { return request(getApiUrl('api/shows')); },
  async saveShow(show: any) { return request(getApiUrl('api/shows'), { method: 'POST', body: JSON.stringify(show) }); },
  async deleteShow(num: number) { return request(getApiUrl('api/shows?num=' + encodeURIComponent(num)), { method: 'DELETE' }); },
  async fetchImage(data: { num: number; imdb?: string; wikipedia?: string; name?: string }) {
    return request(getApiUrl('api/fetch-image'), { method: 'POST', body: JSON.stringify(data) });
  },
  async getProfile() { return request<User>(getApiUrl('api/profile')); },
  async updateProfile(data: Partial<User>) { return request<User>(getApiUrl('api/profile'), { method: 'PUT', body: JSON.stringify(data) }); },
  async changePassword(oldPassword: string, newPassword: string) {
    return request(getApiUrl('api/auth/change-password'), { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
  },
  async getUsers() { const data = await request<{ users: User[] }>(getApiUrl('api/users')); return data.users || []; },
  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined' || !localStorage.getItem(TOKEN_KEY)) return null;
    try { return await request<User>(getApiUrl('api/auth/me')); } catch { return null; }
  },
  async updateUser(id: number, data: any) { return request(getApiUrl('api/users?id=' + encodeURIComponent(id)), { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteUser(id: number) { return request(getApiUrl('api/users?id=' + encodeURIComponent(id)), { method: 'DELETE' }); },
  async createUser(data: any) { return request(getApiUrl('api/users'), { method: 'POST', body: JSON.stringify(data) }); },
};
