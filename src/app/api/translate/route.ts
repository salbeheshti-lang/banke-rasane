import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
export const runtime = 'nodejs';

// Translation endpoint for the BankResaneh show editor.
//
// Security design (per Phase 2 audit):
//   1. Authentication required — caller must send a valid BankResaneh
//      session token (Authorization: Bearer <token>). The endpoint proxies
//      the auth check through the Bun API service's /api/auth/me endpoint,
//      so the SDK key never leaves the server AND we reuse the existing
//      session infrastructure rather than duplicating it.
//   2. Rate limited — per-user in-memory token bucket: max 10 requests /
//      minute, bursts allowed. Prevents denial-of-wallet attacks against
//      the project's z-ai-web-dev-sdk quota.
//   3. Input size capped — max 25 fields per request, max 5 000 chars per
//      field, max 100 KB total payload. Rejects payloads that would
//      otherwise forward megabytes to the LLM provider.
//   4. Output sanity-checked — the model's response must be valid JSON
//      with string values; if a value contains no Persian/Arabic script
//      characters at all (i.e. the model returned English or echoed the
//      system prompt), we keep the original text instead.
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

// === Rate limiter (in-memory token bucket, per user) ===
// Limits: 10 requests per 60 seconds per user. Bursts up to 10 are allowed.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
// Garbage-collect stale buckets every 5 minutes to prevent memory growth.
let lastGcAt = Date.now();
function gcRateBuckets() {
  const now = Date.now();
  if (now - lastGcAt < 5 * 60 * 1000) return;
  for (const [k, b] of rateBuckets) {
    if (b.resetAt < now) rateBuckets.delete(k);
  }
  lastGcAt = now;
}
function checkRateLimit(userId: string): { ok: true } | { ok: false; retryAfter: number } {
  gcRateBuckets();
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

// === Auth proxy: validate the caller's session via the Bun API service ===
// Returns the user object on success, or null on failure.
// We use /api/auth/me (which reads the Authorization header) so we don't
// have to duplicate the session-table logic in Next.js.
const API_BASE = process.env.BANKRESANEH_API_BASE || 'http://127.0.0.1:3002';
interface AuthUser { id: number; username: string; role: string; isSuperAdmin?: boolean; }
async function authenticate(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const r = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: auth },
      // Short timeout so a down API service doesn't hang the translate request.
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const u = await r.json() as AuthUser;
    if (!u || typeof u.id !== 'number') return null;
    return u;
  } catch {
    return null;
  }
}

// === Input validation caps ===
const MAX_FIELDS = 25;
const MAX_FIELD_CHARS = 5000;
const MAX_TOTAL_BYTES = 100 * 1024; // 100 KB

// === Output sanity check: must contain at least one Persian/Arabic letter ===
// Catches the case where the model returns English text, echoes the system
// prompt, or fails silently. Persian/Arabic Unicode ranges:
//   Arabic:        U+0600–U+06FF
//   Arabic Supplement: U+0750–U+077F
//   Arabic Presentation Forms-B: U+FE70–U+FEFF
const PERSIAN_RE = /[\u0600-\u06FF\u0750-\u077F\uFE70-\uFEFF]/;

export async function POST(request: NextRequest) {
  // --- 1. Authentication ---
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 });
  }

  // --- 2. Rate limit ---
  const rl = checkRateLimit(String(user.id));
  if (!rl.ok) {
    return NextResponse.json(
      { error: `محدودیت ترجمه: ${rl.retryAfter} ثانیه صبر کنید` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    // --- 3. Parse + validate input ---
    const raw = await request.text();
    if (raw.length > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: `حجم درخواست بیش از حد است (حداکثر ${MAX_TOTAL_BYTES} بایت)` },
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

    // --- 5. Single LLM call ---
    const zai = await ZAI.create();
    const fieldsJson = JSON.stringify(toTranslate, null, 2);

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: [
            'You are a professional translator for a Persian-language TV-program archive.',
            'You will receive a JSON object whose values are text in various languages.',
            'Translate each value into fluent, natural Persian (فارسی).',
            '',
            'Rules:',
            '1. Preserve all proper nouns (person names, network names, brand names) in their original form.',
            '2. Preserve all URLs (http://, https://) exactly as-is.',
            '3. Preserve numbers (years, episode counts, ratings) as-is.',
            '4. If a value is already in Persian, return it unchanged.',
            '5. If a value is empty or whitespace-only, return an empty string.',
            '',
            'CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no commentary.',
            'The JSON object must have the EXACT same keys as the input, with translated values.',
            'Example input: {"summary": "Hello world"}',
            'Example output: {"summary": "سلام دنیا"}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: fieldsJson,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim() || '';

    // Strip markdown fences if the model wrapped the JSON in them.
    let cleaned = rawResponse;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      warnings.push('Model did not return valid JSON; all fields kept as original.');
      for (const [key, value] of Object.entries(toTranslate)) {
        translations[key] = value;
      }
      return NextResponse.json({
        translations,
        warnings,
        translatedCount: Object.keys(translations).length,
        preservedFields: Array.from(PRESERVED_FIELDS),
        originalTitlePreserved: PRESERVE_ORIGINAL_TITLE,
      });
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


