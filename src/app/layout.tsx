import type { Metadata } from "next";
import "./globals.css";
import { themeNoFlashScript } from "@/hooks/use-theme";
import { langNoFlashScript } from "@/lib/i18n-context";

export const metadata: Metadata = {
  title: "بانک رسانه",
  description: "آرشیو تخصصی برنامه‌های تلویزیونی",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "بانک رسانه" },
  icons: { icon: [{ url: "/icons/icon-256.png", sizes: "256x256", type: "image/png" }], apple: [{ url: "/icons/icon-256.png", sizes: "256x256", type: "image/png" }] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Vazirmatn-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Vazirmatn-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
        <script dangerouslySetInnerHTML={{ __html: langNoFlashScript }} />
      </head>
      <body className="antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})); }` }} />
      </body>
    </html>
  );
}
