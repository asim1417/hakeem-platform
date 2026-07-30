import type { Metadata } from "next";
import { HomeHero } from "@/components/home/HomeHero";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getPublicPlatformStats } from "@/lib/modules/site/public-platform-stats";
import { getSiteConfig } from "@/lib/modules/site/site-store";

export const metadata: Metadata = {
  title: "حكيم — منصة المعرفة القضائية السعودية",
  description:
    "ابحث في الأنظمة السعودية، حلّل المستندات، ونظّم ملف القضية في مساحة قانونية واحدة مبنية للممارس السعودي.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await assertBuiltinPageEnabled("home");
  const [config, stats] = await Promise.all([
    getSiteConfig(),
    getPublicPlatformStats(),
  ]);

  return <HomeHero content={config.home} stats={stats} />;
}
