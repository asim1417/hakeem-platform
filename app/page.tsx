import type { Metadata } from "next";
import { HomeHero } from "@/components/home/HomeHero";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getSiteConfig } from "@/lib/modules/site/site-store";

export const metadata: Metadata = {
  title: "حكيم — منصة المعرفة القضائية السعودية",
  description:
    "مساحة عمل قانونية سعودية تساعد على فهم الوقائع، البحث في الأنظمة والمصادر، تحليل المستندات، وتنظيم القضايا والمخرجات القانونية.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await assertBuiltinPageEnabled("home");
  const config = await getSiteConfig();
  return <HomeHero content={config.home} />;
}
