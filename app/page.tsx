import type { Metadata } from "next";
import { HomeHero } from "@/components/home/HomeHero";
import { loginErrorMessage } from "@/lib/modules/auth/login-error-message";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";
import { getPublicPlatformStats } from "@/lib/modules/site/public-platform-stats";
import { getSiteConfig } from "@/lib/modules/site/site-store";

export const metadata: Metadata = {
  title: "حكيم — منصة تقنية قانونية للممارسة السعودية",
  description:
    "بحث في الأنظمة والأحكام، تحليل للوقائع والمستندات، وإدارة لملف القضية في مساحة عمل واحدة قابلة للمراجعة والاستكمال.",
};

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { login_error?: string | string[] };
}) {
  await assertBuiltinPageEnabled("home");
  const [config, stats] = await Promise.all([
    getSiteConfig(),
    getPublicPlatformStats(),
  ]);

  const rawLoginError = Array.isArray(searchParams?.login_error)
    ? searchParams?.login_error[0]
    : searchParams?.login_error;

  return (
    <HomeHero
      content={config.home}
      stats={stats}
      loginError={loginErrorMessage(rawLoginError)}
    />
  );
}
