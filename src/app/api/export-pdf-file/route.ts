import { NextRequest, NextResponse } from 'next/server';
import { gatePermission, getApiBaseForRequest } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ShowRow = {
  num?: number;
  name?: string;
  category?: string;
  source?: string;
  size?: string;
  viewers?: string;
  style?: string;
  effects?: string;
  layout?: string;
  elements?: string;
  materials?: string;
  colors?: string;
  lighting?: string;
  summary?: string;
  descriptionFa?: string;
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
    const categories = new Map<string, number>();
    for (const show of shows) {
      const category = text(show.category, 'سایر').replace(/^\d+\.\s*/, '');
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    const categoryRows = [...categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => [category, count.toLocaleString('fa-IR'), (count / shows.length * 100).toFixed(1) + '٪']);

    const pdfModule: any = await import('@digicole/pdfmake-rtl');
    const pdfMake: any = pdfModule.default || pdfModule;
    const cairoFonts: any = await import('@digicole/pdfmake-rtl/fonts/Cairo');
    const robotoFonts: any = await import('@digicole/pdfmake-rtl/fonts/Roboto');
    pdfMake.addFonts(cairoFonts.default || cairoFonts);
    pdfMake.addFonts(robotoFonts.default || robotoFonts);
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
          { text: `صفحه ${page.toLocaleString('fa-IR')} از ${pages.toLocaleString('fa-IR')}`, fontSize: 8, color: '#64748B', alignment: 'left' },
        ],
      }),
      content: [
        ...(logoDataUrl ? [{ image: logoDataUrl, width: 64, alignment: 'center', margin: [0, 0, 0, 4] }] : []),
        { text: title, style: 'title' },
        { text: subtitle, style: 'subtitle' },
        {
          columns: [
            { text: [{ text: 'تهیه‌کننده: ', bold: true }, organization], alignment: 'right' },
            { text: [{ text: 'تاریخ تهیه: ', bold: true }, new Date().toLocaleDateString('fa-IR')], alignment: 'left' },
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
            widths: [34, 125, 90, 145, '*'],
            dontBreakRows: false,
            body: [
              [
                { text: 'ردیف', bold: true, color: '#FFFFFF', fillColor: '#075B3B', alignment: 'center' },
                { text: 'نام برنامه', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'دسته‌بندی', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'مشخصات', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
                { text: 'توضیحات', bold: true, color: '#FFFFFF', fillColor: '#075B3B' },
              ],
              ...shows.map((show, index) => [
                (index + 1).toLocaleString('fa-IR'),
                text(show.name),
                text(show.category),
                [
                  `اندازه: ${text(show.size)}`,
                  `سبک: ${text(show.style)}`,
                  `تماشاگر: ${text(show.viewers)}`,
                  `نور: ${text(show.lighting)}`,
                  `عناصر: ${text(show.elements)}`,
                  `مصالح: ${text(show.materials)}`,
                  `رنگ: ${text(show.colors)}`,
                ].join('\n'),
                text(show.descriptionFa || show.summary),
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
        { text: 'یادداشت', style: 'section' },
        { text: 'این گزارش به‌صورت خودکار از داده‌های انتخاب‌شده در آرشیو بانک رسانه تهیه شده است. اطلاعات و دسته‌بندی‌ها مطابق داده‌های ثبت‌شده در زمان تهیه گزارش هستند.', fontSize: 8, color: '#475569' },
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
