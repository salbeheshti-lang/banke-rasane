import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { gatePermissionAny } from '@/lib/server-auth';
import { db } from '@/lib/db';
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

// === Rate limiter (ATOMIC, persistent, per user) ===
// Limits: 10 requests per 60 seconds per user. Bursts up to 10 are allowed.
//
// WHY updateMany (not $transaction)?
//   The previous implementation did read-modify-write on a JSON file with
//   fs.readFileSync/fs.writeFileSync. While synchronous (single-process
//   safe), it was NOT atomic across:
//     1. Multi-process deployments (cluster/PM2) — lost increments.
//     2. Crash-during-write — fs.writeFileSync is not atomic; a crash
//        mid-write truncates the file and loses ALL users' state.
//
//   We first tried Prisma's interactive db.$transaction, but Prisma + SQLite
//   interactive transactions suffer from P1008 socket timeouts under
//   concurrent load (the BEGIN IMMEDIATE lock acquisition exceeds Prisma's
//   internal query timeout). So we switched to a single-statement approach:
//
//   `updateMany` with a WHERE clause compiles to a single atomic SQL UPDATE:
//     UPDATE ... SET count = count + 1
//     WHERE key = ? AND count < 10 AND resetAt > now
//   SQLite serializes writes at the file level, so this UPDATE is atomic: two
//   concurrent requests cannot both see count=9 and both increment to 10.
//   Exactly one will affect 1 row (allowed), the other will affect 0 rows
//   (then falls through to the limit-reached path). This is correct.
//
//   The bucket persists in the app DB (survives restarts and crashes).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

async function checkRateLimit(
  userId: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = Date.now();
  const nowBig = BigInt(now);
  const windowReset = BigInt(now + RATE_LIMIT_WINDOW_MS);

  try {
    // Step 1: ensure the bucket exists (idempotent). If it doesn't, this
    // creates it with count=0. If it does, this is a no-op (empty update).
    await db.translationRateBucket.upsert({
      where: { key: userId },
      create: { key: userId, count: 0, resetAt: windowReset },
      update: {},
    });

    // Step 2: atomic increment — only succeeds if under limit AND window
    // not expired. This is a single SQL UPDATE, atomic at the SQLite level.
    const updated = await db.translationRateBucket.updateMany({
      where: {
        key: userId,
        count: { lt: RATE_LIMIT_MAX },
        resetAt: { gt: nowBig },
      },
      data: { count: { increment: 1 } },
    });

    if (updated.count === 1) {
      return { ok: true }; // incremented successfully
    }

    // Step 3: updateMany affected 0 rows → either limit reached or window
    // expired. Read the current state to decide.
    const bucket = await db.translationRateBucket.findUnique({
      where: { key: userId },
    });

    if (!bucket) {
      // Should not happen (we just upserted), but handle defensively:
      // create a fresh bucket and allow.
      await db.translationRateBucket.upsert({
        where: { key: userId },
        create: { key: userId, count: 1, resetAt: windowReset },
        update: { count: 1, resetAt: windowReset },
      });
      return { ok: true };
    }

    // Window expired → reset and allow this request.
    if (bucket.resetAt <= nowBig) {
      await db.translationRateBucket.update({
        where: { key: userId },
        data: { count: 1, resetAt: windowReset },
      });
      return { ok: true };
    }

    // Limit reached → reject.
    return {
      ok: false,
      retryAfter: Math.ceil((Number(bucket.resetAt) - now) / 1000),
    };
  } catch (e) {
    // If the DB is unavailable (disk full, locked beyond retries), fail
    // OPEN for availability — the translation still requires a valid
    // permission check above, so this is not an auth bypass. Same fail-open
    // behavior as the previous JSON implementation.
    console.error('[translate] rate-limit DB error, failing open:', e);
    return { ok: true };
  }
}

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
  const user = gate.user;

  // --- 2. Rate limit (persistent, survives restart) ---
  const rl = await checkRateLimit(String(user.id));
  if (!rl.ok) {
    return NextResponse.json(
      { error: `محدودیت ترجمه: ${rl.retryAfter} ثانیه صبر کنید` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
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



