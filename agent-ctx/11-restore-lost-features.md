# Task 11 — Re-add 8 features lost in sandbox restart

**Agent:** main (Z.ai Code)
**Task:** The current `src/app/page.tsx` had the multi-user auth system but was missing 8 features lost when the sandbox restarted. Re-implement all of them: Add Genre button + modal, Add button in ProgramsView, three new genre cards (PSA / پایش تحلیلی / آگهی), Islamic countries filter, tags system, related programs, section-specific tags, section-specific search.

## What was built (single file: `src/app/page.tsx`, 5,557 lines)

### 1. Add Genre button + modal (admin only)
- New `AddGenreModal` component: Name (required), Description, Color picker (8 preset colors), live preview, Save button.
- New `+ افزودن ژانر` button next to `+ افزودن برنامه` in Dashboard header (`isAdmin`-gated).
- New `customGenres` state in Home + `loadCustomGenres()` / `saveCustomGenres()` helpers using `localStorage['bankresaneh_custom_genres_v1']`.
- On mount, restores saved custom genres and merges with default `GENRES`. The merged `genres` array is passed down to `DrawerMenu`, `MobileBottomNav`, `Dashboard`, `AddEditView` (so custom genres appear in the drawer, mobile sheet, dashboard cards, and AddEditView category dropdown).
- Verified: created a "مستند تاریخی" genre → it appears as the 21st card, persists across reload, and is selectable in the AddEditView category dropdown.

### 2. Add button in ProgramsView (genre header)
- New `onAdd?: () => void` prop on `ProgramsView`. When in a genre view + `canEdit`, renders a `+ افزودن برنامه` button next to the genre title.
- New `presetCategory` + `presetGenre` state in Home. `handleAddFromGenre(g)` sets these then navigates to `add`.
- `AddEditView` accepts `presetCategory?: string` and `presetGenre?: Genre | null`. When opening fresh, the `category` field is initialized to `presetCategory`.
- Verified: opening add from interview genre shows `تاک‌شوی مصاحبه‌محور` pre-selected in the category dropdown.

### 3. Three new genre cards (appended to `GENRES`)
- `psa` — PSA (پیام خدمت عمومی) — `#0891b2` — `s.category.includes('PSA') || s.category.includes('پیام خدمت')`.
- `deepobs` — پایش تحلیلی — `#7c3aed` — `s.category.includes('پایش تحلیلی')`.
- `ads` — آگهی‌های تبلیغاتی — `#ea580c` — `s.category.includes('آگهی')`.
- Total genres now 20 (was 17).

### 4. Islamic countries filter
- New `ISLAMIC_COUNTRIES` array (40 Persian country names: ایران، ترکیه، عربستان، پاکستان، مالزی، اندونزی، آذربایجان etc.).
- New `detectCountries(show)` using a word-boundary regex against `descriptionFa + summary + country`.
- New `country?: string` field on `TalkShow`. New "کشور مبدا" input in `AddEditView`.
- New `islamicOnly` state + `🌍 اسلامی` toggle button in `ProgramsView` actions row. When on, filters shows by `detectCountries(show).length > 0`.
- Verified: toggling on "همهٔ برنامه‌ها" filters from 560 → ~10 shows from Turkey, Kuwait, Singapore, Iran.

### 5. Tags system
- New `tags?: string[]` field on `TalkShow`.
- New `TagsEditor` component: comma-separated input (splits on `,` and Persian `،`), Enter-to-add, removable purple pills with `×`, "پاک کردن همه" clear button, preset quick-add toggle buttons.
- Wired into `AddEditView` (between image gallery editor and video links editor).
- `ProgramCard` shows `show.tags` as purple `#tag` badges (up to 4) below the summary.
- `ProgramListRow` shows them inline (up to 3).
- `ShowDetailsModal` has a "🏷 برچسب‌ها" section showing all tags + detected Islamic countries + the explicit `country` field.
- ProgramsView search includes the `tags` array.
- New `presetTags?: string[]` field on `Genre` — each genre has 5-6 preset tags. `AddEditView` shows them as toggleable quick-add buttons when `presetGenre` is set.

### 6. Related programs
- New `findRelated(show, allShows, limit=6)` function with the specified scoring:
  - same category +5
  - same layout +3
  - shared elements Jaccard (intersection/union × 3, rounded)
  - same style +2
  - same effects +2
  - same country +2
  - same size +1
  - same viewers +1
  - Filters to score > 0, sorts desc, takes top `limit`.
- `ShowDetailsModal` now accepts `allShows?: TalkShow[]` and `onSwapShow?: (s: TalkShow) => void`. Renders a "🔗 برنامه‌های مرتبط" section at the bottom — horizontally-scrollable row of related program mini-cards (180px wide, real image + name + truncated category). Clicking one swaps the modal to that show.
- Home passes `talkShows` as `allShows` and `setSelectedShow` as `onSwapShow`.
- Verified: opening "CMI The Chris Myers Interview" shows 6 related interview shows (Hollywood Decoded, Steve Austin: The Broken Skull Sessions, Rural America Live, America In Black, Fern Britton Meets…, Koffee with Karan).

### 7. Section-specific tags
- New `TagSpec` type `{ id: string; label: (s: TalkShow) => string | null }` and new `tags?: TagSpec[]` field on `Genre`.
- New `TAG_LIBRARY` with 9 reusable specs: `style`, `size`, `viewers`, `layout`, `effects`, `elements`, `materials`, `colors`, `lighting`.
- New `DEFAULT_GENRE_TAGS = [style, size, viewers]` (decor view fallback).
- Each of the 20 genres has 2-3 specs assigned (interview: `[layout, viewers]`; comedy: `[style, effects]`; news: `[style, lighting]`; panel: `[layout, size]`; morning: `[size, viewers]`; deepobs: `[style, lighting, materials]`; etc.).
- New `renderGenreTags(show, genre)` returns labels for all specs whose label is non-null.
- `ProgramCard` and `ProgramListRow` accept an optional `genre?: Genre | null` prop (passed from `ProgramsView`) and render the section-specific tags as small white badges alongside the user-defined purple tags.

### 8. Section-specific search
- New `searchFields?: (keyof TalkShow)[]` field on `Genre`. Each genre has its own search fields:
  - decor: `['name','summary','materials','colors']`
  - news: `['name','summary','descriptionFa','category']`
  - panel: `['name','summary','category','layout']`
  - deepobs: `['name','summary','descriptionFa','materials']`
  - etc.
- In `ProgramsView` search, falls back to `['name','summary','category']` if `genre?.searchFields` is undefined. Handles both string fields (`v.toLowerCase().includes(q) || v.includes(search)` — to support both English-lowercase and Persian original) and array fields (`tags`).

## Build & verification (per task spec)

```bash
cd /home/z/my-project
pkill -9 -f "next" 2>/dev/null
pkill -9 -f "api-service" 2>/dev/null
sleep 2
rm -rf .next
NODE_ENV=production timeout 120 npx next build --webpack 2>&1 | tail -5
cp -r .next/static .next/standalone/.next/ 2>/dev/null
cp -r public .next/standalone/ 2>/dev/null
# Start API service
setsid bash -c 'cd /home/z/my-project/mini-services/api-service && bun --hot index.js' </dev/null >/tmp/api.log 2>&1 &
disown
sleep 3
# Start frontend
mkdir -p .zscripts
start-stop-daemon --start --background --make-pidfile --pidfile /home/z/my-project/.zscripts/app.pid --exec /usr/bin/node -- /home/z/my-project/.next/standalone/server.js
sleep 5
curl -s -o /dev/null -w "API: HTTP %{http_code}\n" http://localhost:3002/api/health --max-time 5   # → 200
curl -s -o /dev/null -w "Frontend: HTTP %{http_code}\n" http://localhost:3000/ --max-time 10        # → 200
```

- `next build` → ✓ Compiled successfully in 7.7s.
- `POST /api/auth/login {admin/admin}` → returns token + user `{id:1,username:"admin",role:"admin",name:"مدیر سیستم"}`.
- **agent-browser end-to-end** (all 7 checklist items):
  1. ✅ Login with admin/admin → dashboard renders with 21 genres (17 + 3 new + 1 custom).
  2. ✅ Dashboard has "+ افزودن ژانر" button (admin-only) AND "+ افزودن برنامه" button.
  3. ✅ Dashboard shows PSA, پایش تحلیلی, آگهی‌های تبلیغاتی cards with their distinct colors.
  4. ✅ Open "تاک‌شوی مصاحبه‌محور" → hero card has "+ افزودن برنامه" button next to genre title → clicking opens AddEditView with `تاک‌شوی مصاحبه‌محور` pre-selected in category dropdown.
  5. ✅ Open a program → modal renders "🔗 برنامه‌های مرتبط" section with 6 horizontally-scrollable related cards.
  6. ✅ ProgramsView has "🌍 اسلامی" toggle button → toggling filters to shows mentioning Islamic countries (verified: shows from Turkey, Kuwait, Singapore, Iran appear).
  7. ✅ Program cards show tags — small white genre-specific badges (style/size/layout/viewers etc.) + purple `#tag` user-defined badges.
- Also verified: AddGenreModal flow (filled "مستند تاریخی" → preview shows the genre name + chosen color → Save → genre appears as the 21st card with 0 programs → reload persists it via localStorage). ✓
- Also verified: TagsEditor in AddEditView — preset quick-add buttons for the interview genre ("+ مصاحبه اختصاصی", "+ مهمان ویژه", "+ تکنولوژی", "+ استودیو", "+ مدرن", "+ گریل"). ✓

## Lint

9 errors + 3 warnings, ALL pre-existing in the original repo's `page.tsx` (setState-in-effect at lines 635/652/666, refs-during-render at line 3495) and the worker/electron files. My changes added zero new lint issues. Build proceeds cleanly via `next.config.ts`'s `typescript.ignoreBuildErrors: true`.

## Running services

- API on port 3002 (setsid background, log in `/tmp/api.log`).
- Frontend standalone on port 3000 (start-stop-daemon, PID in `.zscripts/app.pid`).
