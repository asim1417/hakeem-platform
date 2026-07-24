import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./identity.css";
import "./globals.css";
import "./browser-compat.css";
import { DIR } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { BootWatchdog } from "@/components/providers/BootWatchdog";

const fontDisplay = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
  preload: true,
  fallback: ["Tahoma", "sans-serif"],
});

const fontJudicial = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-judicial-loaded",
  display: "swap",
  preload: true,
  fallback: ["Times New Roman", "serif"],
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-loaded",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "حكيم",
  description: "المنصة القانونية الموحدة",
  applicationName: "حكيم",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "حكيم",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E3435" },
    { media: "(prefers-color-scheme: dark)", color: "#0E3435" },
  ],
  colorScheme: "light",
};

/**
 * Layout جذري — خطوط next/font (أداء + توافق) + طبقة browser-compat.
 * بلا Clerk هنا حتى تبقى الصفحة العامة مستقرة على iPhone/Safari.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html
      lang={locale}
      dir={DIR[locale]}
      className={`${fontDisplay.variable} ${fontJudicial.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
        <BootWatchdog />
      </body>
    </html>
  );
}
