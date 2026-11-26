import sharp from 'sharp';

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
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
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/webp', 'image/gif', 'image/avif',
  'image/tiff', 'image/x-tiff', 'image/bmp', 'image/x-ms-bmp', 'image/svg+xml', 'image/heic', 'image/heif',
]);

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (!ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function resolvePageImageUrl(pageUrl, fetchImpl) {
  const host = pageUrl.hostname.toLowerCase();
  if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) {
    const firstLabel = host.split('.')[0];
    const lang = host === 'wikipedia.org' || firstLabel === 'www' || firstLabel === 'm' ? 'en' : firstLabel;
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(lang)) return null;
    let title = '';
    if (pageUrl.pathname.startsWith('/wiki/')) {
      try {
        title = decodeURIComponent(pageUrl.pathname.slice('/wiki/'.length).split('/')[0]).replace(/_/g, ' ');
      } catch {
        return null;
      }
    } else {
      title = pageUrl.searchParams.get('title') || pageUrl.searchParams.get('search') || '';
    }
    if (!title.trim()) return null;
    const summaryUrl = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.trim());
    const response = await fetchImpl(summaryUrl, {
      headers: { 'User-Agent': 'BankResaneh/2.0 (image import)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const candidate = data?.originalimage?.source || data?.thumbnail?.source;
    return typeof candidate === 'string' ? isAllowedImageUrl(candidate) : null;
  }

  if (host === 'imdb.com' || host === 'www.imdb.com' || host === 'm.imdb.com') {
    const match = pageUrl.pathname.match(/^\/title\/(tt\d+)/i);
    if (!match) return null;
    const response = await fetchImpl('https://www.imdb.com/title/' + match[1] + '/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const pattern of patterns) {
      const found = html.match(pattern);
      if (!found?.[1]) continue;
      const image = isAllowedImageUrl(decodeHtml(found[1]));
      if (image) return image;
    }
  }
  return null;
}

export async function optimizeImageBuffer(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error('Image source exceeds the 25 MiB limit.');
  const metadata = await sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: 'error' }).metadata();
  if (metadata.format === 'svg') {
    const svg = bytes.toString('utf8');
    if (/<script\b|<foreignObject\b|(?:href|xlink:href)\s*=\s*["'](?:https?:|file:|\/\/)|url\(\s*["']?(?:https?:|file:|\/\/)/i.test(svg)) {
      throw new Error('SVG contains external or executable content.');
    }
  }
  const supportedFormats = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'bmp', 'svg', 'heif', 'jp2', 'jxl', 'magick']);
  if (!metadata.format || !supportedFormats.has(metadata.format)) throw new Error('Unsupported image format.');
  const output = await sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: 'error' })
    .rotate()
    .resize(1200, 1800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  if (output.length > MAX_OUTPUT_BYTES) throw new Error('Optimized image exceeds the 2 MiB output limit.');
  return output;
}

function failure(status, error) {
  return { status, body: { error } };
}

export async function importImageFromUrl(rawUrl, fetchImpl = fetch) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return failure(400, 'لینک تصویر الزامی است');
  let target = isAllowedImageUrl(rawUrl.trim());
  if (!target) {
    let pageUrl;
    try {
      pageUrl = new URL(rawUrl.trim());
    } catch {
      return failure(400, 'لینک تصویر یا صفحهٔ ویکی‌پدیا/IMDb معتبر نیست');
    }
    if (pageUrl.protocol !== 'https:' || pageUrl.username || pageUrl.password || (pageUrl.port && pageUrl.port !== '443')) {
      return failure(400, 'فقط لینک HTTPS معتبر پذیرفته می‌شود');
    }
    const host = pageUrl.hostname.toLowerCase();
    const isWikipediaPage = host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
    const isImdbPage = host === 'imdb.com' || host === 'www.imdb.com' || host === 'm.imdb.com';
    if (!isWikipediaPage && !isImdbPage) {
      return failure(400, 'دامنهٔ این لینک برای دریافت امن تصویر پشتیبانی نمی‌شود؛ صفحهٔ ویکی‌پدیا یا IMDb را وارد کنید');
    }
    try {
      target = await resolvePageImageUrl(pageUrl, fetchImpl);
    } catch (error) {
      return failure(502, 'استخراج تصویر از صفحهٔ ویکی‌پدیا یا IMDb ناموفق بود؛ صفحه را بررسی کنید و دوباره تلاش کنید');
    }
    if (!target) {
      return failure(404, 'از این صفحه تصویر قابل دریافت پیدا نشد؛ لینک صفحهٔ دقیق یا لینک مستقیم تصویر را وارد کنید.');
    }
  }

  let response = null;
  try {
    for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
      response = await fetchImpl(target.href, {
        headers: {
          'User-Agent': 'BankResaneh/2.0 (image import)',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/tiff,image/bmp,image/svg+xml,image/heic,image/heif',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === 3) return failure(502, 'مسیر انتقال لینک تصویر معتبر نیست');
        const redirected = isAllowedImageUrl(new URL(location, target).href);
        if (!redirected) return failure(400, 'مسیر انتقال تصویر به دامنهٔ تأییدنشده انجام می‌شود');
        await response.body?.cancel();
        target = redirected;
        continue;
      }
      break;
    }

    if (!response?.ok) return failure(502, 'دریافت تصویر از منبع ناموفق بود');
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mime)) return failure(415, 'لینک واردشده به فایل تصویر پشتیبانی‌شده اشاره نمی‌کند');
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_SOURCE_BYTES) return failure(413, 'حجم تصویر اولیه بیشتر از ۲۵ مگابایت است');
    const source = Buffer.from(await response.arrayBuffer());
    if (!source.length || source.length > MAX_SOURCE_BYTES) return failure(413, 'حجم تصویر نامعتبر یا بیشتر از ۲۵ مگابایت است');

    let output;
    try {
      output = await optimizeImageBuffer(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('2 MiB')) return failure(413, 'حجم تصویر پس از بهینه‌سازی هنوز زیاد است');
      return failure(415, 'فایل دریافت‌شده تصویر معتبر یا قابل پردازش نیست');
    }
    return {
      status: 200,
      body: {
        dataUrl: 'data:image/webp;base64,' + output.toString('base64'),
        size: output.length,
        source: target.hostname,
      },
    };
  } catch (error) {
    return failure(502, error?.name === 'TimeoutError' ? 'دریافت تصویر بیش از حد طول کشید' : 'خطا در دریافت و پردازش تصویر');
  }
}
