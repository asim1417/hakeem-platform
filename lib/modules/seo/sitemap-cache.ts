/**
 * HKM-061: خطة خريطة الموقع مخزّنة ساعة (Next Data Cache)، يتشاركها الفهرس وفحص رقم ملف المواد،
 * فلا يكلّف رقمٌ عشوائي (/sitemap-articles-77.xml) استعلامًا، ويتطابق الفهرس والملفات في المدة نفسها.
 * يُستعمل من مسارات app/ فقط (يعتمد على next/cache)؛ الاختبارات تمرّر محمّلًا مزيّفًا.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { loadSitemapPlan } from "@/lib/modules/seo/sitemap-data";
import type { SitemapPlan } from "@/lib/modules/seo/sitemap";

type SerializedPlan = {
  articleChunks: Array<{ chunk: number; urls: number; lastModified: string | null }>;
  systemsLastModified: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const date = (s: string | null) => (s ? new Date(s) : null);

async function loadSerializedPlan(): Promise<SerializedPlan> {
  const plan = await loadSitemapPlan(prismaSqlClient(prisma));
  return {
    articleChunks: plan.articleChunks.map((c) => ({ chunk: c.chunk, urls: c.urls, lastModified: iso(c.lastModified) })),
    systemsLastModified: iso(plan.systemsLastModified),
  };
}

// الأخطاء لا تُخزَّن (unstable_cache يخزّن النتيجة الناجحة فقط).
const cachedSerializedPlan = unstable_cache(loadSerializedPlan, ["hkm061-sitemap-plan-v1"], {
  revalidate: 3600,
  tags: ["sitemap-plan"],
});

/** الخطة من الذاكرة المؤقتة؛ وإن لم تتوفر ذاكرة Next (سياق بلا incrementalCache) فاستعلام مباشر. */
export async function cachedSitemapPlan(): Promise<SitemapPlan> {
  let s: SerializedPlan;
  try {
    s = await cachedSerializedPlan();
  } catch (error) {
    if (!/incrementalCache missing/.test(String((error as Error)?.message ?? error))) throw error;
    s = await loadSerializedPlan();
  }
  return {
    articleChunks: s.articleChunks.map((c) => ({ chunk: c.chunk, urls: c.urls, lastModified: date(c.lastModified) })),
    systemsLastModified: date(s.systemsLastModified),
  };
}
