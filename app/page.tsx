import { HomeHero } from "@/components/home/HomeHero";
import { homeDemoVideoUrl, isHomeLiveDemoEnabled } from "@/lib/modules/config/home-live-demo";
import { buildLiveDemoPayload } from "@/lib/modules/home/live-demo-content";
import { loadLiveDemoArticle } from "@/lib/modules/home/live-demo-source";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getSiteConfig } from "@/lib/modules/site/site-store";
import { hydrateEnvFromSettingsThrottled } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // أعلام الدخول ومفتاح طوارئ HOME_INLINE_AUTH_ENABLED والعرض الحي من الإعدادات المُدارة
  await hydrateEnvFromSettingsThrottled();

  // صاحب الجلسة لا يصل هنا: middleware.ts يحيله إلى /dashboard (307) قبل رسم الصفحة.
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
