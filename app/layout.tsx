import type { Metadata, Viewport } from "next";
import "./identity.css";
import "./globals.css";
import { DIR } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { BootWatchdog } from "@/components/providers/BootWatchdog";

export const metadata: Metadata = {
  title: "حكيم",
  description: "المنصة القانونية الموحدة",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E3435",
};

/**
 * Layout جذري بلا Clerk — الصفحة الرئيسية العامة تبقى مستقرة على iPhone.
 * المصادقة تُركَّب فقط عبر ClerkRoot في layouts المسارات المحمية/الدخول.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale} dir={DIR[locale]} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <BootWatchdog />
      </body>
    </html>
  );
}
