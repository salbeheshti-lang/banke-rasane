// API client for BankResaneh API

// The API base URL is configurable so admins can point the app at any
// reachable instance of the API service (default: local Bun service on :3002).
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    // If user set a custom server URL, use it
    const custom = localStorage.getItem('server_url');
    if (custom) return custom;
    // Auto-detect: if we're behind the preview gateway (port 81),
    // route API requests through the gateway with XTransformPort
    const currentPort = window.location.port;
    const currentHost = window.location.hostname;
    if (currentPort === '81' || currentPort === '') {
      // Behind gateway — use relative path with XTransformPort
      return `${window.location.origin}/?XTransformPort=3002`.replace(/\?.*/, '');
    }
    return 'http://localhost:3002';
  }
  return 'http://localhost:3002';
}

// Build the URL for a show's poster image, served by the API service.
// The API stores images as BLOBs in SQLite, so this URL works in all
// deployment modes (preview gateway, static export, .exe, .apk).
//
//   getApiBase() returns either:
//     - 'http://localhost:3002'                       (direct, dev/static export)
//     - 'https://preview...space-z.ai/'               (gateway mode, after regex)
//
// In gateway mode we have to add the XTransformPort query param to the
// image path too, otherwise Caddy won't route it to port 3002.
export function getShowImageUrl(showNum: number): string {
  const base = getApiBase();
  // Gateway mode: base ends with '/' and has no host:port for the API.
  // We detect it by checking if the base points at the current origin
  // (not at localhost:3002 directly).
  if (typeof window !== 'undefined') {
    const isGateway = base === window.location.origin + '/' || base === window.location.origin;
    if (isGateway) {
      return `${base}api/image/${showNum}?XTransformPort=3002`;
    }
  }
  // Direct mode: base is like 'http://localhost:3002'
  return `${base.replace(/\/+$/, '')}/api/image/${showNum}`;
}

export function setApiBase(url: string): void {
  if (typeof window !== 'undefined') {
    const cleaned = (url || '').trim().replace(/\/+$/, '');
    if (cleaned) {
      localStorage.setItem('server_url', cleaned);
    } else {
      localStorage.removeItem('server_url');
    }
  }
}

export function getApiBaseUrl(): string {
  return getApiBase();
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  name: string;
  // Extended profile fields (returned by /api/auth/me and /api/profile)
  jobTitle?: string;
  deputy?: string;    // معاونت و سمت
  avatar?: string;
  phone?: string;     // شماره تماس — فقط admin می‌بیند (یا خود کاربر برای ویرایش)
  createdAt?: number;
  lastSeen?: number;   // unix seconds (0 if never seen)
  online?: boolean;    // true if seen in the last 2 minutes
}

export interface Show {
  num: number;
  name: string;
  category: string;
  source: string;
  size: string;
  viewers: string;
  style: string;
  effects: string;
  layout: string;
  elements: string;
  materials: string;
  colors: string;
  lighting: string;
  summary: string;
  descriptionFa: string;
  youtube: string;
  imdb: string;
  wikipedia: string;
  socialPost: string;
  images: string[];
  videos: string[];
}

// Token management
let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('bankresaneh_token', token);
    } else {
      localStorage.removeItem('bankresaneh_token');
    }
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('bankresaneh_token');
  }
  return authToken;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// Helper: API request
async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Detect if behind gateway — if so, append XTransformPort to query
  let url = `${getApiBase()}${path}`;
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '81' || port === '') {
      // Behind gateway — use relative path with XTransformPort
      const sep = path.includes('?') ? '&' : '?';
      url = `${path}${sep}XTransformPort=3002`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'خطای شبکه' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const api = {
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore errors on logout
    }
    setToken(null);
  },

  async getCurrentUser(): Promise<User> {
    const data = await apiRequest('/api/auth/me');
    return data;
  },

  // Shows
  async getShows(params?: { search?: string; category?: string; limit?: number }): Promise<Show[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.limit) query.set('limit', String(params.limit));
    const data = await apiRequest(`/api/shows?${query.toString()}`);
    return data.shows;
  },

  async getShow(num: number): Promise<Show> {
    const data = await apiRequest(`/api/shows/${num}`);
    return data.show;
  },

  async createShow(show: Partial<Show>): Promise<{ num: number }> {
    const data = await apiRequest('/api/shows', {
      method: 'POST',
      body: JSON.stringify(show),
    });
    return data;
  },

  async updateShow(num: number, show: Partial<Show>): Promise<void> {
    await apiRequest(`/api/shows/${num}`, {
      method: 'PUT',
      body: JSON.stringify(show),
    });
  },

  async deleteShow(num: number): Promise<void> {
    await apiRequest(`/api/shows/${num}`, { method: 'DELETE' });
  },

  // Users (admin only)
  async getUsers(): Promise<User[]> {
    const data = await apiRequest('/api/users');
    return data.users;
  },

  async createUser(user: { username: string; password: string; role: string; name?: string }): Promise<void> {
    await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async deleteUser(id: number): Promise<void> {
    await apiRequest(`/api/users/${id}`, { method: 'DELETE' });
  },

  async updateUser(id: number, patch: { role?: string; name?: string; password?: string }): Promise<void> {
    await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiRequest('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  // Profile — any logged-in user can read/update their own profile
  async getProfile(): Promise<User> {
    return await apiRequest('/api/profile');
  },

  async updateProfile(patch: {
    name?: string;
    jobTitle?: string;
    deputy?: string;
    phone?: string;
    avatar?: string;
  }): Promise<User> {
    return await apiRequest('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  async getHealth(): Promise<{ status: string }> {
    const data = await apiRequest('/api/health');
    return data;
  },

  // Stats
  async getStats(): Promise<{ total: number; categories: Array<{ category: string; count: number }> }> {
    return await apiRequest('/api/stats');
  },
};
