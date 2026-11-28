import { NextRequest, NextResponse } from 'next/server';
import { gatePermissionAny, getApiBaseForRequest } from '@/lib/server-auth';
export const runtime = 'nodejs';

// Translation endpoint for the BankResaneh show editor.
//
// Security design (per Phase 2 audit + Phase 1 hardening):
//   1. Authentication + permission required — caller must have either
//      `add_shows` OR `edit_shows` permission (admin/editor by default).
//      Viewers cannot use the translation service (they can't edit shows
//      anyway, so translating makes no sense and would waste the LLM quota).
//   2. Rate limited — per-user PERSISTENT token bucket: max 10 requests /
//      minute. Stored on disk so it survives server restarts (previous
//      in-memory Map was lost on every restart, allowing bypass).
//   3. Input size capped — max 25 fields per request, max 5 000 chars per
//      field, max 100 KB total payload (measured in UTF-8 BYTES, not
//      characters — Persian text is 2 bytes/char so the previous
//      `raw.length` check was effectively 2x too lenient).
//   4. Output sanity-checked — the model's response must be valid JSON
//      with string values containing at least one Persian/Arabic character.
//   5. Server-side only — the SDK key never reaches the client.
//   6. Auto-detect source language — the model handles detection.
//   7. Preserve proper nouns: original title, URLs, IDs, and image fields
//      are never translated.
//   8. Never clobber — the endpoint only RETURNS translations; it never
//      writes to the DB. The frontend shows a preview before applying.

interface TranslateRequest {
  fields: Record<string, string>;
}

// Fields that should NEVER be translated (URLs, IDs).
const PRESERVED_FIELDS = new Set([
  'youtube', 'imdb', 'wikipedia', 'socialPost', 'num', 'source', 'images',
  'videos', 'tags', 'isFilm', 'imageSource', 'country',
]);

// The original title is preserved by convention — the user explicitly said
// "عنوان اصلی تغییر نکند" (the original title must not change).
const PRESERVE_ORIGINAL_TITLE = true;

// === Input validation caps ===
const MAX_FIELDS = 25;
const MAX_FIELD_CHARS = 5000;
const MAX_TOTAL_BYTES = 100 * 1024; // 100 KB (in UTF-8 bytes, not chars)

// === Output sanity check: must contain at least one Persian/Arabic letter ===
// Catches the case where the model returns English text, echoes the system
// prompt, or fails silently. Persian/Arabic Unicode ranges:
//   Arabic:        U+0600–U+06FF
//   Arabic Supplement: U+0750–U+077F
//   Arabic Presentation Forms-B: U+FE70–U+FEFF
const PERSIAN_RE = /[\u0600-\u06FF\u0750-\u077F\uFE70-\uFEFF]/;

export async function POST(request: NextRequest) {
  // --- 1. Authentication + permission ---
  // Only users who can edit/add shows should be able to translate them.
  // Previously this endpoint required only `requireUser`, which let viewers
  // consume the LLM quota — a cost-amplification vector.
  const gate = await gatePermissionAny(request, 'add_shows', 'edit_shows');
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به مجوز ویرایش برنامه' }, { status: gate.status });
  }
  const apiBase = getApiBaseForRequest(request);
  if (!apiBase) return NextResponse.json({ error: 'سرور انتخاب‌شده در فهرست سرورهای مجاز نیست' }, { status: 403 });

  // The selected API service owns the durable SQLite bucket. This avoids
  // a second, frontend-host-local database and keeps rate limits consistent
  // when users switch between their own API servers.
  const authorization = request.headers.get('Authorization') || '';
  let rateResponse: Response;
  try {
    rateResponse = await fetch(apiBase + '/api/rate-limit/translate', {
      method: 'POST',
      headers: { Authorization: authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return NextResponse.json({ error: 'سرویس محدودیت ترجمه در سرور انتخاب‌شده در دسترس نیست' }, { status: 503 });
  }
  if (!rateResponse.ok) {
    const payload = await rateResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: payload.error || 'محدودیت ترجمه اعمال شد' },
      { status: rateResponse.status, headers: rateResponse.headers.get('Retry-After') ? { 'Retry-After': rateResponse.headers.get('Retry-After')! } : undefined }
    );
  }

  try {
    // --- 3. Parse + validate input ---
    const raw = await request.text();
    // CRITICAL FIX: measure in UTF-8 BYTES, not characters.
    // Persian text is 2 bytes/char in UTF-8, so `raw.length` (which counts
    // chars) was effectively allowing 2x the stated limit. Use
    // Buffer.byteLength for an accurate byte count.
    const rawBytes = Buffer.byteLength(raw, 'utf8');
    if (rawBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: `حجم درخواست بیش از حد است (حداکثر ${MAX_TOTAL_BYTES} بایت، ارسال‌شده: ${rawBytes} بایت)` },
        { status: 413 }
      );
    }
    let body: TranslateRequest;
    try {
      body = JSON.parse(raw) as TranslateRequest;
    } catch {
      return NextResponse.json({ error: 'JSON نامعتبر' }, { status: 400 });
    }

    const fields = body?.fields || {};
    if (typeof fields !== 'object' || Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields باید یک object باشد' }, { status: 400 });
    }
    const fieldKeys = Object.keys(fields);
    if (fieldKeys.length === 0) {
      return NextResponse.json({ error: 'fields object is required' }, { status: 400 });
    }
    if (fieldKeys.length > MAX_FIELDS) {
      return NextResponse.json(
        { error: `تعداد فیلدها بیش از حد است (حداکثر ${MAX_FIELDS} فیلد)` },
        { status: 400 }
      );
    }

    // --- 4. Partition fields into translate vs. preserved ---
    const toTranslate: Record<string, string> = {};
    const translations: Record<string, string> = {};
    const warnings: string[] = [];

    for (const key of fieldKeys) {
      const value = fields[key];
      if (typeof value !== 'string') continue;
      if (value.length > MAX_FIELD_CHARS) {
        warnings.push(`field "${key}": طول بیش از حد (${value.length} > ${MAX_FIELD_CHARS}); نادیده گرفته شد`);
        continue;
      }
      if (!value.trim()) continue;
      if (PRESERVED_FIELDS.has(key)) continue;
      if (key === 'name' && PRESERVE_ORIGINAL_TITLE) {
        translations[key] = value;
        continue;
      }
      toTranslate[key] = value;
    }

    if (Object.keys(toTranslate).length === 0) {
      return NextResponse.json({
        translations,
        warnings,
        translatedCount: 0,
        preservedFields: Array.from(PRESERVED_FIELDS),
        originalTitlePreserved: PRESERVE_ORIGINAL_TITLE,
      });
    }

    // --- 5. Free external translation fallback (no private API key) ---
    // MyMemory's public endpoint accepts autodetect|fa. Text is sent to this
    // third-party service; callers are authenticated and rate-limited above.
    // Keep original values whenever the service is unavailable or rejects a result.
    const parsed: Record<string, string> = {};
    const entries = Object.entries(toTranslate);
    for (const [key, value] of entries) {
      try {
        const params = new URLSearchParams({
          q: value,
          langpair: 'autodetect|fa',
        });
        const response = await fetch(
          `https://api.mymemory.translated.net/get?${params.toString()}`,
          { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } }
        );
        if (!response.ok) {
          warnings.push(`field "${key}": سرویس ترجمه پاسخ نداد؛ متن اصلی حفظ شد`);
          continue;
        }
        const payload = await response.json() as {
          responseStatus?: number;
          responseData?: { translatedText?: string };
        };
        const translated = payload.responseData?.translatedText?.trim() || '';
        if (payload.responseStatus !== 200 || !translated || !PERSIAN_RE.test(translated)) {
          warnings.push(`field "${key}": ترجمه معتبر دریافت نشد؛ متن اصلی حفظ شد`);
          continue;
        }
        parsed[key] = translated;
      } catch {
        warnings.push(`field "${key}": سرویس ترجمه در دسترس نیست؛ متن اصلی حفظ شد`);
      }
    }

    // --- 6. Merge + output sanity check ---
    for (const [key, value] of Object.entries(toTranslate)) {
      const translated = parsed[key];
      if (typeof translated !== 'string' || !translated.trim()) {
        translations[key] = value;
        warnings.push(`field "${key}": model did not translate; kept original`);
        continue;
      }
      // Reject translations that contain NO Persian/Arabic characters —
      // this catches cases where the model returned English, echoed the
      // system prompt, or returned garbage. Keep the original instead.
      if (!PERSIAN_RE.test(translated)) {
        translations[key] = value;
        warnings.push(`field "${key}": translation contained no Persian text; kept original`);
        continue;
      }
      translations[key] = translated.trim();
    }

    return NextResponse.json({
      translations,
      warnings,
      translatedCount: Object.keys(translations).length,
      preservedFields: Array.from(PRESERVED_FIELDS),
      originalTitlePreserved: PRESERVE_ORIGINAL_TITLE,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[translate] endpoint error:', msg);
    return NextResponse.json(
      { error: 'Translation service unavailable: ' + msg },
      { status: 500 }
    );
  }
}



