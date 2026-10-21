import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'بانک رسانه | Bank Rasane',
  description: 'دسترسی به دنیای بی‌پایان محتوا - نرم‌افزار مدیریت برنامه‌های تلویزیونی',
  applicationName: 'BankResaneh',
  authors: [{ name: 'salbeheshti-lang' }],
  keywords: ['بانک رسانه', 'برنامه تلویزیونی', 'مدیا', 'Bank Rasane'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#051910',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="icon" href="/icons/icon-32.png" type="image/png" />
        {/* Preload fonts */}
        <link rel="preload" href="/fonts/Vazirmatn-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Vazirmatn-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Vazirmatn-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
