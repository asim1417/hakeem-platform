import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/modules/config/site-url";

// السماح الصريح لروبوتات محرّكات البحث وأنظمة الذكاء الاصطناعي بالزحف على السطح
// العام، مع حجب المسارات الخاصة فقط (لوحات المستخدم/الإدارة والتدقيق وواجهات الإدارة).
const DISALLOW = [
  "/dashboard/",
  "/admin/",
  "/audit-logs",
  "/api/admin/",
  "/login",
  "/sign-in",
  "/sign-up",
  "/register",
  "/settings",
  "/onboarding",
  "/internal/",
  "/auth/",
  "/sso-callback",
  "/cases",
  "/consultations",
  "/judge",
  "/simulation",
  "/training",
  "/library",
  "/documents/app",
];

// روبوتات الذكاء الاصطناعي ومحرّكات البحث المعروفة — ترحيب صريح.
const AI_AND_SEARCH_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "YandexBot",
];

export default function robots(): MetadataRoute.Robots {
  const BASE = getSiteUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
