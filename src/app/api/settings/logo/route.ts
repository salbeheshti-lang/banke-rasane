import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { requirePermission } from '@/lib/server-auth';

export const runtime = 'nodejs';

const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads');
const LOGO_FILE = path.join(LOGO_DIR, 'logo.png');
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
  const admin = await requirePermission(request, 'manage_settings');
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'دسترسی غیرمجاز — نیاز به دسترسی مدیر' }, { status: 403 });
  }
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
    let metadata: sharp.Metadata;
    try {
      // Validate the actual image bytes, not the client-supplied MIME type.
      metadata = await sharp(input, {
        limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
      }).metadata();
    } catch {
      return NextResponse.json({ ok: false, error: 'فایل تصویری معتبر نیست' }, { status: 415 });
    }

    if (!metadata.width || !metadata.height ||
        metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      return NextResponse.json(
        { ok: false, error: 'ابعاد تصویر باید حداکثر ۴۰۹۶ در ۴۰۹۶ پیکسل باشد' },
        { status: 413 }
      );
    }

    // Normalize JPEG, WebP, etc. into a valid PNG file.
    const png = await sharp(input, {
      limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    }).rotate().png().toBuffer();

    if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });
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
