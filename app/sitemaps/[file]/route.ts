// HKM-061: ملفات خريطة الموقع الفرعية: static.xml، systems.xml، articles-N.xml (5,000 مادة لكل ملف).
// لا شيء يُرسم وقت البناء (generateStaticParams فارغة)؛ كل ملف يُرسم عند أول طلب ثم يُخزَّن ساعة (ISR)،
// باستعلام واحد. خطأ القاعدة يُرمى (500) فيبقى آخر نسخة ناجحة في الذاكرة المؤقتة.
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { XML_HEADERS, buildChildSitemapXml } from "@/lib/modules/seo/sitemap-routes";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): Array<{ file: string }> {
  return [];
}

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const result = await buildChildSitemapXml(prismaSqlClient(prisma), getSiteUrl(), decodeURIComponent(params.file));
  if (result.status === 404) {
    return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(result.xml, { headers: XML_HEADERS });
}
