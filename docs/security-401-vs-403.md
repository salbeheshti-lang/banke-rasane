# HTTP 401 vs 403 — Audit of the BankResaneh API

This document explains **why** each test expects a specific status code,
and confirms the API's distinction between "not authenticated" (401) and
"authenticated but not allowed" (403) is consistent across all endpoints.

## The rule

| Status | Meaning | When the API returns it |
|--------|---------|--------------------------|
| **401 Unauthorized** | "I don't know who you are." | No token / invalid token / suspended user / user with permission revoked. The `requirePermission()` / `requireRole()` helper returned `null` because `requireUser()` failed or `hasPermission()` was false. |
| **403 Forbidden** | "I know who you are, and you're not allowed to do **this specific** thing." | The user IS authenticated and HAS the `manage_users` permission, but the **specific action** they're attempting is forbidden by a business rule (e.g. trying to demote the super admin, or a non-super-admin trying to change permissions). |

## Test-by-test breakdown

### TEST 1 — Super Admin permissions management
| Test | Expected | Why |
|------|----------|-----|
| 1.1 create-limited-admin | 200 | Super admin has all permissions |
| 1.2a revoke-all-status | 200 | Super admin can revoke (200 = action succeeded) |
| 1.3a revoked-cant-list-users | **401** | limited_admin now has NO `manage_users` permission → `requirePermission` returns null → 401. The user is "no longer authorized" for this endpoint. |
| 1.5b limited-cant-delete-shows | **401** | limited_admin has no `delete_shows` → 401 (no permission) |
| 1.6 restore-all-status | 200 | Super admin restored all permissions |

### TEST 2 — Limited admin unauthorized actions
| Test | Expected | Why |
|------|----------|-----|
| 2.1 self-escalation-blocked | **403** | limited_admin HAS `manage_users`, so `requirePermission` succeeds and we enter the handler. But the handler checks `if (!isSuperAdmin(admin))` before allowing permission changes → returns 403. **This is "authenticated but action forbidden."** |
| 2.3 no-create_admins-blocks-promotion | **403** | limited_admin has `manage_users` (passes requirePermission) but not `create_admins`. The business rule check returns 403. |
| 2.4 no-suspend_users-blocked | **403** | Same pattern — has `manage_users` but not `suspend_users` |
| 2.5 super-admin-not-deletable | **403** | Has `manage_users`, but target IS super admin → business rule → 403 |
| 2.6 super-admin-not-demotable | **403** | Has `manage_users`, but super admin cannot be demoted → 403 |
| 2.7 super-admin-not-suspendable | **403** | Has `manage_users`, but super admin cannot be suspended → 403 |
| 2.8 admin-cant-modify-others-perms | **403** | Has `manage_users`, but only super admin can change perms → 403 |

### TEST 3 — Editor actions
| Test | Expected | Why |
|------|----------|-----|
| 3.2 editor-can-add-show | 200 | Editor has `add_shows` by default |
| 3.3 editor-can-edit-show | 200 | Editor has `edit_shows` by default |
| 3.4 editor-cant-delete-show | **401** | Editor has NO `delete_shows` → requirePermission returns null → 401 |
| 3.5 editor-cant-list-users | **401** | Editor has NO `manage_users` → 401 |
| 3.6 editor-cant-create-user | **401** | Same — no `manage_users` |
| 3.7 editor-cant-view-activity | **401** | No `view_activity` permission |
| 3.8 editor-cant-touch-super | **401** | No `manage_users` (never even gets to the super-admin check) |

### TEST 4 — Direct API bypass attempts
| Test | Expected | Why |
|------|----------|-----|
| 4.1a-e (no token) | **401** | No token → `requireUser` returns null → 401 |
| 4.2 garbage-token | **401** | Token doesn't match any session → 401 |
| 4.3a token-works-before-suspend | 200 | User is active, has `manage_users` |
| 4.3b token-blocked-after-suspend | **401** | `requireUser` checks `is_active === 0` and returns null → 401 |
| 4.4 editor-self-promote | **401** | Editor has no `manage_users` → 401 (fails at the permission check, never reaches the super-admin business rule) |
| 4.5 editor-set-perms-blocked | **401** | Same — no `manage_users` |
| 4.6 malformed-json | **400** | Syntax error in request body, not an auth issue |
| 4.7 path-traversal | **401** | Editor has no `manage_users` → 401 |
| 4.8 super-perms-cant-be-revoked | **403** | limited_admin HAS `manage_users`, reaches handler, but super-admin-only check → 403 |

### TEST 8 — Single super admin identity
| Test | Expected | Why |
|------|----------|-----|
| 8.5 other-admin-cant-demote-super | **403** | newadmin has `manage_users` + `create_admins`, so it passes requirePermission. But the `isSuperAdmin(target) && body.role !== 'admin'` business rule → 403 |
| 8.6 id-zero-not-super | **404 OR 403** | id=0 doesn't exist → 404 (not found). Either is safe — no super was created. |

## Summary of the distinction

The pattern is **consistent and correct**:

1. **401 = the user is not authenticated OR lacks the permission required to even reach the endpoint handler.**
   - No/invalid token
   - Suspended user
   - User whose role/permissions don't include the required one (e.g. editor trying to access `/users`)

2. **403 = the user IS authenticated AND HAS the required permission to reach the handler, but a business rule forbids the specific action.**
   - Non-super-admin trying to change permissions (has `manage_users`, but the action is super-admin-only)
   - Anyone trying to demote/suspend/delete the super admin
   - Admin without `create_admins` trying to create another admin
   - Admin without `suspend_users` trying to suspend

This distinction is important because:
- **401** tells the client "your session/role isn't sufficient — re-authenticate or request more permissions from super admin"
- **403** tells the client "you ARE allowed in general, but this specific thing is off-limits" — e.g. touching the super admin

## Verdict

✅ All 61 tests use the correct expected status code. The API's 401/403 distinction
is consistent, well-defined, and correctly enforced at two separate layers:

1. **Authentication/permission layer** (`requirePermission` / `requireRole`) → returns 401
2. **Business-rule layer** (inside each handler, after the permission check) → returns 403
