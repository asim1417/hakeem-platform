import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug } from "@/lib/modules/legal-core/eli";

export const revalidate = 3600;

const BASE = "https://hakeem-platform.vercel.app";

// خريطة الموقع للسطح العام (يساعد محرّكات البحث وأنظمة الذكاء على الاكتشاف).
// الصفحات الثابتة + فهرس الأنظمة + صفحة كل نظام (المواد تُكتشَف بتتبّع روابط صفحات الأنظمة).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/legal", priority: 0.95 },
    { path: "/developers", priority: 0.9 },
    { path: "/api-docs", priority: 0.8 },
    { path: "/terms", priority: 0.4 },
    { path: "/privacy", priority: 0.4 },
  ];

  const systems = await prisma.legalSystem
    .findMany({ where: { articleCount: { gt: 0 } }, select: { name: true, eliSlug: true } })
    .catch(() => [] as Array<{ name: string; eliSlug: string | null }>);

  const systemEntries: MetadataRoute.Sitemap = systems.map((s) => ({
    url: `${BASE}/legal/${encodeURIComponent(resolveSystemSlug(s.eliSlug, s.name))}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    ...staticPages.map((p) => ({ url: `${BASE}${p.path}`, lastModified: now, changeFrequency: "weekly" as const, priority: p.priority })),
    ...systemEntries,
  ];
}
