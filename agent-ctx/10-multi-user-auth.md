# Task 10 — Rebuild multi-user auth system

**Agent:** main (Z.ai Code)
**Task:** After a sandbox wipe, rebuild a real multi-user authentication system: local Bun+SQLite API service on :3002, configurable frontend API client, real login screen (username/password), role-based UI (viewer = read-only, editor/admin = full edit), and an admin-only Settings modal with 3 tabs (Server URL, Users, Change password).

## What was built

### Part 1 — Local API service (`mini-services/api-service/`)
- **package.json** — `bun --hot index.js` dev script.
- **index.js** — full HTTP server on port 3002 with bun:sqlite. Tables: `users`, `sessions`, `shows`.
  - Default admin user `admin / admin` (SHA-256 hashed), seeded on first run.
  - Seeds 560 shows from `/home/z/my-project/public/talk-shows-data.json` on first run (idempotent — skips if table non-empty).
  - Session tokens: 32-byte random hex, 7-day TTL, stored in `sessions` table.
  - CORS headers (`Access-Control-Allow-Origin: *`) on every response + OPTIONS preflight.
  - All endpoints implemented and curl-tested:
    - `POST /api/auth/login {username,password} → {token,user}`
    - `POST /api/auth/logout {token} → {success}` (also accepts Bearer header)
    - `GET  /api/auth/me (Bearer) → {user}`
    - `GET  /api/shows → {shows}` (returns all 560, sorted by num)
    - `GET  /api/shows/:num → {show}`
    - `POST /api/shows (admin/editor) → {num}` (auto-assigns next num if missing)
    - `PUT  /api/shows/:num (admin/editor) → {success}` (merges with existing row)
    - `DELETE /api/shows/:num (admin) → {success}`
    - `GET  /api/users (admin) → {users}`
    - `POST /api/users (admin) → {id}` (validates role, password ≥4 chars, unique username)
    - `DELETE /api/users/:id (admin) → {success}` (refuses self-delete, invalidates sessions)
    - `PUT  /api/users/:id (admin) → {success}` (role/name/password patch)
    - `PUT  /api/auth/change-password {oldPassword,newPassword} → {success}` (invalidates all sessions, forces re-login)
    - `GET /api/health → {status:'ok',time}`
  - **Bug fix during dev:** bun:sqlite named parameters (`@name`, `$name`, `:name`) silently bind to `null` when the JS object key lacks the matching prefix. Re-wrote all show insert/update statements to use positional `?` placeholders with an ordered values array (`SHOW_COLUMNS`, `showToValues(s)`). After the fix, all 560 shows seed with correct `name`, `category`, etc. (verified by `GET /api/shows/1` returning `name:"Ayuready?"`).

### Part 2 — Configurable API client (`src/lib/api.ts`)
- Removed hardcoded `API_BASE = 'https://...workers.dev'`.
- Added `getApiBase()` — returns `localStorage.getItem('server_url') || 'http://localhost:3002'` on the client; returns the default on the server (SSR-safe).
- Added `setApiBase(url)` — trims trailing slashes, writes to localStorage.
- Updated `apiRequest()` to use `${getApiBase()}${path}` instead of the old constant.
- Kept all existing methods (`login`, `logout`, `getCurrentUser`, `getShows`, `getShow`, `createShow`, `updateShow`, `deleteShow`, `getUsers`, `createUser`, `deleteUser`, `getStats`).
- Added new methods: `updateUser(id, {role,name,password})`, `changePassword(old, new)`, `getHealth()`.

### Part 3 — Real login screen (`src/app/page.tsx`)
- Replaced the dummy one-button `LoginScreen` with a real auth form:
  - Username field (`dir="ltr"`, autocomplete="username").
  - Password field (`dir="ltr"`, autocomplete="current-password") with show/hide eye toggle (eye vs eye-off icons).
  - Error message display (red glass card with the API's Persian error message, e.g. "نام کاربری یا رمز عبور نادرست است").
  - Loading state (spinner + "در حال ورود..." inside the button, button disabled).
  - Submit button keeps the existing `.btn-enter-white` green liquid-glass class from task 2.
  - On success: calls `onLogin(user)` which sets `currentUser` and the dashboard renders.
  - Help line at the bottom shows the default credentials `admin / admin`.
- **Home component** rewrites:
  - Removed the old `screen: 'login' | 'app'` + `loading` state.
  - Added `currentUser: User | null` (null ⇒ show login) + `authLoading` (true on first render while we validate any stored token).
  - On mount: reads `localStorage['bankresaneh_token']`, calls `api.getCurrentUser()`. If it returns a user, sets `currentUser` (skips login). If it throws (token invalid/expired), clears the token + shows login. While checking, renders a spinner on the login-screen background.
  - `handleLogout()` calls `api.logout()` (clears server session), then resets `currentUser` to null + clears view stack.
  - `handleLoginSuccess(user)` sets `currentUser`.

### Part 4 — Role-based UI
- Computed `role`, `canEdit = role === 'admin' || 'editor'`, `isAdmin = role === 'admin'` from `currentUser`.
- **Dashboard**: `+ افزودن برنامه` button wrapped in `{canEdit && (...)}` — hidden for viewers.
- **ProgramsView**: `انتخاب چندتایی` button wrapped in `{canEdit && (...)}` — hidden for viewers; replaced with a `🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید` info badge so the toolbar layout doesn't collapse.
- **ShowDetailsModal**: `✏ ویرایش` and `🗑 حذف برنامه` buttons wrapped in `{canEdit && (...)}` — hidden for viewers. The publish, PDF, and Excel buttons remain visible to all roles.
- **AddEditView**: rendered only when `canEdit`; for viewers it renders an "دسترسی غیرمجاز" (unauthorized) glass card with a Persian explanation.
- **DrawerMenu**:
  - Now takes `currentUser: User | null`, `isAdmin: boolean`, `onOpenSettings: () => void`.
  - Footer shows a user info card: avatar (first letter), display name, role badge (color-coded: admin=red, editor=amber, viewer=green), and `@username`.
  - Settings button (`⚙ تنظیمات`, with the gear icon) renders only when `isAdmin === true`. Clicking it calls `onOpenSettings()` which opens the SettingsModal.
  - Logout button always visible.

### Part 5 — Settings modal (`SettingsModal`, admin only)
- 3-tab modal opened from the drawer's `⚙ تنظیمات` button:
  1. **سرور (Server)** — `SettingsServerTab`:
     - Shows current `getApiBase()` value in an LTR input.
     - "🔍 تست اتصال" button — fetches `${url}/api/health` and shows a green "اتصال برقرار شد ✓" or red error card.
     - "✓ ذخیره آدرس" button — calls `setApiBase(url)` + shows a Persian toast.
  2. **کاربران (Users)** — `SettingsUsersTab`:
     - "＋ افزودن کاربر جدید" form (username, display name, password, role select).
     - "کاربران فعلی" list — each row shows avatar, name, `@username`, role dropdown (disabled for self), and a delete button (disabled for self with title "نمی‌توانید خودتان را حذف کنید").
     - Creating / deleting / changing role re-fetches the list via `api.getUsers()`.
  3. **رمز عبور (Password)** — `SettingsPasswordTab`:
     - Three password fields (current, new, confirm) with a single show/hide toggle for all three.
     - Validation: all three required, new ≥4 chars, new === confirm, new !== old.
     - Mismatch warning rendered live as the user types.
     - Submit calls `api.changePassword(old, new)`. The API invalidates all sessions for that user, so the UI calls `onLogout()` after 1.5s to force re-login.

## Build & verification
- API service: persistent via `start-stop-daemon` (`/home/z/my-project/.zscripts/api-service.pid`, log in `.zscripts/api-service.log`). Survives across Bash calls (verified after multiple calls).
- Frontend: `npx next build --webpack` with `output: 'standalone'`. Copied `.next/static` + `public` into `.next/standalone/`. Running via `node .next/standalone/server.js` (PID in `.zscripts/app.pid`).
- HTTP 200 on `http://localhost:3000/`, `{"status":"ok"}` on `http://localhost:3002/api/health`.
- agent-browser end-to-end verification:
  1. Open `http://localhost:3000/` → **login form renders** (not the dummy one-button): "نام کاربری" + "رمز عبور" fields + show/hide eye + "ورود به برنامه" button + help line "نام کاربری پیش‌فرض: admin / رمز: admin".
  2. Fill `admin / admin` → click → **dashboard renders**: 560 programs, 17 genres, stats, "+ افزودن برنامه" button visible (admin can edit).
  3. Open drawer → **user info card** shows "مدیر سیستم" + red "مدیر سیستم" role badge + "@admin".
  4. **"⚙ تنظیمات" button visible** (admin only) → click → **SettingsModal opens with 3 tabs**: "🖥 سرور", "👥 کاربران", "🔑 رمز عبور".
  5. Click "👥 کاربران" → form "＋ افزودن کاربر جدید" + list "کاربران فعلی (۱)" showing admin user (role dropdown disabled for self).
- **Role-based verification** (logged in as a test viewer user):
  - Dashboard: NO "+ افزودن برنامه" button.
  - ProgramsView: NO "انتخاب چندتایی" button — replaced with "🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید" badge.
  - ShowDetailsModal: action buttons limited to "📱 انتشار در شبکه‌های اجتماعی", "📄 گزارش PDF", "📊 گزارش Excel" — "✏ ویرایش" and "🗑 حذف برنامه" are HIDDEN.
  - Drawer: NO "⚙ تنظیمات" button (admin-only), user info card shows green "بیننده" badge.
- All endpoints curl-tested: health, login (success + bad password), shows list (560), get show 1 (correct name), create user (id=2), list users, update show (PUT), change password (invalidates session, new password works), delete user.

## Lint
- `bun run lint`: 9 errors + 3 warnings, ALL pre-existing in the original repo's `page.tsx` (setState-in-effect at line ~376, refs-during-render at line ~2933) and `worker/*.js` (anonymous default exports). My changes added **zero new lint issues**.
- Build proceeds cleanly because `next.config.ts` has `typescript.ignoreBuildErrors: true` (carried over from the original repo).

## Running services
- **API service**: PID `/home/z/my-project/.zscripts/api-service.pid`, port 3002, `bun --hot index.js` (auto-restart on file changes).
- **Frontend**: PID `/home/z/my-project/.zscripts/app.pid`, port 3000, `node .next/standalone/server.js`.
- DB file: `mini-services/api-service/bankresaneh.sqlite` (560 shows + admin user).
