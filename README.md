# بانک رسانه — BankResaneh

آرشیو تخصصی برنامه‌های تلویزیونی با ۲۰۸۸ برنامه، پنل مدیریت، سیستم کاربری و نقش‌ها (admin/editor/viewer)، گزارش‌گیری PDF و رابط کاربری Liquid Glass فارسی-RTL.

## ساخت نسخه‌های قابل دانلود

سه نسخه به‌صورت خودکار روی GitHub Actions ساخته می‌شوند:

| نسخه | پلتفرم | خروجی |
|------|--------|-------|
| **ویندوز (.exe)** | Windows 10+ | NSIS installer |
| **اندروید (.apk)** | Android 7+ | Debug APK |
| **وب** | Static hosting | ZIP (HTML + assets) |

### راه‌اندازی build خودکار

کافیست یک tag با فرمت `vX.Y.Z` بسازید و push کنید:

```bash
git tag v1.0.0
git push origin v1.0.0
```

هر سه workflow به‌طور همزمان اجرا می‌شوند و خروجی‌ها به Release مربوطه attach می‌شوند:

- [.exe build](https://github.com/salbeheshti-lang/banke-rasane/actions/workflows/build-exe.yml)
- [.apk build](https://github.com/salbeheshti-lang/banke-rasane/actions/workflows/build-apk.yml)
- [web build](https://github.com/salbeheshti-lang/banke-rasane/actions/workflows/build-web.yml)

### دانلود مستقیم

پس از اتمام build، فایل‌ها از صفحه Releases قابل دانلود هستند:

🔗 https://github.com/salbeheshti-lang/banke-rasane/releases

یا لینک مستقیم آخرین نسخه:

🔗 https://github.com/salbeheshti-lang/banke-rasane/releases/latest

## ساخت دستی (Local Build)

### ویندوز (.exe)

نیاز: Node 20+, Bun, ویندوز 10+

```bash
git clone https://github.com/salbeheshti-lang/banke-rasane
cd banke-rasane
bun install
cd mini-services/api-service && bun install && cd ../..
bun run electron:build
# → خروجی در release/*-Setup.exe
```

### توسعه (Dev)

```bash
bun install
cd mini-services/api-service && bun install && cd ../..
bun run dev          # Next.js روی پورت 3000
# در ترمینال جداگانه:
cd mini-services/api-service && bun run dev   # API روی پورت 3002
```

## ورود

- نام کاربری: `admin`
- رمز عبور: `admin`

## تکنولوژی‌ها

- Next.js 16 (App Router, Turbopack, standalone output)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Bun API service (port 3002) با SQLite
- Electron 33 + electron-builder (NSIS)
- Capacitor برای APK
- Liquid Glass UI + Dark mode + RTL Vazirmatn
