import { NextRequest, NextResponse } from 'next/server';
import { gatePermissionAny } from '@/lib/server-auth';

export const runtime = 'nodejs';

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_HOSTS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'upload.wikimedia.org',
  'images.unsplash.com',
  'i.imgur.com',
  'cdn.pixabay.com',
  'images.pexels.com',
  'image.tmdb.org',
  'media.themoviedb.org',
  'static.wikia.nocookie.net',
  'ichef.bbci.co.uk',
  'media.cnn.com',
  'cdn.cnn.com',
]);

function isAllowedImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const gate = await gatePermissionAny(request, 'add_shows', 'edit_shows');
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به دسترسی افزودن یا ویرایش برنامه' },
      { status: gate.status },
    );
  }

  try {
    const body = await request.json();
    if (typeof body?.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ error: 'لینک تصویر الزامی است' }, { status: 400 });
    }

    let target = isAllowedImageUrl(body.url.trim());
    if (!target) {
      return NextResponse.json({
        error: 'دامنهٔ این لینک برای دریافت امن تصویر پشتیبانی نمی‌شود؛ لینک مستقیم از IMDb یا Wikimedia را وارد کنید.',
      }, { status: 400 });
    }

    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
      response = await fetch(target.href, {
        headers: {
          'User-Agent': 'BankResaneh/2.0 (image import)',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === 3) {
          return NextResponse.json({ error: 'مسیر انتقال لینک تصویر معتبر نیست' }, { status: 502 });
        }
        const redirected = isAllowedImageUrl(new URL(location, target).href);
        if (!redirected) {
          return NextResponse.json({ error: 'مسیر انتقال تصویر به دامنهٔ تأییدنشده انجام می‌شود' }, { status: 400 });
        }
        target = redirected;
        continue;
      }
      break;
    }

    if (!response?.ok) {
      return NextResponse.json({ error: 'دریافت تصویر از منبع ناموفق بود' }, { status: 502 });
    }

    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mime)) {
      return NextResponse.json({ error: 'لینک واردشده به فایل تصویر مستقیم اشاره نمی‌کند' }, { status: 415 });
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'حجم تصویر بیشتر از ۵ مگابایت است' }, { status: 413 });
    }

    const source = Buffer.from(await response.arrayBuffer());
    if (!source.length || source.length > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'حجم تصویر نامعتبر یا بیشتر از ۵ مگابایت است' }, { status: 413 });
    }

    let output: Buffer;
    try {
      const sharp = (await import('sharp')).default;
      output = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(1200, 1800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: 'فایل دریافت‌شده تصویر معتبر یا قابل پردازش نیست' }, { status: 415 });
    }

    if (output.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم تصویر پس از بهینه‌سازی هنوز زیاد است' }, { status: 413 });
    }

    return NextResponse.json({
      dataUrl: 'data:image/webp;base64,' + output.toString('base64'),
      size: output.length,
      source: target.hostname,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.name === 'TimeoutError' ? 'دریافت تصویر بیش از حد طول کشید' : 'خطا در دریافت و پردازش تصویر' },
      { status: 502 },
    );
  }
}
