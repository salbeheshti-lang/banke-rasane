import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeNoFlashScript } from "@/hooks/use-theme";

export const metadata: Metadata = {
  title: "بانک رسانه",
  description: "آرشیو تخصصی برنامه‌های تلویزیونی",
  manifest: "/manifest.json",
  applicationName: "بانک رسانه",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "بانک رسانه",
  },
  icons: {
    icon: "/banke-rasane-logo.png",
    apple: "/banke-rasane-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d7c4a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
