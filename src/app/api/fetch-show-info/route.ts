import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// OMDb API key — free tier (1000 req/day). Register at omdbapi.com/apikey.aspx
const OMDB_API_KEY = 'thewdb'; // free public key

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    }

    const info: Record<string, string> = {};

    // ─── IMDb: use OMDb API (reliable, no scraping) ───
    if (url.includes('imdb.com')) {
      const imdbMatch = url.match(/tt(\d+)/);
      if (imdbMatch) {
        const imdbId = 'tt' + imdbMatch[1];
        const omdbUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}&plot=full`;
        try {
          const omdbRes = await fetch(omdbUrl);
          if (omdbRes.ok) {
            const omdb = await omdbRes.json();
            if (omdb.Response === 'True') {
              if (omdb.Title) info.title = omdb.Title;
              if (omdb.Plot) info.description = omdb.Plot;
              if (omdb.Poster && omdb.Poster !== 'N/A') info.image = omdb.Poster;
              if (omdb.imdbRating && omdb.imdbRating !== 'N/A') info.rating = omdb.imdbRating;
              if (omdb.Genre) info.genres = omdb.Genre;
              if (omdb.Year) info.year = omdb.Year;
              if (omdb.Runtime && omdb.Runtime !== 'N/A') info.duration = omdb.Runtime;
              if (omdb.Director && omdb.Director !== 'N/A') info.director = omdb.Director;
              if (omdb.Actors && omdb.Actors !== 'N/A') info.actors = omdb.Actors;
              if (omdb.Country) info.country = omdb.Country;
              info.imdbUrl = url;
            }
          }
        } catch { /* OMDb failed — fall through to scraping */ }
      }

      // If OMDb succeeded, return early
      if (info.title || info.description) {
        return NextResponse.json({ info });
      }
      // Otherwise try scraping as fallback
    }

    // ─── Wikipedia: use REST API (reliable, no scraping) ───
    if (url.includes('wikipedia.org')) {
      // Extract title from URL: /wiki/Page_Title
      const wikiMatch = url.match(/\/wiki\/(.+?)(?:\?|#|$)/);
      if (wikiMatch) {
        const pageTitle = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '));
        // Determine language from URL (fa.wikipedia.org → fa, default → en)
        const lang = url.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'en';
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        try {
          // Small delay to avoid rate-limiting (429)
          await new Promise(r => setTimeout(r, 300));
          const wikiRes = await fetch(summaryUrl, {
            headers: { 'User-Agent': 'BankRasaneh/2.0 (contact@bankrasaneh.ir)' },
          });
          if (wikiRes.ok) {
            const wiki = await wikiRes.json();
            if (wiki.title) info.title = wiki.title;
            if (wiki.extract) info.description = wiki.extract;
            if (wiki.originalimage?.source) info.image = wiki.originalimage.source;
            else if (wiki.thumbnail?.source) info.image = wiki.thumbnail.source;
            info.wikiUrl = url;
          } else if (wikiRes.status === 404) {
            // Page doesn't exist on Wikipedia — try the other language
            const otherLang = lang === 'en' ? 'fa' : 'en';
            const otherUrl = `https://${otherLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
            await new Promise(r => setTimeout(r, 300));
            const otherRes = await fetch(otherUrl, {
              headers: { 'User-Agent': 'BankRasaneh/2.0 (contact@bankrasaneh.ir)' },
            });
            if (otherRes.ok) {
              const other = await otherRes.json();
              if (other.title) info.title = other.title;
              if (other.extract) info.description = other.extract;
              if (other.originalimage?.source) info.image = other.originalimage.source;
            }
          }
        } catch { /* REST API failed */ }

        // If REST API worked, return early (skip scraping which often gets 429)
        if (info.title || info.description) {
          return NextResponse.json({ info });
        }
      }
    }

    // ─── Generic scraping fallback (for YouTube, other sites) ───
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      // If we already have some info from API calls, return it
      if (info.title || info.description) {
        return NextResponse.json({ info });
      }
      return NextResponse.json(
        { error: `دسترسی به سایت ناموفق بود (HTTP ${res.status})` },
        { status: 404 }
      );
    }

    const html = await res.text();

    // Detect WAF/bot-challenge pages
    if (html.includes('awsWafCookieDomainList') || html.includes('gokuProps') || html.includes('captcha')) {
      if (info.title || info.description) return NextResponse.json({ info });
      return NextResponse.json(
        { error: 'سایت دسترسی خودکار را مسدود کرده است. لطفاً اطلاعات را دستی وارد کنید.' },
        { status: 403 }
      );
    }

    // 1. Try JSON-LD structured data
    const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1].trim());
        if (!info.title && ld.name) info.title = ld.name;
        if (!info.description && ld.description) info.description = ld.description;
        if (!info.image && ld.image) {
          info.image = typeof ld.image === 'string' ? ld.image : (ld.image?.url || '');
        }
        if (!info.rating && ld.aggregateRating?.ratingValue) info.rating = String(ld.aggregateRating.ratingValue);
        if (!info.genres && ld.genre) {
          info.genres = Array.isArray(ld.genre) ? ld.genre.join('، ') : ld.genre;
        }
      } catch { /* parse failed */ }
    }

    // 2. Open Graph meta tags
    if (!info.title) {
      const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitle) info.title = decodeHtml(ogTitle[1]);
    }
    if (!info.description) {
      const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (ogDesc) info.description = decodeHtml(ogDesc[1]);
    }
    if (!info.image) {
      const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImage) info.image = ogImage[1];
    }

    // 3. <title> tag fallback
    if (!info.title) {
      const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (pageTitle) {
        let t = decodeHtml(pageTitle[1].trim());
        t = t.replace(/\s*[-–—|]\s*(IMDb|Wikipedia|YouTube|Google).*$/i, '');
        if (t.length > 2) info.title = t;
      }
    }

    // 4. YouTube title extraction
    if (!info.title && url.includes('youtube.com')) {
      const ytTitle = html.match(/"title"\s*:\s*"([^"]{5,})"/);
      if (ytTitle) info.title = decodeHtml(ytTitle[1]);
    }

    // Auto-set links
    if (url.includes('imdb.com')) info.imdbUrl = url;
    if (url.includes('wikipedia.org')) info.wikiUrl = url;
    if (url.includes('youtube.com')) info.ytUrl = url;

    if (!info.title && !info.description && !info.image) {
      return NextResponse.json(
        { error: 'متاسفانه نتوانستیم اطلاعات استخراج کنیم. سایت ممکن است از دسترسی خودکار جلوگیری کند.' },
        { status: 404 }
      );
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
