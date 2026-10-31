import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OMDB_API_KEY = 'thewdb';
const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function cleanQuery(s: string): string {
  return (s || '').replace(/[?!]+$/, '').replace(/\(.*?\)/g, ' ').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url: string, options: any = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429) { await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue; }
    } catch (e) { if (i === retries) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    }

    const info: Record<string, string> = {};

    // ─── IMDb: use OMDb API ───
    if (url.includes('imdb.com')) {
      // Try direct IMDb ID first
      const imdbMatch = url.match(/tt(\d+)/);
      if (imdbMatch) {
        const imdbId = 'tt' + imdbMatch[1];
        const omdbUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}&plot=full`;
        try {
          const omdbRes = await fetchWithRetry(omdbUrl, {}, 1);
          if (omdbRes && omdbRes.ok) {
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
        } catch { /* OMDb failed */ }
      }

      // If OMDb didn't work, try search by query
      if (!info.title) {
        const searchMatch = url.match(/[?&]q=([^&]+)/);
        if (searchMatch) {
          const query = cleanQuery(decodeURIComponent(searchMatch[1].replace(/\+/g, ' ')));
          if (query) {
            const searchApi = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${OMDB_API_KEY}`;
            try {
              const res = await fetchWithRetry(searchApi, {}, 1);
              if (res && res.ok) {
                const data = await res.json();
                if (data.Response === 'True' && data.Search && data.Search.length > 0) {
                  // Fetch full details for the first result
                  const firstId = data.Search[0].imdbID;
                  const detailUrl = `https://www.omdbapi.com/?i=${firstId}&apikey=${OMDB_API_KEY}&plot=full`;
                  const detailRes = await fetchWithRetry(detailUrl, {}, 1);
                  if (detailRes && detailRes.ok) {
                    const omdb = await detailRes.json();
                    if (omdb.Response === 'True') {
                      if (omdb.Title) info.title = omdb.Title;
                      if (omdb.Plot) info.description = omdb.Plot;
                      if (omdb.Poster && omdb.Poster !== 'N/A') info.image = omdb.Poster;
                      if (omdb.imdbRating && omdb.imdbRating !== 'N/A') info.rating = omdb.imdbRating;
                      if (omdb.Genre) info.genres = omdb.Genre;
                      if (omdb.Year) info.year = omdb.Year;
                      if (omdb.Runtime && omdb.Runtime !== 'N/A') info.duration = omdb.Runtime;
                    }
                  }
                }
              }
            } catch { /* search failed */ }
          }
        }
      }
    }

    // ─── Wikipedia: use REST API ───
    if (url.includes('wikipedia.org')) {
      const wikiMatch = url.match(/\/wiki\/(.+?)(?:\?|#|$)/);
      if (wikiMatch) {
        const pageTitle = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '));
        const lang = url.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'en';
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        try {
          const wikiRes = await fetchWithRetry(summaryUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
          }, 1);
          if (wikiRes && wikiRes.ok) {
            const wiki = await wikiRes.json();
            if (wiki.title) info.title = wiki.title;
            if (wiki.extract) info.description = wiki.extract;
            if (wiki.originalimage?.source) info.image = wiki.originalimage.source;
            else if (wiki.thumbnail?.source) info.image = wiki.thumbnail.source;
            info.wikiUrl = url;
          }
        } catch { /* REST API failed */ }
      }
    }

    // If no info gathered, try generic fetch as last resort
    if (!info.title && !info.description && !info.image) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
          },
          redirect: 'follow',
        });
        if (res.ok) {
          const html = await res.text();
          // og:title
          const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
          if (ogTitle) info.title = decodeHtml(ogTitle[1]);
          // og:description
          const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i);
          if (ogDesc) info.description = decodeHtml(ogDesc[1]);
          // og:image
          const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
          if (ogImage) info.image = ogImage[1];
        }
      } catch { /* generic fetch failed */ }
    }

    if (!info.title && !info.description && !info.image) {
      return NextResponse.json(
        { error: 'اطلاعات قابل استخراج نیست' },
        { status: 404 }
      );
    }

    return NextResponse.json({ info });
  } catch (e) {
    console.error('Fetch error:', e);
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات' }, { status: 500 });
  }
}
