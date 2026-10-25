import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { shows, title, subtitle, organization } = await request.json();

    if (!shows || !Array.isArray(shows) || shows.length === 0) {
      return NextResponse.json({ error: 'No shows provided' }, { status: 400 });
    }

    // Generate a professional multi-section HTML report
    const html = generatePDFHtml(shows, {
      title: title || 'گزارش جامع آرشیو برنامه‌های تلویزیونی',
      subtitle: subtitle || 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
      organization: organization || 'بانک رسانه',
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="banke-rasane-report-${Date.now()}.html"`,
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: 'PDF export failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

interface PDFOptions {
  title: string;
  subtitle: string;
  organization: string;
}

function generatePDFHtml(shows: any[], opts: PDFOptions): string {
  const now = new Date();
  const faDate = now.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  const faDateShort = now.toLocaleDateString('fa-IR');
  const docId = `BR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${shows.length}`;
  const total = shows.length;

  // ---------- Aggregations ----------
  // Group by category
  const byCategory: Record<string, any[]> = {};
  shows.forEach(s => {
    const cat = (s.category || 'سایر').replace(/^\d+\.\s*/, '').trim() || 'سایر';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  });
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);

  // Source distribution
  const bySource = {
    pdf: shows.filter(s => s.source === 'تصویر PDF').length,
    web: shows.filter(s => s.source === 'تصویر وب').length,
    text: shows.filter(s => s.source === 'متن' || (!s.source)).length,
  };

  // Size distribution
  const sizeBuckets: Record<string, number> = {};
  shows.forEach(s => {
    const k = s.size || 'نامشخص';
    sizeBuckets[k] = (sizeBuckets[k] || 0) + 1;
  });

  // Style distribution
  const styleBuckets: Record<string, number> = {};
  shows.forEach(s => {
    const k = s.style || 'نامشخص';
    styleBuckets[k] = (styleBuckets[k] || 0) + 1;
  });

  // Viewers distribution
  const viewersBuckets: Record<string, number> = {};
  shows.forEach(s => {
    const k = s.viewers || 'نامشخص';
    viewersBuckets[k] = (viewersBuckets[k] || 0) + 1;
  });

  // Decor elements (top 12)
  const elementCounts: Record<string, number> = {};
  shows.forEach(s => {
    if (!s.elements) return;
    s.elements.split(/[,,،]/).map((x: string) => x.trim().toLowerCase()).filter(Boolean).forEach((e: string) => {
      elementCounts[e] = (elementCounts[e] || 0) + 1;
    });
  });
  const topElements = Object.entries(elementCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Materials (top 12)
  const materialCounts: Record<string, number> = {};
  shows.forEach(s => {
    if (!s.materials) return;
    s.materials.split(/[,,،]/).map((x: string) => x.trim().toLowerCase()).filter(Boolean).forEach((m: string) => {
      materialCounts[m] = (materialCounts[m] || 0) + 1;
    });
  });
  const topMaterials = Object.entries(materialCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Colors (top 12)
  const colorCounts: Record<string, number> = {};
  shows.forEach(s => {
    if (!s.colors) return;
    s.colors.split(/[,,،]/).map((x: string) => x.trim().toLowerCase()).filter(Boolean).forEach((c: string) => {
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    });
  });
  const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Lighting
  const lightingCounts: Record<string, number> = {};
  shows.forEach(s => {
    const k = s.lighting || 'نامشخص';
    lightingCounts[k] = (lightingCounts[k] || 0) + 1;
  });

  const totalForPct = (b: Record<string, number>) => Object.values(b).reduce((a, c) => a + c, 0) || 1;

  // ---------- Sections ----------

  // COVER PAGE
  const cover = `
    <section class="cover">
      <div class="cover-bg-deco"></div>
      <div class="cover-content">
        <div class="cover-brand">بانک رسانه</div>
        <div class="cover-logo-mark">
          <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="14" width="52" height="36" rx="4" />
            <path d="M6 22h52M14 14v-4M50 14v-4M20 32l10 6-10 6z" />
          </svg>
        </div>
        <h1 class="cover-title">${escapeHtml(opts.title)}</h1>
        <p class="cover-subtitle">${escapeHtml(opts.subtitle)}</p>

        <div class="cover-stats">
          <div class="cover-stat">
            <div class="cover-stat-num">${total.toLocaleString('fa-IR')}</div>
            <div class="cover-stat-label">برنامهٔ تلویزیونی</div>
          </div>
          <div class="cover-stat-divider"></div>
          <div class="cover-stat">
            <div class="cover-stat-num">${sortedCategories.length.toLocaleString('fa-IR')}</div>
            <div class="cover-stat-label">دستهٔ ژانری</div>
          </div>
          <div class="cover-stat-divider"></div>
          <div class="cover-stat">
            <div class="cover-stat-num">${faDateShort}</div>
            <div class="cover-stat-label">تاریخ گزارش</div>
          </div>
        </div>

        <div class="cover-meta">
          <div><span>شناسه سند:</span> <strong>${docId}</strong></div>
          <div><span>تهیه‌کننده:</span> <strong>${escapeHtml(opts.organization)}</strong></div>
          <div><span>نسخه:</span> <strong>۲.۰.۰</strong></div>
        </div>

        <div class="cover-footnote">
          این سند به‌صورت خودکار توسط نرم‌افزار آرشیو تخصصی بانک رسانه تولید شده است.<br>
          تمامی داده‌ها از منابع تأییدشده شامل فایل اکسل دسته‌بندی دکور و فایل PDF توضیحات فارسی استخراج شده‌اند.
        </div>
      </div>
    </section>
  `;

  // TABLE OF CONTENTS
  const tocItems = [
    { num: 1, title: 'خلاصه اجرایی', page: '۳' },
    { num: 2, title: 'روش جمع‌آوری و طبقه‌بندی داده', page: '۴' },
    { num: 3, title: 'نمای آماری کلی', page: '۵' },
    { num: 4, title: 'تحلیل توزیع ژانرها', page: '۶' },
    { num: 5, title: 'تحلیل دکور و صحنه', page: '۸' },
    { num: 6, title: 'فهرست تفصیلی برنامه‌ها', page: '۱۰' },
    { num: 7, title: 'نتیجه‌گیری و پیشنهادها', page: '۲۴' },
    { num: 8, title: 'پیوست: نمایهٔ الفبایی', page: '۲۵' },
  ];
  const tocHtml = `
    <section class="toc-section">
      <h2 class="section-title">فهرست مطالب</h2>
      <div class="toc-list">
        ${tocItems.map(t => `
          <div class="toc-item">
            <span class="toc-num">${t.num.toLocaleString('fa-IR')}</span>
            <span class="toc-title">${t.title}</span>
            <span class="toc-dots"></span>
            <span class="toc-page">${t.page}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  // 1. EXECUTIVE SUMMARY
  const execSummary = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۱</span>
        <h2 class="section-title">خلاصه اجرایی</h2>
      </div>
      <p>
        گزارش پیش رو، حاصل بررسی و طبقه‌بندی <strong>${total.toLocaleString('fa-IR')}</strong> برنامهٔ تلویزیونی در قالب
        <strong>${sortedCategories.length.toLocaleString('fa-IR')}</strong> دستهٔ ژانری است که در آرشیو تخصصی بانک رسانه نگهداری
        می‌شود. هدف این آرشیو، فراهم‌آوردن مرجعی جامع و قابل‌استناد از برنامه‌های گفتگومی، تخصصی، فرهنگی، سرگرمی و رئالیتی
        تلویزیونی است تا به مطالعهٔ تطبیقی، تحلیل دکور و صحنه، و تصمیم‌گیری در حوزهٔ تولید محتوا کمک کند.
      </p>
      <p>
        داده‌ها از دو منبع تأییدشده گردآوری شده‌اند: فایل اکسل دسته‌بندی دکور که مشخصات فنی صحنه را در بر دارد، و فایل PDF
        توضیحات فارسی که روایت متنی هر برنامه را شامل می‌شود. در مجموع <strong>${(bySource.pdf + bySource.web).toLocaleString('fa-IR')}</strong>
        برنامه دارای تصویر مرجع (از PDF یا منابع وب) و <strong>${bySource.text.toLocaleString('fa-IR')}</strong> برنامه با تحلیل متنی
        ثبت شده‌اند. این تنوع منابع، اعتبار داده‌ها را در سطح قابل‌قبولی نگه می‌دارد.
      </p>
      <p>
        بزرگ‌ترین دستهٔ ژانری، <strong>${escapeHtml(sortedCategories[0]?.[0] || '—')}</strong> با
        <strong>${(sortedCategories[0]?.[1]?.length || 0).toLocaleString('fa-IR')}</strong> برنامه است و پس از آن دسته‌های
        <strong>${escapeHtml(sortedCategories[1]?.[0] || '—')}</strong> و
        <strong>${escapeHtml(sortedCategories[2]?.[0] || '—')}</strong> قرار دارند. این تمرکز نشان می‌دهد که بخش عمده‌ای از
        آرشیو به برنامه‌های گفتگومی و مصاحبه‌محور اختصاص دارد که با ماهیت آرشیو همخوانی دارد. در ادامه، گزارش به تحلیل
        آماری، بررسی ژانرها، تحلیل دکور و معرفی تفصیلی برنامه‌ها می‌پردازد.
      </p>

      <div class="highlight-box">
        <div class="highlight-title">نکات کلیدی</div>
        <ul class="highlight-list">
          <li>حجم آرشیو: <strong>${total.toLocaleString('fa-IR')}</strong> برنامه در <strong>${sortedCategories.length.toLocaleString('fa-IR')}</strong> دستهٔ ژانری</li>
          <li>پراکندگی منبع داده: <strong>${bySource.pdf.toLocaleString('fa-IR')}</strong> PDF، <strong>${bySource.web.toLocaleString('fa-IR')}</strong> وب، <strong>${bySource.text.toLocaleString('fa-IR')}</strong> متنی</li>
          <li>بزرگ‌ترین دسته: <strong>${escapeHtml(sortedCategories[0]?.[0] || '—')}</strong> (<strong>${((sortedCategories[0]?.[1]?.length || 0) / total * 100).toFixed(0)}%</strong> از کل)</li>
          <li>گزارش شامل توضیحات فارسی، مشخصات دکور و تحلیل آماری است</li>
        </ul>
      </div>
    </section>
  `;

  // 2. METHODOLOGY
  const methodology = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۲</span>
        <h2 class="section-title">روش جمع‌آوری و طبقه‌بندی داده</h2>
      </div>
      <p>
        داده‌های این آرشیو از طریق یک فرایند دو مرحله‌ای گردآوری شده است. در مرحلهٔ نخست، مشخصات فنی هر برنامه شامل
        اندازهٔ استودیو، حضور تماشاگر، سبک دکور، نورپردازی، عناصر صحنه، مصالح به‌کاررفته و طیف رنگی، در قالب یک فایل
        اکسل ساختاریافته ثبت شد. این فایل به‌عنوان منبع اصلی طبقه‌بندی فنی به‌کار رفته و مبنای دسته‌بندی ژانری نیز قرار
        گرفته است. در مرحلهٔ دوم، توضیحات فارسی هر برنامه از یک فایل PDF مرجع استخراج و با مشخصات فنی ادغام شد.
      </p>
      <p>
        طبقه‌بندی ژانری بر اساس محتوای tematique هر برنامه و مشخصات دکور آن انجام شده است. به‌عنوان مثال، برنامه‌هایی
        که با محتوای مصاحبه‌محور و گفتگوی فردی شناخته می‌شوند، در دستهٔ «تاک‌شوی مصاحبه‌محور» قرار گرفته‌اند و
        برنامه‌هایی با محتوای طنز و کمدی، در دستهٔ «تاک‌شوی طنز و کمدی» نگاشته شده‌اند. در مواردی که برنامه‌ها چندژانری
        بودند، دسته‌بندی بر اساس ژانر غالب انجام شده است.
      </p>
      <p>
        در خصوص تصاویر برنامه‌ها، برای بخشی از آرشیو تصاویر مستقیم از فایل PDF استخراج شده و برای بخش دیگر، تصاویر
        از منابع عمومی وب گردآوری شده است. برنامه‌های فاقد تصویر، با تحلیل متنی و رنگ‌آمیزی دکور مشخص شده‌اند. این
        رویکرد ترکیبی، امکان مطالعهٔ تطبیقی برنامه‌ها را بدون نیاز به منابع تک‌بعدی فراهم می‌کند.
      </p>

      <div class="method-grid">
        <div class="method-card">
          <div class="method-icon">📊</div>
          <h4>منبع ۱: اکسل دسته‌بندی</h4>
          <p>شامل ۵۶۰ سطر داده با ۱۲ ستون مشخصات فنی — سبک، اندازه، نورپردازی، عناصر، مصالح، رنگ‌آمیزی.</p>
        </div>
        <div class="method-card">
          <div class="method-icon">📄</div>
          <h4>منبع ۲: PDF توضیحات فارسی</h4>
          <p>استخراج متن فارسی برای ۵۵۹ برنامه با توصیف محتوا، تاریخچه و ویژگی‌های برجستهٔ هر برنامه.</p>
        </div>
        <div class="method-card">
          <div class="method-icon">🖼</div>
          <h4>منبع ۳: تصاویر مرجع</h4>
          <p>${bySource.pdf.toLocaleString('fa-IR')} برنامه با تصویر PDF و ${bySource.web.toLocaleString('fa-IR')} برنامه با تصویر وب — بقیه با تحلیل متنی.</p>
        </div>
        <div class="method-card">
          <div class="method-icon">🏷</div>
          <h4>طبقه‌بندی ژانری</h4>
          <p>${sortedCategories.length.toLocaleString('fa-IR')} دستهٔ ژانری بر اساس محتوای tematique و مشخصات دکور — چندژانری‌ها بر اساس ژانر غالب.</p>
        </div>
      </div>
    </section>
  `;

  // 3. STATISTICAL OVERVIEW
  const statCards = [
    { label: 'کل برنامه‌ها', value: total, color: '#029048' },
    { label: 'دسته‌های ژانری', value: sortedCategories.length, color: '#2563eb' },
    { label: 'برنامه‌های با تصویر', value: bySource.pdf + bySource.web, color: '#7c3aed' },
    { label: 'برنامه‌های با تحلیل متنی', value: bySource.text, color: '#db2777' },
  ];

  // Helper to render a horizontal bar chart
  const renderBarChart = (items: [string, number][], color: string, total?: number) => {
    const t = total || items.reduce((a, [, c]) => a + c, 0) || 1;
    const max = Math.max(...items.map(([, c]) => c), 1);
    return items.map(([k, v]) => `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(k)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${(v / max * 100).toFixed(1)}%; background: ${color};"></div>
        </div>
        <div class="bar-value">${v.toLocaleString('fa-IR')} <span class="bar-pct">(${(v / t * 100).toFixed(0)}%)</span></div>
      </div>
    `).join('');
  };

  const statistics = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۳</span>
        <h2 class="section-title">نمای آماری کلی</h2>
      </div>

      <div class="stat-grid">
        ${statCards.map(s => `
          <div class="stat-card" style="border-top: 4px solid ${s.color};">
            <div class="stat-num" style="color: ${s.color};">${s.value.toLocaleString('fa-IR')}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <h3 class="subsection-title">توزیع بر اساس منبع داده</h3>
      <div class="bar-chart">
        ${renderBarChart([
          ['تصویر PDF', bySource.pdf],
          ['تصویر وب', bySource.web],
          ['تحلیل متنی', bySource.text],
        ], '#029048', total)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس اندازهٔ استودیو</h3>
      <div class="bar-chart">
        ${renderBarChart(Object.entries(sizeBuckets).sort((a, b) => b[1] - a[1]), '#2563eb', total)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس سبک دکور</h3>
      <div class="bar-chart">
        ${renderBarChart(Object.entries(styleBuckets).sort((a, b) => b[1] - a[1]), '#7c3aed', total)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس حضور تماشاگر</h3>
      <div class="bar-chart">
        ${renderBarChart(Object.entries(viewersBuckets).sort((a, b) => b[1] - a[1]), '#db2777', total)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس نورپردازی</h3>
      <div class="bar-chart">
        ${renderBarChart(Object.entries(lightingCounts).sort((a, b) => b[1] - a[1]), '#ea580c', total)}
      </div>
    </section>
  `;

  // 4. GENRE ANALYSIS
  const genreAnalysis = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۴</span>
        <h2 class="section-title">تحلیل توزیع ژانرها</h2>
      </div>
      <p>
        در این بخش، توزیع برنامه‌ها در <strong>${sortedCategories.length.toLocaleString('fa-IR')}</strong> دستهٔ ژانری
        به‌تفصیل بررسی می‌شود. هر دسته با شمارش برنامه‌ها، سهم نسبتی از کل آرشیو، و معرفی کوتاه برنامه‌های شاخص ارائه
        می‌شود. نمودار میله‌ای زیر، توزیع کامل را به‌صورت بصری نمایش می‌دهد.
      </p>

      <h3 class="subsection-title">نمودار توزیع کامل ژانرها</h3>
      <div class="bar-chart">
        ${renderBarChart(sortedCategories.map(([k, v]) => [k, v.length]), '#029048', total)}
      </div>

      <h3 class="subsection-title">معرفی تفصیلی دسته‌ها</h3>
      ${sortedCategories.map(([cat, items], idx) => {
        const pct = (items.length / total * 100).toFixed(1);
        const topShows = items.slice(0, 5).map(s => escapeHtml(s.name)).join('، ');
        return `
          <div class="genre-block">
            <div class="genre-block-header">
              <span class="genre-block-num">${(idx + 1).toLocaleString('fa-IR')}</span>
              <h4 class="genre-block-title">${escapeHtml(cat)}</h4>
              <span class="genre-block-count">${items.length.toLocaleString('fa-IR')} برنامه</span>
              <span class="genre-block-pct">${pct}٪</span>
            </div>
            <div class="genre-block-bar">
              <div class="genre-block-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <p class="genre-block-desc">
              این دسته با <strong>${items.length.toLocaleString('fa-IR')}</strong> برنامه، معادل <strong>${pct}٪</strong> از
              کل آرشیو را در بر می‌گیرد. از برنامه‌های شاخص این دسته می‌توان به ${topShows || '—'} اشاره کرد.
            </p>
          </div>
        `;
      }).join('')}
    </section>
  `;

  // 5. DECOR ANALYSIS
  const decorAnalysis = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۵</span>
        <h2 class="section-title">تحلیل دکور و صحنه</h2>
      </div>
      <p>
        در این بخش، تحلیل آماری مشخصات دکور و صحنهٔ برنامه‌ها ارائه می‌شود. این تحلیل شامل عناصر تکرارشوندهٔ صحنه
        (مانند صفحه نمایش، گیاه، کتاب)، مصالح به‌کاررفته (مانند چوب، شیشه، فلز)، طیف رنگی، و نوع نورپردازی است.
        نتایج این تحلیل می‌تواند به طراحی صحنهٔ برنامه‌های جدید و مطالعهٔ تطبیقی دکور کمک کند.
      </p>

      <div class="decor-grid">
        <div class="decor-block">
          <h4 class="decor-block-title">عناصر صحنه (پرتکرارترین)</h4>
          <div class="bar-chart small">
            ${topElements.length ? renderBarChart(topElements, '#029048', totalForPct(elementCounts)) : '<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">مصالح به‌کاررفته</h4>
          <div class="bar-chart small">
            ${topMaterials.length ? renderBarChart(topMaterials, '#2563eb', totalForPct(materialCounts)) : '<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">طیف رنگی</h4>
          <div class="bar-chart small">
            ${topColors.length ? renderBarChart(topColors, '#7c3aed', totalForPct(colorCounts)) : '<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">نوع نورپردازی</h4>
          <div class="bar-chart small">
            ${renderBarChart(Object.entries(lightingCounts).sort((a, b) => b[1] - a[1]), '#db2777', total)}
          </div>
        </div>
      </div>

      <div class="highlight-box">
        <div class="highlight-title">یافته‌های تحلیل دکور</div>
        <ul class="highlight-list">
          ${topElements.slice(0, 3).map(([e, c]) => `<li>عنصر صحنهٔ پرتکرار: <strong>${escapeHtml(e)}</strong> با ${c.toLocaleString('fa-IR')} مورد</li>`).join('') || '<li>داده‌ای در دسترس نیست.</li>'}
          ${topMaterials.slice(0, 3).map(([m, c]) => `<li>مادهٔ پرکاربرد: <strong>${escapeHtml(m)}</strong> با ${c.toLocaleString('fa-IR')} مورد</li>`).join('') || ''}
          ${topColors.slice(0, 3).map(([c, n]) => `<li>رنگ غالب: <strong>${escapeHtml(c)}</strong> با ${n.toLocaleString('fa-IR')} مورد</li>`).join('') || ''}
        </ul>
      </div>
    </section>
  `;

  // 6. DETAILED PROGRAM LISTINGS — limit to first 80 to keep PDF reasonable
  const DETAIL_LIMIT = Math.min(shows.length, 80);
  const detailShows = shows.slice(0, DETAIL_LIMIT);
  const detailedListings = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۶</span>
        <h2 class="section-title">فهرست تفصیلی برنامه‌ها</h2>
      </div>
      <p>
        در این بخش، مشخصات کامل <strong>${DETAIL_LIMIT.toLocaleString('fa-IR')}</strong> برنامه از مجموع
        <strong>${total.toLocaleString('fa-IR')}</strong> برنامهٔ آرشیو ارائه می‌شود. برای هر برنامه، توضیحات فارسی،
        دسته‌بندی، مشخصات دکور و صحنه و خلاصهٔ تحلیلی آورده شده است. در صورت وجود تصویر مرجع، تصویر نیز درج شده است.
        ${total > DETAIL_LIMIT ? `<br><br><strong>توجه:</strong> به‌دلیل محدودیت حجم گزارش، تنها ${DETAIL_LIMIT.toLocaleString('fa-IR')} برنامهٔ نخست به‌صورت کامل معرفی شده‌اند. برای مشاهدهٔ کامل همهٔ برنامه‌ها، خروجی Excel یا آرشیو آنلاین را ملاحظه فرمایید.` : ''}
      </p>

      ${detailShows.map((s, i) => {
        const desc = s.descriptionFa || s.summary || 'توضیحاتی برای این برنامه ثبت نشده است.';
        const hasImage = s.images && s.images.length > 0;
        return `
          <article class="program-card-print">
            <div class="program-card-header">
              <span class="program-card-num">${(i + 1).toLocaleString('fa-IR')}</span>
              <h3 class="program-card-name">${escapeHtml(s.name)}</h3>
              <span class="program-card-id">شناسه: ${s.num ? s.num.toLocaleString('fa-IR') : (i + 1).toLocaleString('fa-IR')}</span>
            </div>
            <div class="program-card-body">
              ${hasImage ? `
                <div class="program-card-image">
                  <img src="${escapeHtml(s.images[0])}" alt="${escapeHtml(s.name)}" onerror="this.style.display='none';" />
                  <div class="program-card-image-fallback">تصویر بارگذاری نشد</div>
                </div>
              ` : ''}
              <div class="program-card-info">
                <div class="program-card-tags">
                  <span class="tag">${escapeHtml((s.category || 'سایر').replace(/^\d+\.\s*/, ''))}</span>
                  <span class="tag">${escapeHtml(s.style || '—')}</span>
                  <span class="tag">${escapeHtml(s.size || '—')}</span>
                  <span class="tag">${escapeHtml(s.viewers || '—')}</span>
                </div>
                <p class="program-card-desc">${escapeHtml(desc)}</p>
                <div class="program-card-specs">
                  ${s.elements ? `<div class="spec-row"><span class="spec-label">عناصر دکور:</span> <span class="spec-value">${escapeHtml(s.elements)}</span></div>` : ''}
                  ${s.materials ? `<div class="spec-row"><span class="spec-label">مصالح:</span> <span class="spec-value">${escapeHtml(s.materials)}</span></div>` : ''}
                  ${s.colors ? `<div class="spec-row"><span class="spec-label">رنگ‌آمیزی:</span> <span class="spec-value">${escapeHtml(s.colors)}</span></div>` : ''}
                  ${s.lighting ? `<div class="spec-row"><span class="spec-label">نورپردازی:</span> <span class="spec-value">${escapeHtml(s.lighting)}</span></div>` : ''}
                  ${s.layout ? `<div class="spec-row"><span class="spec-label">چیدمان:</span> <span class="spec-value">${escapeHtml(s.layout)}</span></div>` : ''}
                  ${s.effects ? `<div class="spec-row"><span class="spec-label">جلوه‌ها:</span> <span class="spec-value">${escapeHtml(s.effects)}</span></div>` : ''}
                </div>
                ${s.summary && s.summary !== '—' ? `<p class="program-card-summary"><strong>خلاصهٔ دکور:</strong> ${escapeHtml(s.summary)}</p>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </section>
  `;

  // 7. CONCLUSION
  const conclusion = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۷</span>
        <h2 class="section-title">نتیجه‌گیری و پیشنهادها</h2>
      </div>
      <p>
        آرشیو تخصصی بانک رسانه با <strong>${total.toLocaleString('fa-IR')}</strong> برنامه در
        <strong>${sortedCategories.length.toLocaleString('fa-IR')}</strong> دستهٔ ژانری، یکی از جامع‌ترین مراجع موجود در
        حوزهٔ برنامه‌های تلویزیونی است. تنوع ژانری از مصاحبه‌محور تا رئالیتی و از خبری تا فرهنگی، امکان مطالعهٔ تطبیقی
        گسترده‌ای را فراهم می‌کند. تحلیل دکور و صحنه نیز الگوهای پرتکرار طراحی صحنه را آشکار ساخته و می‌تواند مبنای
        طراحی برنامه‌های جدید قرار گیرد.
      </p>
      <p>
        در ادامهٔ مسیر، توصیه می‌شود تصاویر باکیفیت برای همهٔ برنامه‌ها گردآوری شود تا بخش تحلیل بصری نیز تکمیل گردد.
        همچنین، افزودن قابلیت جستجوی پیشرفته بر اساس مشخصات دکور (مانند جستجوی برنامه‌های با نورپردازی گرم و مصالح
        چوبی) می‌تواند ارزش پژوهشی آرشیو را افزایش دهد. در نهایت، به‌روزرسانی منظم آرشیو با برنامه‌های جدید و بازبینی
        دسته‌بندی ژانری، پویایی و اعتبار آن را در بلندمدت تضمین می‌کند.
      </p>

      <div class="highlight-box">
        <div class="highlight-title">پیشنهادهای اجرایی</div>
        <ul class="highlight-list">
          <li>تکمیل تصاویر مرجع برای ${bySource.text.toLocaleString('fa-IR')} برنامهٔ فاقد تصویر</li>
          <li>افزودن قابلیت جستجوی چندبُعدی بر اساس مشخصات دکور</li>
          <li>به‌روزرسانی فصلی آرشیو با برنامه‌های جدید تولیدشده</li>
          <li>تدوین گزارش‌های تخصصی به تفکیک ژانر برای استفادهٔ پژوهشی</li>
          <li>ایجاد نسخهٔ آنلاین آرشیو با قابلیت اشتراک‌گذاری در شبکه‌های اجتماعی</li>
        </ul>
      </div>

      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-meta">
          <div>تهیه و تنظیم: <strong>${escapeHtml(opts.organization)}</strong></div>
          <div>تاریخ: <strong>${faDate}</strong></div>
          <div>شناسه سند: <strong>${docId}</strong></div>
        </div>
      </div>
    </section>
  `;

  // 8. APPENDIX — alphabetical index
  const sortedAlpha = [...shows].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const appendix = `
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۸</span>
        <h2 class="section-title">پیوست: نمایهٔ الفبایی</h2>
      </div>
      <p>
        در این پیوست، فهرست کامل <strong>${total.toLocaleString('fa-IR')}</strong> برنامه به ترتیب الفبایی ارائه می‌شود.
        برای هر برنامه، شمارهٔ داخلی و دستهٔ ژانری درج شده است تا جستجو و ارجاع سریع فراهم باشد.
      </p>
      <div class="alpha-grid">
        ${sortedAlpha.map(s => `
          <div class="alpha-item">
            <span class="alpha-name">${escapeHtml(s.name)}</span>
            <span class="alpha-cat">${escapeHtml((s.category || '').replace(/^\d+\.\s*/, '').substring(0, 30))}</span>
            <span class="alpha-num">#${(s.num || 0).toLocaleString('fa-IR')}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  // ---------- Final HTML assembly ----------
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)} — ${total.toLocaleString('fa-IR')} برنامه</title>
<style>
@font-face {
  font-family: 'Vazirmatn';
  src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2');
  font-weight: 400;
}
@font-face {
  font-family: 'Vazirmatn';
  src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Medium.woff2') format('woff2');
  font-weight: 500;
}
@font-face {
  font-family: 'Vazirmatn';
  src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2') format('woff2');
  font-weight: 700;
}
@font-face {
  font-family: 'Vazirmatn';
  src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Black.woff2') format('woff2');
  font-weight: 900;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Vazirmatn', 'Tahoma', sans-serif;
  color: #1a2e22;
  background: #f5f5f5;
  font-size: 13px;
  line-height: 1.75;
}

/* ============ COVER ============ */
.cover {
  width: 210mm;
  height: 297mm;
  margin: 0 auto;
  background:
    radial-gradient(ellipse 80% 60% at 70% 20%, rgba(54, 179, 126, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse 70% 50% at 25% 80%, rgba(2, 144, 72, 0.4) 0%, transparent 60%),
    linear-gradient(160deg, #010a05 0%, #02150c 50%, #010a05 100%);
  color: white;
  position: relative;
  page-break-after: always;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-bg-deco {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(135deg, transparent 30%, rgba(74, 222, 128, 0.04) 50%, transparent 70%);
  background-size: 30px 30px;
  pointer-events: none;
}
.cover-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 40px;
  max-width: 80%;
}
.cover-brand {
  font-size: 18px;
  letter-spacing: 8px;
  color: rgba(168, 230, 193, 0.6);
  font-weight: 500;
  margin-bottom: 36px;
}
.cover-logo-mark {
  color: #4ade80;
  margin-bottom: 24px;
  filter: drop-shadow(0 0 24px rgba(74, 222, 128, 0.5));
}
.cover-title {
  font-size: 42px;
  font-weight: 900;
  line-height: 1.4;
  margin-bottom: 16px;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}
.cover-subtitle {
  font-size: 18px;
  color: rgba(168, 230, 193, 0.8);
  margin-bottom: 60px;
  font-weight: 400;
}
.cover-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-bottom: 56px;
  padding: 32px 24px;
  background: rgba(2, 144, 72, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.25);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}
.cover-stat-num {
  font-size: 36px;
  font-weight: 900;
  color: #4ade80;
  margin-bottom: 4px;
}
.cover-stat-label {
  font-size: 12px;
  color: rgba(168, 230, 193, 0.7);
}
.cover-stat-divider {
  width: 1px;
  height: 50px;
  background: rgba(74, 222, 128, 0.3);
}
.cover-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 48px;
  font-size: 13px;
  color: rgba(168, 230, 193, 0.8);
}
.cover-meta div { display: flex; gap: 8px; justify-content: center; }
.cover-meta strong { color: white; font-weight: 700; }
.cover-footnote {
  font-size: 11px;
  color: rgba(168, 230, 193, 0.5);
  line-height: 1.8;
  border-top: 1px solid rgba(74, 222, 128, 0.2);
  padding-top: 24px;
}

/* ============ PAGE / SECTION ============ */
.content-section, .toc-section {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: white;
  padding: 24mm 20mm;
  page-break-after: always;
  position: relative;
}
.content-section:last-child { page-break-after: auto; }

.section-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px solid #029048;
}
.section-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #029048 0%, #016035 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(2, 144, 72, 0.3);
}
.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #016035;
  flex: 1;
}

.subsection-title {
  font-size: 16px;
  font-weight: 700;
  color: #016035;
  margin: 28px 0 14px 0;
  padding-right: 12px;
  border-right: 4px solid #029048;
}

.content-section p {
  margin-bottom: 14px;
  text-align: justify;
  color: #2a3a30;
  font-size: 13px;
  line-height: 1.9;
}

/* ============ TOC ============ */
.toc-list { margin-top: 24px; }
.toc-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed #d4d4d4;
}
.toc-num {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(2, 144, 72, 0.1);
  color: #016035;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}
.toc-title { font-weight: 600; color: #1a2e22; }
.toc-dots { flex: 1; border-bottom: 1px dotted #999; margin: 0 8px; transform: translateY(-4px); }
.toc-page { color: #7a8a80; font-size: 12px; }

/* ============ STAT GRID ============ */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 24px 0;
}
.stat-card {
  background: #f8faf9;
  border: 1px solid #e0e8e4;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.stat-num {
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 4px;
}
.stat-label {
  font-size: 11px;
  color: #4a5d52;
}

/* ============ BAR CHART ============ */
.bar-chart { margin: 16px 0 24px 0; }
.bar-chart.small .bar-row { font-size: 11px; padding: 4px 0; }
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}
.bar-label {
  width: 130px;
  flex-shrink: 0;
  color: #2a3a30;
  font-weight: 500;
}
.bar-chart.small .bar-label { width: 100px; }
.bar-track {
  flex: 1;
  height: 18px;
  background: #f0f4f1;
  border-radius: 9px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 9px;
  transition: width 0.4s ease;
  background-image: linear-gradient(90deg, rgba(255,255,255,0.2), transparent);
}
.bar-value {
  width: 80px;
  flex-shrink: 0;
  text-align: left;
  font-weight: 700;
  color: #1a2e22;
}
.bar-pct { font-weight: 400; color: #7a8a80; font-size: 11px; }

/* ============ METHOD GRID ============ */
.method-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 24px;
}
.method-card {
  background: #f8faf9;
  border: 1px solid #e0e8e4;
  border-radius: 12px;
  padding: 16px;
}
.method-icon { font-size: 24px; margin-bottom: 8px; }
.method-card h4 {
  font-size: 14px;
  color: #016035;
  margin-bottom: 6px;
  font-weight: 700;
}
.method-card p { font-size: 12px; margin: 0; color: #4a5d52; }

/* ============ GENRE BLOCK ============ */
.genre-block {
  background: #f8faf9;
  border: 1px solid #e0e8e4;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}
.genre-block-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.genre-block-num {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #029048;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 11px;
}
.genre-block-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a2e22;
  flex: 1;
}
.genre-block-count {
  background: rgba(2, 144, 72, 0.1);
  color: #016035;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}
.genre-block-pct {
  color: #7a8a80;
  font-size: 11px;
  font-weight: 600;
}
.genre-block-bar {
  height: 6px;
  background: #e0e8e4;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.genre-block-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #029048, #36b37e);
  border-radius: 3px;
}
.genre-block-desc {
  font-size: 12px;
  color: #4a5d52;
  line-height: 1.7;
}

/* ============ DECOR GRID ============ */
.decor-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.decor-block {
  background: #f8faf9;
  border: 1px solid #e0e8e4;
  border-radius: 12px;
  padding: 14px;
}
.decor-block-title {
  font-size: 14px;
  font-weight: 700;
  color: #016035;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e8e4;
}

/* ============ HIGHLIGHT BOX ============ */
.highlight-box {
  background: linear-gradient(135deg, #f0f8f4 0%, #e8f4ee 100%);
  border: 1px solid #c8e0d4;
  border-right: 4px solid #029048;
  border-radius: 12px;
  padding: 16px 20px;
  margin: 24px 0;
}
.highlight-title {
  font-weight: 700;
  color: #016035;
  margin-bottom: 10px;
  font-size: 14px;
}
.highlight-list { list-style: none; padding: 0; }
.highlight-list li {
  position: relative;
  padding-right: 20px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #2a3a30;
  line-height: 1.8;
}
.highlight-list li::before {
  content: '✓';
  position: absolute;
  right: 0;
  color: #029048;
  font-weight: 700;
}

/* ============ PROGRAM CARD ============ */
.program-card-print {
  background: white;
  border: 1px solid #e0e8e4;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 16px;
  page-break-inside: avoid;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.program-card-header {
  background: linear-gradient(135deg, #f0f8f4 0%, #e8f4ee 100%);
  border-bottom: 1px solid #c8e0d4;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.program-card-num {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #029048;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}
.program-card-name {
  font-size: 15px;
  font-weight: 700;
  color: #1a2e22;
  flex: 1;
  direction: ltr;
  text-align: right;
}
.program-card-id {
  font-size: 10px;
  color: #7a8a80;
  font-weight: 500;
}
.program-card-body {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
}
.program-card-image {
  width: 120px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f4f1;
  position: relative;
}
.program-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.program-card-image-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #999;
  background: #f0f4f1;
}
.program-card-info { flex: 1; min-width: 0; }
.program-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.tag {
  background: rgba(2, 144, 72, 0.08);
  color: #016035;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid rgba(2, 144, 72, 0.15);
}
.program-card-desc {
  font-size: 12px;
  color: #2a3a30;
  line-height: 1.8;
  margin-bottom: 8px;
  text-align: justify;
}
.program-card-specs {
  background: #f8faf9;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
}
.spec-row {
  display: flex;
  gap: 8px;
  margin-bottom: 3px;
}
.spec-label {
  color: #7a8a80;
  font-weight: 600;
  min-width: 80px;
}
.spec-value { color: #2a3a30; flex: 1; }
.program-card-summary {
  font-size: 11px;
  color: #4a5d52;
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(2, 144, 72, 0.04);
  border-radius: 6px;
  line-height: 1.7;
}

/* ============ SIGNATURE ============ */
.signature-block {
  margin-top: 60px;
  padding-top: 24px;
}
.signature-line {
  width: 200px;
  height: 1px;
  background: #999;
  margin: 0 0 16px auto;
}
.signature-meta {
  text-align: left;
  font-size: 12px;
  color: #4a5d52;
}
.signature-meta div { margin-bottom: 4px; }
.signature-meta strong { color: #1a2e22; }

/* ============ ALPHA INDEX ============ */
.alpha-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-top: 16px;
}
.alpha-item {
  background: #f8faf9;
  border: 1px solid #e0e8e4;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.alpha-name {
  font-weight: 600;
  color: #1a2e22;
  flex: 1;
  direction: ltr;
  text-align: right;
}
.alpha-cat {
  color: #7a8a80;
  font-size: 10px;
}
.alpha-num {
  background: rgba(2, 144, 72, 0.1);
  color: #016035;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 12px;
}

/* ============ PRINT ============ */
@media print {
  body { background: white; }
  .cover, .content-section, .toc-section {
    margin: 0;
    box-shadow: none;
  }
  @page { size: A4; margin: 0; }
}
@media screen {
  body { padding: 20px 0; }
}
</style>
</head>
<body>
${cover}
${tocHtml}
${execSummary}
${methodology}
${statistics}
${genreAnalysis}
${decorAnalysis}
${detailedListings}
${conclusion}
${appendix}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
