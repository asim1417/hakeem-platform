/**
 * HKM-061: بناء أجسام خريطة الموقع لمساري app/sitemap.xml وapp/sitemaps/[file] — قابلة للاختبار بعميل SQL مزيّف.
 *
 * سياسة الخطأ:
 * - وقت التشغيل: خطأ القاعدة يُرمى (500)، فيُبقي ISR آخر نسخة ناجحة بدل تخزين خريطة فارغة ساعة.
 * - وقت البناء (NEXT_PHASE=phase-production-build): الفهرس وحده يُرسم مسبقًا؛ إن تعذّرت القاعدة يُخرج
 *   فهرسًا بالملفين الثابت والأنظمة فقط (لا يُكسر البناء في CI أو بلا قاعدة)، ويُستبدل في أول إعادة تحقق.
 */
import type { SqlClient } from "@/lib/modules/legal-core/sql-port";
import { isSystemIndexable } from "@/lib/modules/seo/indexability";
import { loadArticleChunk, loadSitemapPlan, loadSitemapSystems } from "@/lib/modules/seo/sitemap-data";
import {
  STATIC_SITEMAP_PATHS,
  articlePagePath,
  parseSitemapFileName,
  renderSitemapIndex,
  renderUrlset,
  sitemapIndexEntries,
  systemPagePath,
  type SitemapEntry,
} from "@/lib/modules/seo/sitemap";

export const PHASE_PRODUCTION_BUILD = "phase-production-build";

export const XML_HEADERS = { "content-type": "application/xml; charset=utf-8" } as const;

export async function buildSitemapIndexXml(db: SqlClient, base: string, opts: { phase?: string } = {}): Promise<string> {
  let plan: Awaited<ReturnType<typeof loadSitemapPlan>>;
  try {
    plan = await loadSitemapPlan(db);
  } catch (error) {
    if (opts.phase !== PHASE_PRODUCTION_BUILD) throw error;
    console.warn(`[sitemap] تعذّرت القاعدة وقت البناء؛ فهرس مؤقت بلا ملفات المواد: ${(error as Error)?.message ?? error}`);
    plan = { articleChunks: [], systemsLastModified: null };
  }
  return renderSitemapIndex(sitemapIndexEntries(base, plan));
}

export type ChildSitemapResult = { status: 200; xml: string } | { status: 404 };

/** ملف فرعي باسمه في المسار (static.xml، systems.xml، articles-N.xml). */
export async function buildChildSitemapXml(db: SqlClient, base: string, fileName: string): Promise<ChildSitemapResult> {
  const file = parseSitemapFileName(fileName);
  if (!file) return { status: 404 };

  if (file.kind === "static") {
    // بلا lastmod: لا نعرف تاريخ تغيّرها، و«الآن» في كل مرة يُضعف ثقة المحرك في lastmod.
    return { status: 200, xml: renderUrlset(STATIC_SITEMAP_PATHS.map((p) => ({ loc: `${base}${p}` }))) };
  }

  if (file.kind === "systems") {
    const rows = await loadSitemapSystems(db);
    const seen = new Set<string>();
    const entries: SitemapEntry[] = [];
    for (const r of rows) {
      if (!isSystemIndexable(r.signal)) continue;
      const loc = `${base}${systemPagePath(r.eliSlug, r.name)}`;
      if (seen.has(loc)) continue;
      seen.add(loc);
      entries.push({ loc, lastModified: r.lastModified });
    }
    return { status: 200, xml: renderUrlset(entries) };
  }

  const rows = await loadArticleChunk(db, file.chunk);
  if (!rows.length) return { status: 404 };
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const r of rows) {
    const loc = `${base}${articlePagePath(r.eliSlug, r.name, r.articleNumber, r.articleBis)}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    entries.push({ loc, lastModified: r.lastModified });
  }
  return { status: 200, xml: renderUrlset(entries) };
}
