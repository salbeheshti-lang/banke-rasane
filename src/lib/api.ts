// API client for BankResaneh API

// The API base URL is configurable so admins can point the app at any
// reachable instance of the API service (default: local Bun service on :3002).
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('server_url') || 'http://localhost:3002';
  }
  return 'http://localhost:3002';
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

  const response = await fetch(`${getApiBase()}${path}`, {
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

  async getHealth(): Promise<{ status: string }> {
    const data = await apiRequest('/api/health');
    return data;
  },

  // Stats
  async getStats(): Promise<{ total: number; categories: Array<{ category: string; count: number }> }> {
    return await apiRequest('/api/stats');
  },
};
