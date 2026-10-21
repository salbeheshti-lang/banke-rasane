import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'بانک رسانه | Bank Rasane',
  description: 'نرم‌افزار مدیریت برنامه‌های تلویزیونی - نسخه 1.1.0',
  applicationName: 'BankResaneh',
  authors: [{ name: 'salbeheshti-lang' }],
  keywords: ['بانک رسانه', 'برنامه تلویزیونی', 'مدیا', 'Bank Rasane'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
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
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
