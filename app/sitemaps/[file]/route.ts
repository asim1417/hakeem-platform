// HKM-061: ملفات خريطة الموقع الفرعية (الداخلية): static.xml، systems.xml، articles-N.xml (5,000 مادة لكل ملف).
// تُخدم للعموم من الجذر (/sitemap-static.xml …) بإعادة كتابة في next.config.mjs.
// كل ملف معروف يُرسم وقت البناء (generateStaticParams من خطة المواد) ويُعاد كل ساعة (ISR)، باستعلام واحد؛
// وملف مواد جديد بعد النشر يُرسم عند أول طلب. رقم خارج الخطة 404 بلا استعلام ملف. خطأ القاعدة 500 لا يُخزَّن.
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { cachedSitemapPlan } from "@/lib/modules/seo/sitemap-cache";
import { XML_HEADERS, buildChildSitemapXml, buildSitemapStaticParams } from "@/lib/modules/seo/sitemap-routes";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ file: string }>> {
  return buildSitemapStaticParams(cachedSitemapPlan);
}

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const result = await buildChildSitemapXml(prismaSqlClient(prisma), getSiteUrl(), decodeURIComponent(params.file), {
    loadPlan: cachedSitemapPlan,
  });
  if (result.status === 404) {
    return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(result.xml, { headers: XML_HEADERS });
}
