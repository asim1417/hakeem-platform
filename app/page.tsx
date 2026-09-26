import { HomeHero } from "@/components/home/HomeHero";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getSiteConfig } from "@/lib/modules/site/site-store";
import { hydrateEnvFromSettingsThrottled } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await assertBuiltinPageEnabled("home");
  // أعلام الدخول ومفتاح طوارئ HOME_INLINE_AUTH_ENABLED من الإعدادات المُدارة
  await hydrateEnvFromSettingsThrottled();
  const config = await getSiteConfig();
  return <HomeHero content={config.home} />;
}
