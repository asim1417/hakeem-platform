import type { MetadataRoute } from "next";

const BASE = "https://hakeem-platform.vercel.app";

// السماح الصريح لروبوتات محرّكات البحث وأنظمة الذكاء الاصطناعي بالزحف على السطح
// العام، مع حجب المسارات الخاصة فقط (لوحات المستخدم/الإدارة والتدقيق وواجهات الإدارة).
const DISALLOW = ["/dashboard/", "/admin/", "/audit-logs", "/api/admin/", "/login", "/settings"];

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
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
