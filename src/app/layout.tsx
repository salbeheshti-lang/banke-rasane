import type { Metadata } from "next";
import "./globals.css";
import { themeNoFlashScript } from "@/hooks/use-theme";

export const metadata: Metadata = {
  title: "بانک رسانه",
  description: "آرشیو تخصصی برنامه‌های تلویزیونی",
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
        {/* Apply saved theme before first paint to avoid a flash of the wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
