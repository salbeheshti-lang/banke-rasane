import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { gatePermission } from '@/lib/server-auth';
import { getDataFile } from '@/lib/data-dir';

export const runtime = 'nodejs';

// Custom logos are written to the writable data directory (NOT public/uploads,
// which is read-only under Program Files on Windows). The data dir resolves to:
//   - Electron production: %APPDATA%\banke-rasane\
//   - Dev mode: project root /data
const LOGO_FILE = getDataFile('logo.png');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;

/**
 * POST /api/settings/logo
 * Accepts an image upload and normalizes it to PNG so the saved filename,
 * preview URL, and data URL embedded in the PDF all use the same encoding.
 *
 * Auth: requires manage_settings permission (admin-only by default).
 */
export async function POST(request: NextRequest) {
  // --- Auth: only admins (manage_settings permission) can replace the logo ---
  const gate = await gatePermission(request, 'manage_settings');
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به دسترسی مدیر' }, { status: gate.status });
  }
  const admin = gate.user;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'فایلی ارسال نشده است' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'فایل تصویری خالی است' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: 'حجم فایل بیش از ۵ مگابایت است' }, { status: 413 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    let imageWidth = 0;
    let imageHeight = 0;
    try {
      // Validate the actual image bytes, not the client-supplied MIME type.
      // Keep only the dimensions needed here; Sharp 0.35 no longer exports
      // the old namespace-style sharp.Metadata type.
      const metadata = await sharp(input, {
        limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
      }).metadata();
      imageWidth = metadata.width ?? 0;
      imageHeight = metadata.height ?? 0;
    } catch {
      return NextResponse.json({ ok: false, error: 'فایل تصویری معتبر نیست' }, { status: 415 });
    }

    if (!imageWidth || !imageHeight ||
        imageWidth > MAX_IMAGE_DIMENSION || imageHeight > MAX_IMAGE_DIMENSION) {
      return NextResponse.json(
        { ok: false, error: 'ابعاد تصویر باید حداکثر ۴۰۹۶ در ۴۰۹۶ پیکسل باشد' },
        { status: 413 }
      );
    }

    // Normalize JPEG, WebP, etc. into a valid PNG file.
    const png = await sharp(input, {
      limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    }).rotate().png().toBuffer();

    // Ensure the parent directory of LOGO_FILE exists (it may not on
    // first run, especially when LOGO_FILE is in the writable data dir).
    const logoDir = path.dirname(LOGO_FILE);
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
    const temporaryFile = `${LOGO_FILE}.tmp`;
    fs.writeFileSync(temporaryFile, png);
    fs.renameSync(temporaryFile, LOGO_FILE);

    return NextResponse.json({
      ok: true,
      path: LOGO_FILE,
      url: '/uploads/logo.png',
      size: png.length,
    });
  } catch (error) {
    console.error('logo upload error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}