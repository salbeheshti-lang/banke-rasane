import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_BRANDING } from '@/lib/branding';
import { gatePermission, getApiBaseForRequest } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getClientLogoDataUrl(): string {
  const fileName = path.basename(CLIENT_BRANDING.logoColorPath);
  const candidate = path.join(process.cwd(), 'public', fileName);
  try {
    if (fs.existsSync(candidate)) return `data:image/png;base64,${fs.readFileSync(candidate).toString('base64')}`;
  } catch { /* The report can still be generated without optional client branding. */ }
  console.warn('[PDF] Client logo not found in packaged public paths');
  return '';
}

function getAppLogoDataUrl(): string {
  const candidate = path.join(process.cwd(), 'public', 'banke-rasane-logo.png');
  try {
    if (fs.existsSync(candidate)) return `data:image/png;base64,${fs.readFileSync(candidate).toString('base64')}`;
  } catch { /* The report can still be generated without the optional app logo. */ }
  console.warn('[PDF] BankResaneh app logo not found in packaged public paths');
  return '';
}

type ShowRow = {
  num?: number;
  name?: string;
  category?: string;
  source?: string;
  size?: string;
  viewers?: string;
  style?: string;
  layout?: string;
  elements?: string;
  materials?: string;
  colors?: string;
  lighting?: string;
  summary?: string;
  descriptionFa?: string;
  operationalCapacity?: string;
  country?: string;
  effects?: string;
  youtube?: string;
  imdb?: string;
  wikipedia?: string;
  socialPost?: string;
  tags?: string[];
  videos?: string[];
  images?: string[];
  imageSource?: string;
  isFilm?: boolean;
  decorIncluded?: boolean;
};

const text = (value: unknown, fallback = '—') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

export async function POST(request: NextRequest) {
  const gate = await gatePermission(request, 'export_reports');
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به دسترسی گزارش‌گیری' },
      { status: gate.status },
    );
  }

  try {
    const body = await request.json();
    if (!Array.isArray(body.shows) || body.shows.length === 0) {
      return NextResponse.json({ error: 'هیچ برنامه‌ای برای گزارش انتخاب نشده است' }, { status: 400 });
    }
    if (body.shows.length > 5000) {
      return NextResponse.json({ error: 'حداکثر ۵۰۰۰ برنامه در هر گزارش قابل خروجی است' }, { status: 413 });
    }

    const shows = body.shows as ShowRow[];
    const apiBase = getApiBaseForRequest(request);
    const authorization = request.headers.get('Authorization') || '';
    if (!apiBase) return NextResponse.json({ error: 'سرور انتخاب‌شده در فهرست سرورهای مجاز نیست' }, { status: 403 });

    const settingsResponse = await fetch(apiBase + '/api/settings/report', {
      headers: { Authorization: authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!settingsResponse.ok) {
      return NextResponse.json({ error: 'دریافت تنظیمات گزارش از سرور انتخاب‌شده ناموفق بود' }, { status: settingsResponse.status });
    }
    const saved = await settingsResponse.json();
    const title = text(body.title, saved.title);
    const subtitle = text(body.subtitle, saved.subtitle);
    const organization = text(body.organization, saved.organization);
    let logoDataUrl = '';
    const logoResponse = await fetch(apiBase + '/api/settings/logo', {
      headers: { Authorization: authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (logoResponse.ok) {
      const mime = logoResponse.headers.get('content-type') || 'image/png';
      const encoded = Buffer.from(await logoResponse.arrayBuffer()).toString('base64');
      logoDataUrl = `data:${mime};base64,${encoded}`;
    }
    const clientLogoDataUrl = getClientLogoDataUrl();
    const appLogoDataUrl = getAppLogoDataUrl();
    const categories = new Map<string, number>();
    for (const show of shows) {
      const category = text(show.category, 'سایر').replace(/^\d+\.\s*/, '');
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    const categoryRows = [...categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => [category, count.toLocaleString('fa-IR'), (count / shows.length * 100).toFixed(1) + '٪']);

    // Add a small, real program image beside each row where the archive has one.
    // The image column is bounded for very large reports to keep PDF generation
    // predictable; all textual rows and metadata remain complete.
    const showImageMap = new Map<number, string>();
    const imageCandidates = shows.slice(0, 200);
    if (imageCandidates.some(show => (show.images || []).some(image => image.startsWith('data:image/')) || !!show.imageSource)) {
      for (let offset = 0; offset < imageCandidates.length; offset += 6) {
        const batch = imageCandidates.slice(offset, offset + 6);
        await Promise.all(batch.map(async (show) => {
          if (!show.num) return;
          try {
            let imageDataUrl = '';
            // Prefer the compact JPEG thumbnail prepared by the browser. If it
            // is absent, fall back to the API's stored image BLOB.
            const inlineImage = (show.images || []).find(image => /^data:image\/(?:jpeg|png);base64,/i.test(image));
            if (inlineImage) imageDataUrl = inlineImage;
            if (!imageDataUrl && show.imageSource) {
              const imageResponse = await fetch(apiBase + '/api/image/' + show.num + '?v=' + encodeURIComponent(show.imageSource), {
                headers: { Authorization: authorization },
                cache: 'no-store',
                signal: AbortSignal.timeout(12_000),
              });
              if (imageResponse.ok) {
                const mime = (imageResponse.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
                if (/^image\/(?:jpeg|png)$/i.test(mime)) {
                  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
                  if (imageBytes.length) imageDataUrl = 'data:' + mime + ';base64,' + imageBytes.toString('base64');
                }
              }
            }
            if (imageDataUrl) showImageMap.set(show.num, imageDataUrl);
          } catch {
            // A missing or invalid optional image must not prevent a report.
          }
        }));
      }
    }
    const imageLimitNote = shows.length > 200
      ? 'برای حفظ حجم و سرعت فایل، تصویر برنامه فقط برای ۲۰۰ ردیف نخست درج شده است؛ تمام اطلاعات متنی همه ردیف‌ها کامل است.'
      : '';

    const pdfModule: any = await import('@digicole/pdfmake-rtl');
    const pdfMake: any = pdfModule.default || pdfModule;
    // Embed the RTL and Latin font files into the bundle. Filesystem-based
    // font paths break in standalone packaging and Cloudflare Workers.
    const virtualFonts: any = await import('@digicole/pdfmake-rtl/build/vfs_fonts');
    const fontFiles = virtualFonts.default || virtualFonts;
    for (const [filename, base64] of Object.entries(fontFiles)) {
      pdfMake.virtualfs.writeFileSync(filename, Buffer.from(String(base64), 'base64'));
    }
    pdfMake.addFonts({
      Cairo: {
        normal: 'Cairo-Regular.ttf',
        bold: 'Cairo-Bold.ttf',
        italics: 'Cairo-Light.ttf',
        bolditalics: 'Cairo-SemiBold.ttf',
      },
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    });
    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [32, 48, 32, 44],
      rtl: true,
      info: {
        title,
        subject: subtitle,
        author: organization,
        creator: 'بانک رسانه',
      },
      defaultStyle: { fontSize: 9, alignment: 'right', lineHeight: 1.35 },
      styles: {
        title: { fontSize: 22, bold: true, color: '#075B3B', alignment: 'center', margin: [0, 8, 0, 6] },
        subtitle: { fontSize: 11, color: '#475569', alignment: 'center', margin: [0, 0, 0, 12] },
        section: { fontSize: 14, bold: true, color: '#075B3B', margin: [0, 16, 0, 8] },
        small: { fontSize: 8, color: '#64748B' },
      },
      header: (page: number) => ({
        margin: [32, 16, 32, 0],
        columns: [
          { text: 'بانک رسانه', color: '#075B3B', bold: true, fontSize: 9, alignment: 'right' },
          { text: 'گزارش آرشیو برنامه‌های تلویزیونی', color: '#64748B', fontSize: 8, alignment: 'left' },
        ],
      }),
      footer: (page: number, pages: number) => ({
        margin: [32, 0, 32, 16],
        columns: [
          { text: organization, fontSize: 8, color: '#64748B', alignment: 'right' },
          { text: CLIENT_BRANDING.organizationFa, fontSize: 8, color: '#64748B', alignment: 'center' },
          ...(clientLogoDataUrl ? [{ image: clientLogoDataUrl, width: 18, alignment: 'center', margin: [0, -3, 0, 0] }] : []),
          { text: `صفحه ${page.toLocaleString('fa-IR')} از ${pages.toLocaleString('fa-IR')}`, fontSize: 8, color: '#64748B', alignment: 'left' },
        ],
      }),
      content: [
        {
          columns: [
            ...(appLogoDataUrl ? [{ image: appLogoDataUrl, width: 48, alignment: 'right', margin: [0, 4, 0, 0] }] : []),
            {
              width: '*',
              stack: [
                ...(logoDataUrl ? [{ image: logoDataUrl, width: 60, alignment: 'center', margin: [0, 0, 0, 4] }] : []),
                { text: title, style: 'title', alignment: 'center' },
                { text: subtitle, style: 'subtitle', alignment: 'center' },
              ],
            },
          ],
          columnGap: 12,
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            { text: [{ text: 'تهیه‌کننده: ', bold: true }, organization], alignment: 'right' },
            { text: [{ text: 'تاریخ تهیه: ', bold: true }, new Date().toLocaleDateString('fa-IR')], alignment: 'left' },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            { text: CLIENT_BRANDING.organizationFa, alignment: 'right', fontSize: 9, color: '#334155' },
            ...(clientLogoDataUrl ? [{ image: clientLogoDataUrl, width: 30, alignment: 'left' }] : []),
          ],
          margin: [0, 0, 0, 18],
        },
        { text: 'خلاصه اجرایی', style: 'section' },
        {
          table: {
            widths: ['*', '*', '*'],
            body: [[
              { text: `تعداد برنامه‌ها\n${shows.length.toLocaleString('fa-IR')}`, alignment: 'center', bold: true, fillColor: '#E8F5EE' },
              { text: `تعداد ژانرها\n${categories.size.toLocaleString('fa-IR')}`, alignment: 'center', bold: true, fillColor: '#E8F5EE' },
              { text: `تاریخ گزارش\n${new Date().toLocaleDateString('fa-IR')}`, alignment: 'center', bold: true, fillColor: '#E8F5EE' },
            ]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },
        { text: 'توزیع برنامه‌ها بر اساس ژانر', style: 'section' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 90, 90],
            body: [
              [
                { text: 'دسته‌بندی', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'تعداد', bold: true, color: '#FFFFFF', fillColor: '#075B3B', alignment: 'center' },
                { text: 'سهم از کل', bold: true, color: '#FFFFFF', fillColor: '#075B3B', alignment: 'center' },
              ],
              ...categoryRows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: 'فهرست تفصیلی برنامه‌ها', style: 'section', pageBreak: 'before' },
        {
          table: {
            headerRows: 1,
            widths: [28, 48, 108, 78, 140, '*'],
            dontBreakRows: false,
            body: [
              [
                { text: 'ردیف', bold: true, color: '#FFFFFF', fillColor: '#075B3B', alignment: 'center' },
                { text: 'تصویر', bold: true, color: '#FFFFFF', fillColor: '#075B3B', alignment: 'center' },
                { text: 'نام برنامه', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'دسته‌بندی', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'مشخصات', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'توضیحات', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
              ],
              ...shows.map((show, index) => [
                (index + 1).toLocaleString('fa-IR'),
                showImageMap.get(show.num || -1)
                  ? { image: showImageMap.get(show.num || -1), fit: [40, 40], alignment: 'center' }
                  : { text: '—', alignment: 'center', color: '#94A3B8' },
                text(show.name),
                text(show.category),
                [
                  `کشور: ${text(show.country)}`,
                  `منبع: ${text(show.source)}`,
                  `اندازه: ${text(show.size)}`,
                  `سبک: ${text(show.style)}`,
                  `تماشاگر: ${text(show.viewers)}`,
                  `جلوه‌ها: ${text(show.effects)}`,
                  `چیدمان: ${text(show.layout)}`,
                  `نور: ${text(show.lighting)}`,
                  `عناصر: ${text(show.elements)}`,
                  `مصالح: ${text(show.materials)}`,
                  `رنگ: ${text(show.colors)}`,
                  `ظرفیت بهره‌برداری: ${text(show.operationalCapacity)}`,
                  `برچسب‌ها: ${text((show.tags || []).join('، '))}`,
                  `ویدئوها: ${text((show.videos || []).join('، '))}`,
                  `یوتیوب: ${text(show.youtube)}`,
                  `IMDb: ${text(show.imdb)}`,
                  `ویکی‌پدیا: ${text(show.wikipedia)}`,
                  `متن انتشار: ${text(show.socialPost)}`,
                  `فیلم: ${show.isFilm ? 'بله' : 'خیر'}`,
                  `در ژانر دکور: ${show.decorIncluded === undefined ? 'نامشخص' : show.decorIncluded ? 'بله' : 'خیر'}`,
                ].join('\n'),
                [show.summary, show.descriptionFa].filter((value) => typeof value === 'string' && value.trim()).join('\n\n') || '—',
              ]),
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#F8FAFC' : null,
            hLineColor: () => '#DCE5DF',
            vLineColor: () => '#E8EEE9',
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
        ...(imageLimitNote ? [{ text: imageLimitNote, fontSize: 7, color: '#64748B', margin: [0, 4, 0, 4] }] : []),
        { text: 'یادداشت', style: 'section' },
        { text: text(saved.reportText, 'این گزارش به‌صورت خودکار از داده‌های انتخاب‌شده در آرشیو بانک رسانه تهیه شده است. اطلاعات و دسته‌بندی‌ها مطابق داده‌های ثبت‌شده در زمان تهیه گزارش هستند.'), fontSize: 8, color: '#475569' },
      ],
    };

    const buffer = await pdfMake.createPdf(docDefinition).getBuffer();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="bankresaneh-report-${Date.now()}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Binary PDF export error:', error);
    return NextResponse.json(
      { error: 'ساخت فایل PDF ناموفق بود', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
