(()=>{var a={};a.id=501,a.ids=[501],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},3033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},6487:()=>{},7781:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>E,patchFetch:()=>D,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var d={};c.r(d),c.d(d,{POST:()=>x,runtime:()=>w});var e=c(9225),f=c(4006),g=c(8317),h=c(9373),i=c(4775),j=c(4235),k=c(261),l=c(4365),m=c(771),n=c(3461),o=c(7798),p=c(2280),q=c(2018),r=c(5696),s=c(7929),t=c(6439),u=c(7527),v=c(5592);let w="nodejs";async function x(a){try{var b,c;let d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,w,x,z,A,B,C,D,E,F,G,H,I,J,K,L,M,{shows:N,title:O,subtitle:P,organization:Q}=await a.json();if(!N||!Array.isArray(N)||0===N.length)return v.NextResponse.json({error:"No shows provided"},{status:400});let R=(b=N,c={title:O||"گزارش جامع آرشیو برنامه‌های تلویزیونی",subtitle:P||"بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی",organization:Q||"بانک رسانه"},e=(d=new Date).toLocaleDateString("fa-IR",{year:"numeric",month:"long",day:"numeric"}),f=d.toLocaleDateString("fa-IR"),g=`BR-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${b.length}`,h=b.length,i={},b.forEach(a=>{let b=(a.category||"سایر").replace(/^\d+\.\s*/,"").trim()||"سایر";i[b]||(i[b]=[]),i[b].push(a)}),j=Object.entries(i).sort((a,b)=>b[1].length-a[1].length),k={pdf:b.filter(a=>"تصویر PDF"===a.source).length,web:b.filter(a=>"تصویر وب"===a.source).length,text:b.filter(a=>"متن"===a.source||!a.source).length},l={},b.forEach(a=>{let b=a.size||"نامشخص";l[b]=(l[b]||0)+1}),m={},b.forEach(a=>{let b=a.style||"نامشخص";m[b]=(m[b]||0)+1}),n={},b.forEach(a=>{let b=a.viewers||"نامشخص";n[b]=(n[b]||0)+1}),o={},b.forEach(a=>{a.elements&&a.elements.split(/[,,،]/).map(a=>a.trim().toLowerCase()).filter(Boolean).forEach(a=>{o[a]=(o[a]||0)+1})}),p=Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,12),q={},b.forEach(a=>{a.materials&&a.materials.split(/[,,،]/).map(a=>a.trim().toLowerCase()).filter(Boolean).forEach(a=>{q[a]=(q[a]||0)+1})}),r=Object.entries(q).sort((a,b)=>b[1]-a[1]).slice(0,12),s={},b.forEach(a=>{a.colors&&a.colors.split(/[,,،]/).map(a=>a.trim().toLowerCase()).filter(Boolean).forEach(a=>{s[a]=(s[a]||0)+1})}),t=Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,12),u={},b.forEach(a=>{let b=a.lighting||"نامشخص";u[b]=(u[b]||0)+1}),w=a=>Object.values(a).reduce((a,b)=>a+b,0)||1,x=`
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
        <h1 class="cover-title">${y(c.title)}</h1>
        <p class="cover-subtitle">${y(c.subtitle)}</p>

        <div class="cover-stats">
          <div class="cover-stat">
            <div class="cover-stat-num">${h.toLocaleString("fa-IR")}</div>
            <div class="cover-stat-label">برنامهٔ تلویزیونی</div>
          </div>
          <div class="cover-stat-divider"></div>
          <div class="cover-stat">
            <div class="cover-stat-num">${j.length.toLocaleString("fa-IR")}</div>
            <div class="cover-stat-label">دستهٔ ژانری</div>
          </div>
          <div class="cover-stat-divider"></div>
          <div class="cover-stat">
            <div class="cover-stat-num">${f}</div>
            <div class="cover-stat-label">تاریخ گزارش</div>
          </div>
        </div>

        <div class="cover-meta">
          <div><span>شناسه سند:</span> <strong>${g}</strong></div>
          <div><span>تهیه‌کننده:</span> <strong>${y(c.organization)}</strong></div>
          <div><span>نسخه:</span> <strong>۲.۰.۰</strong></div>
        </div>

        <div class="cover-footnote">
          این سند به‌صورت خودکار توسط نرم‌افزار آرشیو تخصصی بانک رسانه تولید شده است.<br>
          تمامی داده‌ها از منابع تأییدشده شامل فایل اکسل دسته‌بندی دکور و فایل PDF توضیحات فارسی استخراج شده‌اند.
        </div>
      </div>
    </section>
  `,z=`
    <section class="toc-section">
      <h2 class="section-title">فهرست مطالب</h2>
      <div class="toc-list">
        ${[{num:1,title:"خلاصه اجرایی",page:"۳"},{num:2,title:"روش جمع‌آوری و طبقه‌بندی داده",page:"۴"},{num:3,title:"نمای آماری کلی",page:"۵"},{num:4,title:"تحلیل توزیع ژانرها",page:"۶"},{num:5,title:"تحلیل دکور و صحنه",page:"۸"},{num:6,title:"فهرست تفصیلی برنامه‌ها",page:"۱۰"},{num:7,title:"نتیجه‌گیری و پیشنهادها",page:"۲۴"},{num:8,title:"پیوست: نمایهٔ الفبایی",page:"۲۵"}].map(a=>`
          <div class="toc-item">
            <span class="toc-num">${a.num.toLocaleString("fa-IR")}</span>
            <span class="toc-title">${a.title}</span>
            <span class="toc-dots"></span>
            <span class="toc-page">${a.page}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `,A=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۱</span>
        <h2 class="section-title">خلاصه اجرایی</h2>
      </div>
      <p>
        گزارش پیش رو، حاصل بررسی و طبقه‌بندی <strong>${h.toLocaleString("fa-IR")}</strong> برنامهٔ تلویزیونی در قالب
        <strong>${j.length.toLocaleString("fa-IR")}</strong> دستهٔ ژانری است که در آرشیو تخصصی بانک رسانه نگهداری
        می‌شود. هدف این آرشیو، فراهم‌آوردن مرجعی جامع و قابل‌استناد از برنامه‌های گفتگومی، تخصصی، فرهنگی، سرگرمی و رئالیتی
        تلویزیونی است تا به مطالعهٔ تطبیقی، تحلیل دکور و صحنه، و تصمیم‌گیری در حوزهٔ تولید محتوا کمک کند.
      </p>
      <p>
        داده‌ها از دو منبع تأییدشده گردآوری شده‌اند: فایل اکسل دسته‌بندی دکور که مشخصات فنی صحنه را در بر دارد، و فایل PDF
        توضیحات فارسی که روایت متنی هر برنامه را شامل می‌شود. در مجموع <strong>${(k.pdf+k.web).toLocaleString("fa-IR")}</strong>
        برنامه دارای تصویر مرجع (از PDF یا منابع وب) و <strong>${k.text.toLocaleString("fa-IR")}</strong> برنامه با تحلیل متنی
        ثبت شده‌اند. این تنوع منابع، اعتبار داده‌ها را در سطح قابل‌قبولی نگه می‌دارد.
      </p>
      <p>
        بزرگ‌ترین دستهٔ ژانری، <strong>${y(j[0]?.[0]||"—")}</strong> با
        <strong>${(j[0]?.[1]?.length||0).toLocaleString("fa-IR")}</strong> برنامه است و پس از آن دسته‌های
        <strong>${y(j[1]?.[0]||"—")}</strong> و
        <strong>${y(j[2]?.[0]||"—")}</strong> قرار دارند. این تمرکز نشان می‌دهد که بخش عمده‌ای از
        آرشیو به برنامه‌های گفتگومی و مصاحبه‌محور اختصاص دارد که با ماهیت آرشیو همخوانی دارد. در ادامه، گزارش به تحلیل
        آماری، بررسی ژانرها، تحلیل دکور و معرفی تفصیلی برنامه‌ها می‌پردازد.
      </p>

      <div class="highlight-box">
        <div class="highlight-title">نکات کلیدی</div>
        <ul class="highlight-list">
          <li>حجم آرشیو: <strong>${h.toLocaleString("fa-IR")}</strong> برنامه در <strong>${j.length.toLocaleString("fa-IR")}</strong> دستهٔ ژانری</li>
          <li>پراکندگی منبع داده: <strong>${k.pdf.toLocaleString("fa-IR")}</strong> PDF، <strong>${k.web.toLocaleString("fa-IR")}</strong> وب، <strong>${k.text.toLocaleString("fa-IR")}</strong> متنی</li>
          <li>بزرگ‌ترین دسته: <strong>${y(j[0]?.[0]||"—")}</strong> (<strong>${((j[0]?.[1]?.length||0)/h*100).toFixed(0)}%</strong> از کل)</li>
          <li>گزارش شامل توضیحات فارسی، مشخصات دکور و تحلیل آماری است</li>
        </ul>
      </div>
    </section>
  `,B=`
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
        که با محتوای مصاحبه‌محور و گفتگوی فردی شناخته می‌شوند، در دستهٔ \xabتاک‌شوی مصاحبه‌محور\xbb قرار گرفته‌اند و
        برنامه‌هایی با محتوای طنز و کمدی، در دستهٔ \xabتاک‌شوی طنز و کمدی\xbb نگاشته شده‌اند. در مواردی که برنامه‌ها چندژانری
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
          <p>${k.pdf.toLocaleString("fa-IR")} برنامه با تصویر PDF و ${k.web.toLocaleString("fa-IR")} برنامه با تصویر وب — بقیه با تحلیل متنی.</p>
        </div>
        <div class="method-card">
          <div class="method-icon">🏷</div>
          <h4>طبقه‌بندی ژانری</h4>
          <p>${j.length.toLocaleString("fa-IR")} دستهٔ ژانری بر اساس محتوای tematique و مشخصات دکور — چندژانری‌ها بر اساس ژانر غالب.</p>
        </div>
      </div>
    </section>
  `,C=[{label:"کل برنامه‌ها",value:h,color:"#029048"},{label:"دسته‌های ژانری",value:j.length,color:"#2563eb"},{label:"برنامه‌های با تصویر",value:k.pdf+k.web,color:"#7c3aed"},{label:"برنامه‌های با تحلیل متنی",value:k.text,color:"#db2777"}],D=(a,b,c)=>{let d=c||a.reduce((a,[,b])=>a+b,0)||1,e=Math.max(...a.map(([,a])=>a),1);return a.map(([a,c])=>`
      <div class="bar-row">
        <div class="bar-label">${y(a)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${(c/e*100).toFixed(1)}%; background: ${b};"></div>
        </div>
        <div class="bar-value">${c.toLocaleString("fa-IR")} <span class="bar-pct">(${(c/d*100).toFixed(0)}%)</span></div>
      </div>
    `).join("")},E=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۳</span>
        <h2 class="section-title">نمای آماری کلی</h2>
      </div>

      <div class="stat-grid">
        ${C.map(a=>`
          <div class="stat-card" style="border-top: 4px solid ${a.color};">
            <div class="stat-num" style="color: ${a.color};">${a.value.toLocaleString("fa-IR")}</div>
            <div class="stat-label">${a.label}</div>
          </div>
        `).join("")}
      </div>

      <h3 class="subsection-title">توزیع بر اساس منبع داده</h3>
      <div class="bar-chart">
        ${D([["تصویر PDF",k.pdf],["تصویر وب",k.web],["تحلیل متنی",k.text]],"#029048",h)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس اندازهٔ استودیو</h3>
      <div class="bar-chart">
        ${D(Object.entries(l).sort((a,b)=>b[1]-a[1]),"#2563eb",h)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس سبک دکور</h3>
      <div class="bar-chart">
        ${D(Object.entries(m).sort((a,b)=>b[1]-a[1]),"#7c3aed",h)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس حضور تماشاگر</h3>
      <div class="bar-chart">
        ${D(Object.entries(n).sort((a,b)=>b[1]-a[1]),"#db2777",h)}
      </div>

      <h3 class="subsection-title">توزیع بر اساس نورپردازی</h3>
      <div class="bar-chart">
        ${D(Object.entries(u).sort((a,b)=>b[1]-a[1]),"#ea580c",h)}
      </div>
    </section>
  `,F=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۴</span>
        <h2 class="section-title">تحلیل توزیع ژانرها</h2>
      </div>
      <p>
        در این بخش، توزیع برنامه‌ها در <strong>${j.length.toLocaleString("fa-IR")}</strong> دستهٔ ژانری
        به‌تفصیل بررسی می‌شود. هر دسته با شمارش برنامه‌ها، سهم نسبتی از کل آرشیو، و معرفی کوتاه برنامه‌های شاخص ارائه
        می‌شود. نمودار میله‌ای زیر، توزیع کامل را به‌صورت بصری نمایش می‌دهد.
      </p>

      <h3 class="subsection-title">نمودار توزیع کامل ژانرها</h3>
      <div class="bar-chart">
        ${D(j.map(([a,b])=>[a,b.length]),"#029048",h)}
      </div>

      <h3 class="subsection-title">معرفی تفصیلی دسته‌ها</h3>
      ${j.map(([a,b],c)=>{let d=(b.length/h*100).toFixed(1),e=b.slice(0,5).map(a=>y(a.name)).join("، ");return`
          <div class="genre-block">
            <div class="genre-block-header">
              <span class="genre-block-num">${(c+1).toLocaleString("fa-IR")}</span>
              <h4 class="genre-block-title">${y(a)}</h4>
              <span class="genre-block-count">${b.length.toLocaleString("fa-IR")} برنامه</span>
              <span class="genre-block-pct">${d}٪</span>
            </div>
            <div class="genre-block-bar">
              <div class="genre-block-bar-fill" style="width: ${d}%;"></div>
            </div>
            <p class="genre-block-desc">
              این دسته با <strong>${b.length.toLocaleString("fa-IR")}</strong> برنامه، معادل <strong>${d}٪</strong> از
              کل آرشیو را در بر می‌گیرد. از برنامه‌های شاخص این دسته می‌توان به ${e||"—"} اشاره کرد.
            </p>
          </div>
        `}).join("")}
    </section>
  `,G=`
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
            ${p.length?D(p,"#029048",w(o)):'<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">مصالح به‌کاررفته</h4>
          <div class="bar-chart small">
            ${r.length?D(r,"#2563eb",w(q)):'<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">طیف رنگی</h4>
          <div class="bar-chart small">
            ${t.length?D(t,"#7c3aed",w(s)):'<p class="empty-state">داده‌ای ثبت نشده است.</p>'}
          </div>
        </div>
        <div class="decor-block">
          <h4 class="decor-block-title">نوع نورپردازی</h4>
          <div class="bar-chart small">
            ${D(Object.entries(u).sort((a,b)=>b[1]-a[1]),"#db2777",h)}
          </div>
        </div>
      </div>

      <div class="highlight-box">
        <div class="highlight-title">یافته‌های تحلیل دکور</div>
        <ul class="highlight-list">
          ${p.slice(0,3).map(([a,b])=>`<li>عنصر صحنهٔ پرتکرار: <strong>${y(a)}</strong> با ${b.toLocaleString("fa-IR")} مورد</li>`).join("")||"<li>داده‌ای در دسترس نیست.</li>"}
          ${r.slice(0,3).map(([a,b])=>`<li>مادهٔ پرکاربرد: <strong>${y(a)}</strong> با ${b.toLocaleString("fa-IR")} مورد</li>`).join("")||""}
          ${t.slice(0,3).map(([a,b])=>`<li>رنگ غالب: <strong>${y(a)}</strong> با ${b.toLocaleString("fa-IR")} مورد</li>`).join("")||""}
        </ul>
      </div>
    </section>
  `,H=Math.min(b.length,80),I=b.slice(0,H),J=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۶</span>
        <h2 class="section-title">فهرست تفصیلی برنامه‌ها</h2>
      </div>
      <p>
        در این بخش، مشخصات کامل <strong>${H.toLocaleString("fa-IR")}</strong> برنامه از مجموع
        <strong>${h.toLocaleString("fa-IR")}</strong> برنامهٔ آرشیو ارائه می‌شود. برای هر برنامه، توضیحات فارسی،
        دسته‌بندی، مشخصات دکور و صحنه و خلاصهٔ تحلیلی آورده شده است. در صورت وجود تصویر مرجع، تصویر نیز درج شده است.
        ${h>H?`<br><br><strong>توجه:</strong> به‌دلیل محدودیت حجم گزارش، تنها ${H.toLocaleString("fa-IR")} برنامهٔ نخست به‌صورت کامل معرفی شده‌اند. برای مشاهدهٔ کامل همهٔ برنامه‌ها، خروجی Excel یا آرشیو آنلاین را ملاحظه فرمایید.`:""}
      </p>

      ${I.map((a,b)=>{let c=a.descriptionFa||a.summary||"توضیحاتی برای این برنامه ثبت نشده است.",d=a.images&&a.images.length>0;return`
          <article class="program-card-print">
            <div class="program-card-header">
              <span class="program-card-num">${(b+1).toLocaleString("fa-IR")}</span>
              <h3 class="program-card-name">${y(a.name)}</h3>
              <span class="program-card-id">شناسه: ${a.num?a.num.toLocaleString("fa-IR"):(b+1).toLocaleString("fa-IR")}</span>
            </div>
            <div class="program-card-body">
              ${d?`
                <div class="program-card-image">
                  <img src="${y(a.images[0])}" alt="${y(a.name)}" onerror="this.style.display='none';" />
                  <div class="program-card-image-fallback">تصویر بارگذاری نشد</div>
                </div>
              `:""}
              <div class="program-card-info">
                <div class="program-card-tags">
                  <span class="tag">${y((a.category||"سایر").replace(/^\d+\.\s*/,""))}</span>
                  <span class="tag">${y(a.style||"—")}</span>
                  <span class="tag">${y(a.size||"—")}</span>
                  <span class="tag">${y(a.viewers||"—")}</span>
                </div>
                <p class="program-card-desc">${y(c)}</p>
                <div class="program-card-specs">
                  ${a.elements?`<div class="spec-row"><span class="spec-label">عناصر دکور:</span> <span class="spec-value">${y(a.elements)}</span></div>`:""}
                  ${a.materials?`<div class="spec-row"><span class="spec-label">مصالح:</span> <span class="spec-value">${y(a.materials)}</span></div>`:""}
                  ${a.colors?`<div class="spec-row"><span class="spec-label">رنگ‌آمیزی:</span> <span class="spec-value">${y(a.colors)}</span></div>`:""}
                  ${a.lighting?`<div class="spec-row"><span class="spec-label">نورپردازی:</span> <span class="spec-value">${y(a.lighting)}</span></div>`:""}
                  ${a.layout?`<div class="spec-row"><span class="spec-label">چیدمان:</span> <span class="spec-value">${y(a.layout)}</span></div>`:""}
                  ${a.effects?`<div class="spec-row"><span class="spec-label">جلوه‌ها:</span> <span class="spec-value">${y(a.effects)}</span></div>`:""}
                </div>
                ${a.summary&&"—"!==a.summary?`<p class="program-card-summary"><strong>خلاصهٔ دکور:</strong> ${y(a.summary)}</p>`:""}
              </div>
            </div>
          </article>
        `}).join("")}
    </section>
  `,K=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۷</span>
        <h2 class="section-title">نتیجه‌گیری و پیشنهادها</h2>
      </div>
      <p>
        آرشیو تخصصی بانک رسانه با <strong>${h.toLocaleString("fa-IR")}</strong> برنامه در
        <strong>${j.length.toLocaleString("fa-IR")}</strong> دستهٔ ژانری، یکی از جامع‌ترین مراجع موجود در
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
          <li>تکمیل تصاویر مرجع برای ${k.text.toLocaleString("fa-IR")} برنامهٔ فاقد تصویر</li>
          <li>افزودن قابلیت جستجوی چندبُعدی بر اساس مشخصات دکور</li>
          <li>به‌روزرسانی فصلی آرشیو با برنامه‌های جدید تولیدشده</li>
          <li>تدوین گزارش‌های تخصصی به تفکیک ژانر برای استفادهٔ پژوهشی</li>
          <li>ایجاد نسخهٔ آنلاین آرشیو با قابلیت اشتراک‌گذاری در شبکه‌های اجتماعی</li>
        </ul>
      </div>

      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-meta">
          <div>تهیه و تنظیم: <strong>${y(c.organization)}</strong></div>
          <div>تاریخ: <strong>${e}</strong></div>
          <div>شناسه سند: <strong>${g}</strong></div>
        </div>
      </div>
    </section>
  `,L=[...b].sort((a,b)=>(a.name||"").localeCompare(b.name||"")),M=`
    <section class="content-section">
      <div class="section-header">
        <span class="section-num">۸</span>
        <h2 class="section-title">پیوست: نمایهٔ الفبایی</h2>
      </div>
      <p>
        در این پیوست، فهرست کامل <strong>${h.toLocaleString("fa-IR")}</strong> برنامه به ترتیب الفبایی ارائه می‌شود.
        برای هر برنامه، شمارهٔ داخلی و دستهٔ ژانری درج شده است تا جستجو و ارجاع سریع فراهم باشد.
      </p>
      <div class="alpha-grid">
        ${L.map(a=>`
          <div class="alpha-item">
            <span class="alpha-name">${y(a.name)}</span>
            <span class="alpha-cat">${y((a.category||"").replace(/^\d+\.\s*/,"").substring(0,30))}</span>
            <span class="alpha-num">#${(a.num||0).toLocaleString("fa-IR")}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `,`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${y(c.title)} — ${h.toLocaleString("fa-IR")} برنامه</title>
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
${x}
${z}
${A}
${B}
${E}
${F}
${G}
${J}
${K}
${M}
</body>
</html>`);return new v.NextResponse(R,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="banke-rasane-report-${Date.now()}.html"`}})}catch(a){return console.error("PDF export error:",a),v.NextResponse.json({error:"PDF export failed",details:a instanceof Error?a.message:String(a)},{status:500})}}function y(a){return null==a?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/export-pdf/route",pathname:"/api/export-pdf",filename:"route",bundlePath:"app/api/export-pdf/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/z/my-project/src/app/api/export-pdf/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function D(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function E(a,b,c){z.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/export-pdf/route";"/index"===d&&(d="/");let e=await z.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(A.dynamicRoutes[H]||A.routes[E]),J=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!A.routes[E],b=A.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.experimental.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||z.isDev||y||(K="/index"===(K=E)?"/":K);let L=!0===z.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q={params:v,prerenderManifest:A,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>z.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g}},R=new l.NodeNextRequest(a),S=new l.NodeNextResponse(b),T=m.NextRequestAdapter.fromNodeNextRequest(R,(0,m.signalFromNodeResponse)(b));try{let e=async a=>z.handle(T,Q).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=c.get("next.route");if(e){let b=`${N} ${e}`;a.setAttributes({"next.route":e,"http.route":e,"next.span_name":b}),a.updateName(b)}else a.updateName(`${N} ${d}`)}),g=!!(0,h.getRequestMeta)(a,"minimalMode"),j=async h=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!g&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await e(h);a.fetchMetrics=Q.renderOpts.fetchMetrics;let i=Q.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=Q.renderOpts.collectedTags;if(!I)return await (0,p.I)(R,S,d,Q.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);j&&(b[s.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==Q.renderOpts.collectedRevalidate&&!(Q.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&Q.renderOpts.collectedRevalidate,e=void 0===Q.renderOpts.collectedExpire||Q.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:Q.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),b}},l=await z.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:k,waitUntil:c.waitUntil,isMinimalMode:g});if(!I)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});g||b.setHeader("x-nextjs-cache",C?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,q.fromNodeOutgoingHttpHeaders)(l.value.headers);return g&&I||m.delete(s.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,r.getCacheControlHeader)(l.cacheControl)),await (0,p.I)(R,S,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};P?await j(P):await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},j))}catch(b){if(b instanceof t.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),I)throw b;return await (0,p.I)(R,S,new Response(null,{status:500})),null}}},8335:()=>{},9294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,813],()=>b(b.s=7781));module.exports=c})();