import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const rawUrl = body && typeof body.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) {
      return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: 'آدرس URL معتبر نیست' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || !target.hostname) {
      return NextResponse.json({ error: 'آدرس URL مجاز نیست' }, { status: 400 });
    }
    if (await isPrivateOrLocalHost(target.hostname)) {
      return NextResponse.json({ error: 'دسترسی به آدرس‌های داخلی مجاز نیست' }, { status: 400 });
    }

    // Redirects are deliberately not followed; a public URL could redirect to an internal service.
    const res = await fetch(target.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json({ error: 'تغییر مسیر این آدرس پشتیبانی نمی‌شود' }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'صفحه یافت نشد' }, { status: 404 });
    }
    if (!(res.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
      return NextResponse.json({ error: 'آدرس باید یک صفحه HTML باشد' }, { status: 415 });
    }
    if (Number(res.headers.get('content-length') || 0) > MAX_HTML_BYTES) {
      return NextResponse.json({ error: 'حجم صفحه بیش از حد مجاز است' }, { status: 413 });
    }

    const html = await readLimitedText(res, MAX_HTML_BYTES);
    const info: Record<string, string> = {};

    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitle) info.title = decodeHtml(ogTitle[1]);

    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (ogDesc) info.description = decodeHtml(ogDesc[1]);

    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage) {
      try {
        info.image = new URL(decodeHtml(ogImage[1]), target).toString();
      } catch {
        // Ignore malformed image metadata.
      }
    }

    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (pageTitle && !info.title) info.title = decodeHtml(pageTitle[1].trim());

    const host = target.hostname.toLowerCase();
    if (host === 'imdb.com' || host.endsWith('.imdb.com')) {
      const rating = html.match(/"ratingValue"\s*:\s*"([\d.]+)"/);
      if (rating) info.rating = rating[1];
      const genres = html.match(/"genre"\s*:\s*\[([^\]]+)\]/);
      if (genres) info.genres = genres[1].replace(/"/g, '').split(',').map((g: string) => g.trim()).join('، ');
      const year = html.match(/"datePublished"\s*:\s*"(\d{4})/);
      if (year) info.year = year[1];
      const runtime = html.match(/"duration"\s*:\s*"PT(\d+)M"/);
      if (runtime) info.duration = `${runtime[1]} دقیقه`;
    }

    if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) {
      const firstPara = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (firstPara) {
        const cleanText = firstPara[1].replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').trim();
        if (cleanText.length > 20) info.description = cleanText.substring(0, 500);
      }
    }

    if (!info.title && !info.description) {
      return NextResponse.json({ error: 'اطلاعات قابل استخراج نیست' }, { status: 404 });
    }
    return NextResponse.json({ info });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'دریافت اطلاعات بیش از حد طول کشید' }, { status: 504 });
    }
    if (error instanceof Error && error.message === 'HTML_LIMIT_EXCEEDED') {
      return NextResponse.json({ error: 'حجم صفحه بیش از حد مجاز است' }, { status: 413 });
    }
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات' }, { status: 500 });
  }
}

async function isPrivateOrLocalHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }

  const isPrivateIp = (address: string): boolean => {
    const version = isIP(address);
    if (version === 4) {
      const p = address.split('.').map(Number);
      return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
        (p[0] === 169 && p[1] === 254) ||
        (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 192 && p[1] === 168) ||
        (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
    }
    if (version === 6) {
      const ip = address.toLowerCase();
      return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
        ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
        ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') ||
        ip.startsWith('::ffff:192.168.') || ip.startsWith('::ffff:169.254.');
    }
    return false;
  };

  if (isIP(host)) return isPrivateIp(host);
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address));
  } catch {
    return true;
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('HTML_LIMIT_EXCEEDED');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}
