import type { Metadata, Viewport } from "next";
import "./identity.css";
import "./globals.css";
import { DIR } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { ClerkAppProvider } from "@/components/providers/ClerkAppProvider";
import { shouldHideClerkDevelopmentModeUi } from "@/lib/modules/auth/owner-emergency";

export const metadata: Metadata = {
  title: "حكيم",
  description: "المنصة القانونية الموحدة"
};

// إعداد صريح للـviewport يضمن عرضًا متّسقًا على الجوّال (آيفون/أندرويد) والكمبيوتر.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  const hideDevelopmentMode = shouldHideClerkDevelopmentModeUi();
  return (
    <html lang={locale} dir={DIR[locale]}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClerkAppProvider
          publishableKey={publishableKey || undefined}
          hideDevelopmentMode={hideDevelopmentMode}
        >
          {children}
        </ClerkAppProvider>
      </body>
    </html>
  );
}
