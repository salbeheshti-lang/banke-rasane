import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads');
const LOGO_FILE = path.join(LOGO_DIR, 'logo.png');

/**
 * POST /api/settings/logo
 * Accepts a multipart/form-data upload with a single `file` field (image).
 * Persists the file to public/uploads/logo.png so it is:
 *   - served directly via /uploads/logo.png (for the in-app preview), and
 *   - read by /api/export-pdf to inline as base64 in the generated PDF.
 *
 * Returns JSON: { ok, path, url } on success.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'فایلی ارسال نشده است' }, { status: 400 });
    }

    // Basic size/type sanity check (allow up to ~5MB, image/* only).
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
      return NextResponse.json({ ok: false, error: 'حجم فایل بیش از ۵ مگابایت است' }, { status: 413 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'فقط فایل تصویری مجاز است' }, { status: 415 });
    }

    if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(LOGO_FILE, buf);

    return NextResponse.json({
      ok: true,
      path: LOGO_FILE,
      url: '/uploads/logo.png',
      size: buf.length,
    });
  } catch (error) {
    console.error('logo upload error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
