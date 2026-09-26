import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeHero } from "@/components/home/HomeHero";
import { hasValidSessionCookie, OWNER_SESSION_COOKIE } from "@/lib/modules/auth/session";
import {
  isHomeSignedInRedirectEnabled,
  LOGGED_OUT_MARK_COOKIE,
  shouldRedirectSignedInHome,
} from "@/lib/modules/config/home-signed-in-redirect";
import { homeDemoVideoUrl, isHomeLiveDemoEnabled } from "@/lib/modules/config/home-live-demo";
import { buildLiveDemoPayload } from "@/lib/modules/home/live-demo-content";
import { loadLiveDemoArticle } from "@/lib/modules/home/live-demo-source";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getSiteConfig } from "@/lib/modules/site/site-store";
import { hydrateEnvFromSettingsThrottled } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { view?: string | string[] };
}) {
  // أعلام الدخول ومفاتيح الطوارئ (HOME_INLINE_AUTH_ENABLED، HOME_SIGNED_IN_REDIRECT_ENABLED) من الإعدادات المُدارة
  await hydrateEnvFromSettingsThrottled();

  // صاحب الجلسة يُحال إلى مساحة عمله قبل رسم الصفحة (307) — فحص الكوكي فقط، بلا Clerk ولا قاعدة بيانات.
  const jar = cookies();
  if (
    shouldRedirectSignedInHome({
      enabled: isHomeSignedInRedirectEnabled(),
      hasSession: hasValidSessionCookie(jar.get(OWNER_SESSION_COOKIE)?.value),
      view: searchParams?.view,
      justLoggedOut: jar.get(LOGGED_OUT_MARK_COOKIE)?.value === "1",
    })
  ) {
    redirect("/dashboard");
  }

  await assertBuiltinPageEnabled("home");
  const config = await getSiteConfig();
  // العرض الحي: نص المادة من مدونة حكيم؛ إن غاب النص لا يظهر العرض
  const demoArticle = isHomeLiveDemoEnabled() ? await loadLiveDemoArticle() : null;
  return (
    <HomeHero
      content={config.home}
      liveDemo={demoArticle ? buildLiveDemoPayload(demoArticle) : null}
      demoVideoUrl={demoArticle ? homeDemoVideoUrl() : null}
    />
  );
}
