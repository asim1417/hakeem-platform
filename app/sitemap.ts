import type { MetadataRoute } from "next";

const BASE = "https://hakeem-platform.vercel.app";

// خريطة الموقع للسطح العام فقط (يساعد محرّكات البحث وأنظمة الذكاء على الاكتشاف).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/developers", priority: 0.9 },
    { path: "/api-docs", priority: 0.8 },
    { path: "/terms", priority: 0.4 },
    { path: "/privacy", priority: 0.4 },
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}
