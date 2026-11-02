import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const OMDB_API_KEY = 'thewdb';
const UA = 'BankResaneh/2.0 (contact@bankrasaneh.ir)';

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function cleanQuery(s: string): string {
  return (s||'').replace(/[?!]+$/,'').replace(/\(.*?\)/g,' ').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
}
async function fetchRetry(url: string, opts: any = {}, retries = 2) {
  for (let i=0; i<=retries; i++) {
    try { const r = await fetch(url, opts); if (r.ok) return r; if (r.status===429) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; } }
    catch(e) { if (i===retries) throw e; await new Promise(x=>setTimeout(x,1500)); }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    const info: Record<string,string> = {};

    if (url.includes('imdb.com')) {
      const imdbMatch = url.match(/tt(\d+)/);
      if (imdbMatch) {
        const r = await fetchRetry(`https://www.omdbapi.com/?i=tt${imdbMatch[1]}&apikey=${OMDB_API_KEY}&plot=full`, {}, 1);
        if (r && r.ok) {
          const d = await r.json();
          if (d.Response==='True') {
            if (d.Title) info.title = d.Title;
            if (d.Plot) info.description = d.Plot;
            if (d.Poster && d.Poster!=='N/A') info.image = d.Poster;
            if (d.imdbRating && d.imdbRating!=='N/A') info.rating = d.imdbRating;
            if (d.Genre) info.genres = d.Genre;
            if (d.Year) info.year = d.Year;
            if (d.Runtime && d.Runtime!=='N/A') info.duration = d.Runtime;
            if (d.Director && d.Director!=='N/A') info.director = d.Director;
            if (d.Actors && d.Actors!=='N/A') info.actors = d.Actors;
            if (d.Country) info.country = d.Country;
            info.imdbUrl = url;
          }
        }
      }
      if (!info.title) {
        const searchMatch = url.match(/[?&]q=([^&]+)/);
        if (searchMatch) {
          const query = cleanQuery(decodeURIComponent(searchMatch[1].replace(/\+/g,' ')));
          if (query) {
            const r = await fetchRetry(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${OMDB_API_KEY}`, {}, 1);
            if (r && r.ok) {
              const d = await r.json();
              if (d.Search && d.Search.length > 0) {
                const dr = await fetchRetry(`https://www.omdbapi.com/?i=${d.Search[0].imdbID}&apikey=${OMDB_API_KEY}&plot=full`, {}, 1);
                if (dr && dr.ok) {
                  const dd = await dr.json();
                  if (dd.Response==='True') {
                    if (dd.Title) info.title = dd.Title;
                    if (dd.Plot) info.description = dd.Plot;
                    if (dd.Poster && dd.Poster!=='N/A') info.image = dd.Poster;
                    if (dd.imdbRating && dd.imdbRating!=='N/A') info.rating = dd.imdbRating;
                    if (dd.Genre) info.genres = dd.Genre;
                    if (dd.Year) info.year = dd.Year;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (url.includes('wikipedia.org')) {
      // Handle both /wiki/Page_Title and /w/index.php?search=query URLs
      const wikiMatch = url.match(/\/wiki\/(.+?)(?:\?|#|$)/);
      const searchMatch = url.match(/[?&]search=([^&]+)/);
      if (wikiMatch) {
        const pageTitle = decodeURIComponent(wikiMatch[1].replace(/_/g,' '));
        const lang = url.match(/\/\/([a-z]{2})\.wikipedia/)?.[1] || 'en';
        const r = await fetchRetry(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`, { headers: { 'User-Agent': UA } }, 1);
        if (r && r.ok) {
          const d = await r.json();
          if (d.title) info.title = d.title;
          if (d.extract) info.description = d.extract;
          if (d.originalimage?.source) info.image = d.originalimage.source;
          else if (d.thumbnail?.source) info.image = d.thumbnail.source;
          info.wikiUrl = url;
        }
      }
    }

    if (!info.title && !info.description && !info.image) {
      return NextResponse.json({ error: 'اطلاعات قابل استخراج نیست' }, { status: 404 });
    }
    return NextResponse.json({ info });
  } catch (e) {
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات' }, { status: 500 });
  }
}
