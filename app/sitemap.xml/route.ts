// HKM-061: فهرس خريطة الموقع (sitemap index) على /sitemap.xml — المسار نفسه الذي يرسله robots.txt
// ويُسجَّل في Search Console. يسرد /sitemap-static.xml و/sitemap-systems.xml و/sitemap-articles-N.xml.
// يُرسم وقت البناء ويُعاد كل ساعة (ISR)؛ الخطة من الذاكرة المؤقتة المشتركة. السياسة في lib/modules/seo/sitemap-routes.ts.
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { cachedSitemapPlan } from "@/lib/modules/seo/sitemap-cache";
import { XML_HEADERS, buildSitemapIndexXml } from "@/lib/modules/seo/sitemap-routes";

export const revalidate = 3600;

export async function GET() {
  const xml = await buildSitemapIndexXml(prismaSqlClient(prisma), getSiteUrl(), {
    phase: process.env.NEXT_PHASE,
    loadPlan: cachedSitemapPlan,
  });
  return new Response(xml, { headers: XML_HEADERS });
}
