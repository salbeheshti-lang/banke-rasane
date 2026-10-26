export default function TestPage() {
  return (
    <div style={{ background: '#029048', color: 'white', minHeight: '100vh', padding: 40, fontFamily: 'sans-serif', direction: 'rtl' }}>
      <h1 style={{ fontSize: 32 }}>✅ صفحه تست — اگه اینو می‌بینی، پراکسی کار می‌کنه!</h1>
      <p style={{ fontSize: 18, marginTop: 20 }}>این یه صفحه‌ی ساده بدون JavaScript پیچیده‌ست.</p>
      <p style={{ marginTop: 20, color: '#a8e6c1' }}>اگه صفحه‌ی اصلی سفیده ولی این صفحه کار می‌کنه، مشکل از کد login page هست.</p>
      <p style={{ marginTop: 20, color: '#a8e6c1' }}>اگه این صفحه هم سفیده، مشکل از پراکسی preview هست.</p>
    </div>
  );
}
