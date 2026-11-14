import { NextRequest, NextResponse } from 'next/server';
import { gatePermissionAny } from '@/lib/server-auth';
export const runtime = 'nodejs';
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'thewdb';
const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function cleanQuery(s: string): string {
  return (s||'').replace(/[?!]+$/,'').replace(/\(.*?\)/g,' ').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
}

async function fetchImdbPoster(imdbId: string): Promise<string | null> {
  // OMDb sometimes returns a valid title record without a poster. Fall back to
  // IMDb's public page metadata so editing can still import the title artwork.
  const pageUrl = `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`;
  const response = await fetchRetry(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }, 1);
  if (!response) return null;
  const html = await response.text();
  const candidates = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const imageUrl = decodeHtml(match[1].replace(/\\u0026/g, '&'));
    try {
      const image = new URL(imageUrl);
      if (image.protocol === 'https:' && (image.hostname === 'm.media-amazon.com' || image.hostname.endsWith('.media-amazon.com'))) {
        return image.href;
      }
    } catch {
      // Ignore malformed metadata URLs and try the next candidate.
    }
  }
  return null;
}

async function fetchWikipediaShowImage(title: string): Promise<string | null> {
  const query = cleanQuery(title);
  if (!query) return null;

  // Search the English and Persian encyclopedias before falling back to
  // Wikimedia Commons. This matters for Iranian programmes whose articles
  // or studio images are indexed only in Persian.
  for (const lang of ['en', 'fa']) {
    const search = await fetchRetry(
      `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=6&prop=pageimages&piprop=original|thumbnail&pithumbsize=1200&format=json`,
      { headers: { 'User-Agent': UA, 'Accept': 'application/json' } },
      1,
    );
    if (!search) continue;
    const data = await search.json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    for (const page of pages) {
      const candidate = page?.original?.source || page?.thumbnail?.source;
      if (typeof candidate !== 'string') continue;
      try {
        const image = new URL(candidate);
        if (image.protocol === 'https:' && image.hostname === 'upload.wikimedia.org') return image.href;
      } catch {
        // Ignore malformed image URLs and continue to the next result.
      }
    }
  }

  const commons = await fetchRetry(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json`,
    { headers: { 'User-Agent': UA, 'Accept': 'application/json' } },
    1,
  );
  if (!commons) return null;
  const commonsData = await commons.json();
  const files = Object.values(commonsData?.query?.pages || {}) as any[];
  for (const file of files) {
    const candidate = file?.imageinfo?.[0]?.thumburl || file?.imageinfo?.[0]?.url;
    if (typeof candidate !== 'string') continue;
    try {
      const image = new URL(candidate);
      if (image.protocol === 'https:' && image.hostname === 'upload.wikimedia.org') return image.href;
    } catch {
      // Ignore malformed Commons results.
    }
  }
  return null;
}

async function fetchRetry(url: string, opts: any = {}, retries = 2) {
  for (let i=0; i<=retries; i++) {
    try { const r = await fetch(url, { ...opts, signal: opts.signal || AbortSignal.timeout(12000) }); if (r.ok) return r; if (r.status===429) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; } }
    catch(e) { if (i===retries) throw e; await new Promise(x=>setTimeout(x,1500)); }
  }
  return null;
}

export async function POST(request: NextRequest) {
  // --- Auth: requires add_shows or edit_shows permission (admin/editor by default).
  // Previously this endpoint was unauthenticated and used the project's shared
  // public OMDB API key — anyone could call it and exhaust the daily quota. ---
  const gate = await gatePermissionAny(request, 'add_shows', 'edit_shows');
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به دسترسی افزودن یا ویرایش برنامه' }, { status: gate.status });
  }
  try {
    const { url, category = '', showName = '', isDecor: explicitIsDecor } = await request.json();
    if (typeof url !== 'string' || !url.trim()) return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'لینک معتبر نیست' }, { status: 400 }); }
    if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'فقط لینک HTTPS پذیرفته می‌شود' }, { status: 400 });
    const host = parsed.hostname.toLowerCase();
    const isImdb = host === 'imdb.com' || host.endsWith('.imdb.com');
    const isWikipedia = host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
    if (!isImdb && !isWikipedia) return NextResponse.json({ error: 'فعلاً فقط لینک IMDb و ویکی‌پدیا پشتیبانی می‌شود' }, { status: 400 });
    const info: Record<string,string> = {};
    const isDecor = typeof explicitIsDecor === 'boolean'
      ? explicitIsDecor
      : /(?:^|[,،\s])(?:دکور|decor)(?:$|[,،\s])/i.test(String(category || ''));

    if (isImdb) {
      const imdbMatch = parsed.pathname.match(/(?:^|\/)title\/(tt\d+)/i) || parsed.href.match(/\b(tt\d+)\b/i);
      const searchQuery = parsed.searchParams.get('q') || parsed.searchParams.get('s');
      let record: any = null;
      if (imdbMatch) {
        const r = await fetchRetry(`https://www.omdbapi.com/?i=${imdbMatch[1]}&apikey=${encodeURIComponent(OMDB_API_KEY)}&plot=full`, {}, 1);
        if (r) record = await r.json();
      } else if (searchQuery) {
        const r = await fetchRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(cleanQuery(searchQuery))}&apikey=${encodeURIComponent(OMDB_API_KEY)}`, {}, 1);
        if (r) {
          const d = await r.json();
          const first = Array.isArray(d.Search) ? d.Search[0] : null;
          if (first?.imdbID) {
            const dr = await fetchRetry(`https://www.omdbapi.com/?i=${encodeURIComponent(first.imdbID)}&apikey=${encodeURIComponent(OMDB_API_KEY)}&plot=full`, {}, 1);
            if (dr) record = await dr.json();
          }
        }
      }
      if (record?.Response === 'True') {
        if (record.Title) info.title = record.Title;
        if (record.Plot && record.Plot !== 'N/A') info.description = record.Plot;
        // Preserve IMDb/OMDb posters for other genres; decor needs real program/set imagery.
        if (!isDecor && record.Poster && record.Poster !== 'N/A' && /^https:\/\//i.test(record.Poster)) info.image = record.Poster;
        if (record.imdbRating && record.imdbRating !== 'N/A') info.rating = record.imdbRating;
        if (record.Genre && record.Genre !== 'N/A') info.genres = record.Genre;
        if (record.Year && record.Year !== 'N/A') info.year = record.Year;
        if (record.Runtime && record.Runtime !== 'N/A') info.duration = record.Runtime;
        if (record.Director && record.Director !== 'N/A') info.director = record.Director;
        if (record.Actors && record.Actors !== 'N/A') info.actors = record.Actors;
        if (record.Country && record.Country !== 'N/A') info.country = record.Country;
        info.imdbUrl = parsed.href;
      }
      if (isDecor) {
        // Keep the existing no-IMDb-poster rule for decor, and add a
        // Wikipedia/Wikimedia image search using the resolved or entered show name.
        const decorImage = await fetchWikipediaShowImage(info.title || String(showName || ''));
        if (decorImage) info.image = decorImage;
      } else if (!info.image && imdbMatch) {
        const fallbackPoster = await fetchImdbPoster(imdbMatch[1]);
        if (fallbackPoster) info.image = fallbackPoster;
      }
    }

    if (isWikipedia) {
      const lang = host.split('.')[0] && host.split('.')[0] !== 'www' ? host.split('.')[0] : 'en';
      let pageTitle = '';
      if (parsed.pathname.startsWith('/wiki/')) {
        pageTitle = decodeURIComponent(parsed.pathname.slice('/wiki/'.length).split('/')[0].replace(/_/g, ' '));
      } else {
        const query = parsed.searchParams.get('search') || parsed.searchParams.get('title');
        if (query) {
          const sr = await fetchRetry(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srnamespace=0&srlimit=5&format=json&srsearch=${encodeURIComponent(cleanQuery(query))}`, { headers: { 'User-Agent': UA } }, 1);
          if (sr) {
            const sd = await sr.json();
            pageTitle = sd?.query?.search?.[0]?.title || '';
          }
        }
      }
      if (pageTitle) {
        const r = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`, { headers: { 'User-Agent': UA } }, 1);
        if (r) {
          const d = await r.json();
          if (d.title) info.title = d.title;
          if (d.extract) info.description = d.extract;
          if (d.originalimage?.source) info.image = d.originalimage.source;
          else if (d.thumbnail?.source) info.image = d.thumbnail.source;
          info.wikiUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
        }
      }
    }

    if (!info.title && !info.description && !info.image) {
      return NextResponse.json({ error: 'اطلاعات قابل استخراج نیست؛ لینک را بررسی کنید یا لینک صفحهٔ دقیق برنامه را بفرستید' }, { status: 404 });
    }
    return NextResponse.json({ info });
  } catch (e) {
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات' }, { status: 500 });
  }
}
