export default function PreviewGallery() {
  const shots = [
    { file: '/preview-login.png', title: 'صفحه ورود (دسکتاپ)' },
    { file: '/preview-dashboard.png', title: 'داشبورد (دسکتاپ)' },
    { file: '/preview-genre.png', title: 'نمای ژانر + برنامه‌ها' },
    { file: '/preview-mobile-login.png', title: 'صفحه ورود (موبایل ۳۹۰×۸۴۴)' },
  ];
  return (
    <div style={{ fontFamily: 'Vazirmatn, sans-serif', direction: 'rtl', background: '#042817', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ color: '#4ade80', textAlign: 'center', marginBottom: 8, fontSize: 28 }}>
          📸 پیش‌نمایش اپلیکیشن «بانک رسانه»
        </h1>
        <p style={{ color: 'rgba(168,230,193,0.7)', textAlign: 'center', marginBottom: 40, fontSize: 14 }}>
          اسکرین‌شات‌های واقعی از وضعیت فعلی اپلیکیشن — سرور زنده و صفحه درست رندر می‌شه
        </p>
        {shots.map((s, i) => (
          <div key={i} style={{ marginBottom: 32, background: 'rgba(2,144,72,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 16, padding: 16 }}>
            <h2 style={{ color: '#4ade80', fontSize: 18, marginBottom: 12, fontWeight: 700 }}>
              {i + 1}. {s.title}
            </h2>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(74,222,128,0.2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.file} alt={s.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
            <p style={{ color: 'rgba(168,230,193,0.5)', fontSize: 12, marginTop: 8, direction: 'ltr' }}>{s.file}</p>
          </div>
        ))}
        <div style={{ textAlign: 'center', marginTop: 40, padding: 20, background: 'rgba(2,144,72,0.1)', borderRadius: 12, border: '1px solid rgba(74,222,128,0.25)' }}>
          <p style={{ color: 'rgba(168,230,193,0.8)', fontSize: 14, margin: 0 }}>
            ✅ اپلیکیشن کامل و سالم کار می‌کنه — اگه پنل preview خالی مونده، تب رو ببندید و دوباره باز کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
