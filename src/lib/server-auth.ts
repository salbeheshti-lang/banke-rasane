// Shared auth helper for Next.js API routes.
//
// The BankResaneh session store lives in the Bun API service (port 3002)
// — it owns the `sessions` table. Rather than duplicate that logic in
// Next.js, we proxy the auth check through the Bun service's
// /api/auth/me endpoint, which reads the same `Authorization: Bearer
// <token>` header the SPA already sends.
//
// Usage:
//   import { requireUser, requirePermission, requirePermissionAny } from '@/lib/server-auth';
//   export async function POST(req: NextRequest) {
//     const user = await requireUser(req);
//     if (!user) return NextResponse.json({error:'Unauthorized'}, {status:401});
//     // OR, for permission-gated routes:
//     const admin = await requirePermission(req, 'manage_settings');
//     if (!admin) return NextResponse.json({error:'Forbidden'}, {status:403});
//     // OR, for routes accessible by EITHER of two permissions:
//     const editor = await requirePermissionAny(req, 'add_shows', 'edit_shows');
//     if (!editor) return NextResponse.json({error:'Forbidden'}, {status:403});
//     ...
//   }

import type { NextRequest } from 'next/server';

const DEFAULT_API_BASE = process.env.BANKRESANEH_API_BASE || 'http://127.0.0.1:3002';

/**
 * Resolve the API origin selected by the client without turning this route
 * into an unrestricted server-side request proxy. The configured backend is
 * always allowed; additional production backends must be explicitly listed
 * in BANKRESANEH_ALLOWED_API_ORIGINS (comma-separated HTTPS origins).
 */
export function getApiBaseForRequest(req: NextRequest): string | null {
  const configured = new URL(DEFAULT_API_BASE);
  const requested = req.headers.get('x-bankresaneh-api-base');
  if (!requested) return configured.origin;

  let candidate: URL;
  try {
    candidate = new URL(requested);
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(candidate.protocol) ||
      candidate.username || candidate.password || candidate.search || candidate.hash ||
      (candidate.pathname !== '/' && candidate.pathname !== '')) return null;

  // A same-origin value means the client is using the site's reverse proxy.
  // Use the server's configured API target to avoid recursively calling Next.
  if (candidate.origin === req.nextUrl.origin) return configured.origin;
  if (candidate.origin === configured.origin) return configured.origin;

  const allowed = (process.env.BANKRESANEH_ALLOWED_API_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .flatMap(value => {
      try { return [new URL(value).origin]; } catch { return []; }
    });
  if (!allowed.includes(candidate.origin)) return null;
  const loopbackHost = candidate.hostname === 'localhost' ||
    candidate.hostname === '127.0.0.1' || candidate.hostname === '[::1]';
  // Permit plain HTTP only for loopback development/Electron APIs. Any
  // non-loopback custom backend must use HTTPS, even on self-hosted installs.
  if (process.env.NODE_ENV === 'production' && candidate.protocol !== 'https:' && !loopbackHost) return null;
  return candidate.origin;
}

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

/**
 * Validate the caller's session by proxying to the Bun API service.
 * Returns the user object on success, or null on any failure
 * (missing token, invalid token, expired session, suspended user,
 * API service down, etc.).
 */
export async function requireUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const apiBase = getApiBaseForRequest(req);
  if (!apiBase) return null;
  try {
    const r = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: auth },
      // Short timeout so a down API service doesn't hang the request.
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const u = (await r.json()) as AuthUser;
    if (!u || typeof u.id !== 'number') return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Validate the caller's session AND require a specific permission.
 * Returns the user object if they have the permission, or null otherwise.
 *
 * Permissions are checked via the Bun API service's /api/permissions endpoint
 * shape — we rely on the `permissions` array already present in the /api/auth/me
 * response (the Bun service populates it via getUserPermissions()).
 */
export async function requirePermission(
  req: NextRequest,
  permission: string
): Promise<AuthUser | null> {
  const user = await requireUser(req);
  if (!user || user.mustChangePassword) return null;
  // Super admin has all permissions.
  if (user.isSuperAdmin) return user;
  // Otherwise, check the permissions array.
  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
    return user;
  }
  return null;
}

/**
 * Validate the caller's session AND require AT LEAST ONE of the listed
 * permissions. Useful for endpoints that can be reached by either of two
 * roles (e.g. translate is allowed for both add_shows and edit_shows).
 *
 * Returns the user object if they have ANY of the listed permissions, or
 * null otherwise.
 */
export async function requirePermissionAny(
  req: NextRequest,
  ...permissions: string[]
): Promise<AuthUser | null> {
  const user = await requireUser(req);
  if (!user || user.mustChangePassword) return null;
  // Super admin has all permissions.
  if (user.isSuperAdmin) return user;
  // Otherwise, check if they have ANY of the listed permissions.
  if (Array.isArray(user.permissions)) {
    for (const p of permissions) {
      if (user.permissions.includes(p)) return user;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gate helpers — return a discriminated result that lets the caller
// distinguish "unauthenticated" (401) from "authenticated but forbidden" (403).
// This fixes the issue where requirePermission returns null for BOTH cases,
// causing some routes to respond 403 to unauthenticated callers.
//
// Each gate makes exactly ONE call to the Bun API service (no double-fetch).
// ---------------------------------------------------------------------------

export type AuthGate =
  | { ok: true; user: AuthUser }
  | { ok: false; status: 401 | 403 };

/**
 * Check authentication + a single permission, returning a gate result that
 * distinguishes 401 (unauthenticated) from 403 (forbidden).
 */
export async function gatePermission(
  req: NextRequest,
  permission: string
): Promise<AuthGate> {
  const user = await requireUser(req);
  if (!user) return { ok: false, status: 401 };
  if (user.mustChangePassword) return { ok: false, status: 403 };
  if (user.isSuperAdmin) return { ok: true, user };
  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
    return { ok: true, user };
  }
  return { ok: false, status: 403 };
}

/**
 * Check authentication + at-least-one of several permissions, returning a
 * gate result that distinguishes 401 (unauthenticated) from 403 (forbidden).
 */
export async function gatePermissionAny(
  req: NextRequest,
  ...permissions: string[]
): Promise<AuthGate> {
  const user = await requireUser(req);
  if (!user) return { ok: false, status: 401 };
  if (user.mustChangePassword) return { ok: false, status: 403 };
  if (user.isSuperAdmin) return { ok: true, user };
  if (Array.isArray(user.permissions)) {
    for (const p of permissions) {
      if (user.permissions.includes(p)) return { ok: true, user };
    }
  }
  return { ok: false, status: 403 };
}
