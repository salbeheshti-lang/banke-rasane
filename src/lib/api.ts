// API client for BankResaneh API

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('server_url');
    if (custom) return custom;
    const currentPort = window.location.port;
    const currentHost = window.location.hostname;
    if (currentPort === '81' || currentPort === '' || currentHost.includes('space-z.ai')) {
      return `${window.location.origin}/?XTransformPort=3002`.replace(/\?.*/, '');
    }
    return 'http://localhost:3002';
  }
  return 'http://localhost:3002';
}

export function setApiBase(url: string): void {
  if (typeof window !== 'undefined') {
    const cleaned = (url || '').trim().replace(/\/+$/, '');
    if (cleaned) localStorage.setItem('server_url', cleaned);
    else localStorage.removeItem('server_url');
  }
}

export function getApiBaseUrl(): string { return getApiBase(); }

export function getShowImageUrl(showNum: number): string {
  const base = getApiBase();
  if (typeof window !== 'undefined') {
    const isGateway = base === window.location.origin + '/' || base === window.location.origin;
    if (isGateway) return `${base}api/image/${showNum}?XTransformPort=3002`;
  }
  return `${base.replace(/\/+$/, '')}/api/image/${showNum}`;
}

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
}

const TOKEN_KEY = 'bankresaneh_token';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  async login(username: string, password: string) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/auth/login?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async logout() {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) {
      try {
        const base = getApiBase();
        const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
        const url = isGateway ? window.location.origin + '/api/auth/logout?XTransformPort=3002' : base.replace(/\/+$/, '') + '/api/auth/logout';
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ token }) });
      } catch {}
    }
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  },

  async getShows() {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/shows?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/shows`;
    return request(url);
  },

  async saveShow(show: any) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/shows?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/shows`;
    return request(url, { method: 'POST', body: JSON.stringify(show) });
  },

  async deleteShow(num: number) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/shows?num=${num}&XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/shows?num=${num}`;
    return request(url, { method: 'DELETE' });
  },

  async getProfile() {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/profile?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/profile`;
    return request(url);
  },

  async updateProfile(data: any) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/profile?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/profile`;
    return request(url, { method: 'PUT', body: JSON.stringify(data) });
  },

  async changePassword(oldPassword: string, newPassword: string) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/auth/change-password?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/auth/change-password`;
    return request(url, { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
  },

  async getUsers() {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/users?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/users`;
    return request(url);
  },

  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined' || !localStorage.getItem(TOKEN_KEY)) return null;
    try {
      const base = getApiBase();
      const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
      const url = isGateway ? window.location.origin + '/api/auth/me?XTransformPort=3002' : base.replace(/\/+$/, '') + '/api/auth/me';
      return await request(url);
    } catch { return null; }
  },

  async updateUser(id: number, data: any) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? window.location.origin + '/api/users?id=' + id + '&XTransformPort=3002' : base.replace(/\/+$/, '') + '/api/users?id=' + id;
    return request(url, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteUser(id: number) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? window.location.origin + '/api/users?id=' + id + '&XTransformPort=3002' : base.replace(/\/+$/, '') + '/api/users?id=' + id;
    return request(url, { method: 'DELETE' });
  },

  async createUser(data: any) {
    const base = getApiBase();
    const isGateway = typeof window !== 'undefined' && (window.location.port === '81' || window.location.port === '' || window.location.hostname.includes('space-z.ai'));
    const url = isGateway ? `${window.location.origin}/api/users?XTransformPort=3002` : `${base.replace(/\/+$/,'')}/api/users`;
    return request(url, { method: 'POST', body: JSON.stringify(data) });
  },
};
