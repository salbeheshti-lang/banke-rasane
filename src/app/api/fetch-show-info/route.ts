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
async function fetchRetry(url: string, opts: any = {}, retries = 2) {
  for (let i=0; i<=retries; i++) {
    try { const r = await fetch(url, opts); if (r.ok) return r; if (r.status===429) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; } }
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
    const { url } = await request.json();
    if (typeof url !== 'string' || !url.trim()) return NextResponse.json({ error: 'URL الزامی است' }, { status: 400 });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'لینک معتبر نیست' }, { status: 400 }); }
    if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'فقط لینک HTTPS پذیرفته می‌شود' }, { status: 400 });
    const host = parsed.hostname.toLowerCase();
    const isImdb = host === 'imdb.com' || host.endsWith('.imdb.com');
    const isWikipedia = host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
    if (!isImdb && !isWikipedia) return NextResponse.json({ error: 'فعلاً فقط لینک IMDb و ویکی‌پدیا پشتیبانی می‌شود' }, { status: 400 });
    const info: Record<string,string> = {};

    if (isImdb) {
      const imdbMatch = parsed.pathname.match(/(?:^|\\/)title\\/(tt\\d+)/i) || parsed.href.match(/\\b(tt\\d+)\\b/i);
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
        if (record.Poster && record.Poster !== 'N/A' && /^https:\\/\\//i.test(record.Poster)) info.image = record.Poster;
        if (record.imdbRating && record.imdbRating !== 'N/A') info.rating = record.imdbRating;
        if (record.Genre && record.Genre !== 'N/A') info.genres = record.Genre;
        if (record.Year && record.Year !== 'N/A') info.year = record.Year;
        if (record.Runtime && record.Runtime !== 'N/A') info.duration = record.Runtime;
        if (record.Director && record.Director !== 'N/A') info.director = record.Director;
        if (record.Actors && record.Actors !== 'N/A') info.actors = record.Actors;
        if (record.Country && record.Country !== 'N/A') info.country = record.Country;
        info.imdbUrl = parsed.href;
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
