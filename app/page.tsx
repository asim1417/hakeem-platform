import { HomeHero } from "@/components/home/HomeHero";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getSiteConfig } from "@/lib/modules/site/site-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await assertBuiltinPageEnabled("home");
  const config = await getSiteConfig();
  return <HomeHero content={config.home} />;
}
