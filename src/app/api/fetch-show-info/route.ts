import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    }

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'صفحه یافت نشد' }, { status: 404 });
    }

    const html = await res.text();

    // Extract metadata from the page
    const info: Record<string, string> = {};

    // Try to get og:title
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitle) info.title = decodeHtml(ogTitle[1]);

    // Try to get og:description
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (ogDesc) info.description = decodeHtml(ogDesc[1]);

    // Try to get og:image
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogImage) info.image = ogImage[1];

    // Try to get page title
    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (pageTitle && !info.title) info.title = decodeHtml(pageTitle[1].trim());

    // For IMDb - extract more details
    if (url.includes('imdb.com')) {
      // Rating
      const rating = html.match(/"ratingValue"\s*:\s*"([\d.]+)"/);
      if (rating) info.rating = rating[1];

      // Genre
      const genres = html.match(/"genre"\s*:\s*\[([^\]]+)\]/);
      if (genres) {
        info.genres = genres[1].replace(/"/g, '').split(',').map((g: string) => g.trim()).join('، ');
      }

      // Year
      const year = html.match(/"datePublished"\s*:\s*"(\d{4})/);
      if (year) info.year = year[1];

      // Runtime
      const runtime = html.match(/"duration"\s*:\s*"PT(\d+)M"/);
      if (runtime) info.duration = `${runtime[1]} دقیقه`;
    }

    // For Wikipedia - extract first paragraph
    if (url.includes('wikipedia.org')) {
      const firstPara = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (firstPara) {
        // Clean HTML tags
        const cleanText = firstPara[1].replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').trim();
        if (cleanText.length > 20) {
          info.description = cleanText.substring(0, 500);
        }
      }
    }

    if (!info.title && !info.description) {
      return NextResponse.json({ error: 'اطلاعات قابل استخراج نیست' }, { status: 404 });
    }

    return NextResponse.json({ info });
  } catch (e) {
    console.error('Fetch error:', e);
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات' }, { status: 500 });
  }
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
