import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
export const runtime = 'nodejs';

// Translation endpoint for the BankResaneh show editor.
//
// Design principles (per the user's spec):
//   1. Server-side only — the SDK key never leaves the server.
//   2. Auto-detect source language (English, Arabic, Turkish, French, German,
//      etc.) — the model handles detection; we just ask for a Persian output.
//   3. Preserve proper nouns: person names, network names, IMDb/Wikipedia
//      URLs, and the original title are NOT translated.
//   4. Never clobber — the endpoint returns the translated fields; the
//      frontend decides whether to apply them (with a preview + user
//      confirmation). No writes happen here.
//   5. Single LLM call — we send all fields to the model in one request
//      (as a JSON object) and ask it to return a JSON object with the
//      translations. This is ~5x cheaper and faster than calling the model
//      once per field, and avoids rate-limit issues.
//
// Input:  { fields: { name?, summary?, descriptionFa?, elements?, ... } }
// Output: { translations: { ... }, warnings: string[] }

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TranslateRequest;
    const fields = body?.fields || {};
    if (typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'fields object is required' }, { status: 400 });
    }

    // Partition fields into:
    //   - toTranslate: non-empty string fields that are not in PRESERVED_FIELDS
    //     and not the original title (if PRESERVE_ORIGINAL_TITLE is on).
    //   - preserved: everything else (returned as-is).
    const toTranslate: Record<string, string> = {};
    const translations: Record<string, string> = {};
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value !== 'string' || !value.trim()) continue;
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

    // Single LLM call: send all fields as a JSON object, ask for JSON back.
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

    const raw = completion.choices[0]?.message?.content?.trim() || '';

    // The model should return a JSON object. Strip any markdown fences if present.
    let cleaned = raw;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    }

    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // The model didn't return valid JSON. Fall back to returning the original
      // text for each field with a warning.
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

    // Merge parsed translations back; for any field the model skipped, keep original.
    for (const [key, value] of Object.entries(toTranslate)) {
      const translated = parsed[key];
      if (typeof translated === 'string' && translated.trim()) {
        translations[key] = translated.trim();
      } else {
        translations[key] = value;
        warnings.push(`field "${key}": model did not translate; kept original`);
      }
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
