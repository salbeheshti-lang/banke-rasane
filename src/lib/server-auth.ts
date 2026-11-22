// Shared auth helper for Next.js API routes.
//
// The BankResaneh session store lives in the API service. The web preview
// validates sessions against the isolated preview API instead of assuming
// that the API is running on the same machine as the Next.js process.

import type { NextRequest } from 'next/server';

const API_BASE = (
  process.env.BANKRESANEH_API_BASE ||
  process.env.NEXT_PUBLIC_BANKRESANEH_API_BASE ||
  'http://127.0.0.1:3002'
).replace(/\/+$/, '');

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  name: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  mustChangePassword?: boolean;
  permissions?: string[];
}

export async function requireUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const r = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const u = (await r.json()) as AuthUser;
    if (!u || typeof u.id !== 'number') return null;
    return u;
  } catch {
    return null;
  }
}

export async function requirePermission(
  req: NextRequest,
  permission: string
): Promise<AuthUser | null> {
  const user = await requireUser(req);
  if (!user) return null;
  if (user.isSuperAdmin) return user;
  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
    return user;
  }
  return null;
}

export async function requirePermissionAny(
  req: NextRequest,
  ...permissions: string[]
): Promise<AuthUser | null> {
  const user = await requireUser(req);
  if (!user) return null;
  if (user.isSuperAdmin) return user;
  if (Array.isArray(user.permissions)) {
    for (const permission of permissions) {
      if (user.permissions.includes(permission)) return user;
    }
  }
  return null;
}

export type AuthGate =
  | { ok: true; user: AuthUser }
  | { ok: false; status: 401 | 403 };

export async function gatePermission(
  req: NextRequest,
  permission: string
): Promise<AuthGate> {
  const user = await requireUser(req);
  if (!user) return { ok: false, status: 401 };
  if (user.isSuperAdmin) return { ok: true, user };
  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
    return { ok: true, user };
  }
  return { ok: false, status: 403 };
}

export async function gatePermissionAny(
  req: NextRequest,
  ...permissions: string[]
): Promise<AuthGate> {
  const user = await requireUser(req);
  if (!user) return { ok: false, status: 401 };
  if (user.isSuperAdmin) return { ok: true, user };
  if (Array.isArray(user.permissions)) {
    for (const permission of permissions) {
      if (user.permissions.includes(permission)) return { ok: true, user };
    }
  }
  return { ok: false, status: 403 };
}
