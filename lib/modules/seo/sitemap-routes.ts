/**
 * HKM-061: بناء أجسام خريطة الموقع لمساري app/sitemap.xml وapp/sitemaps/[file] — قابلة للاختبار بعميل SQL مزيّف.
 *
 * سياسة الخطأ:
 * - وقت التشغيل: خطأ القاعدة يُرمى (500)، فيُبقي ISR آخر نسخة ناجحة بدل تخزين خريطة فارغة ساعة.
 * - وقت البناء (NEXT_PHASE=phase-production-build): إن تعذّرت القاعدة يُخرج الفهرس الملفين الثابت والأنظمة فقط،
 *   ولا يُرسم مسبقًا من الملفات الفرعية إلا الثابت (لا يُكسر البناء في CI أو بلا قاعدة)؛ والباقي عند أول طلب.
 *
 * التخزين (مراجعة QA على 124bde4): الملفات المعروفة تُرسم وقت البناء (generateStaticParams من الخطة) فتُخدم HIT؛
 * ورقم ملف مواد خارج الخطة يُرد 404 قبل استعلام الملف، والخطة نفسها مخزّنة (sitemap-cache.ts) فلا يكلّف الرد قاعدةً.
 */
import type { SqlClient } from "@/lib/modules/legal-core/sql-port";
import { isSystemIndexable } from "@/lib/modules/seo/indexability";
import { loadArticleChunk, loadSitemapPlan, loadSitemapSystems } from "@/lib/modules/seo/sitemap-data";
import {
  STATIC_SITEMAP_PATHS,
  articlePagePath,
  parseSitemapFileName,
  plannedArticleChunks,
  renderSitemapIndex,
  renderUrlset,
  sitemapIndexEntries,
  sitemapStaticParams,
  systemPagePath,
  type SitemapEntry,
  type SitemapPlan,
} from "@/lib/modules/seo/sitemap";

export const PHASE_PRODUCTION_BUILD = "phase-production-build";

export const XML_HEADERS = { "content-type": "application/xml; charset=utf-8" } as const;

export type PlanLoader = () => Promise<SitemapPlan>;

export interface SitemapRouteOptions {
  /** NEXT_PHASE */
  phase?: string;
  /** خطة المواد (الإنتاج: النسخة المخزّنة؛ الافتراضي: استعلام مباشر). */
  loadPlan?: PlanLoader;
}

const directPlan = (db: SqlClient): PlanLoader => () => loadSitemapPlan(db);

function errorMessage(error: unknown): string {
  return (error as Error)?.message ?? String(error);
}

export async function buildSitemapIndexXml(db: SqlClient, base: string, opts: SitemapRouteOptions = {}): Promise<string> {
  let plan: SitemapPlan;
  try {
    plan = await (opts.loadPlan ?? directPlan(db))();
  } catch (error) {
    if (opts.phase !== PHASE_PRODUCTION_BUILD) throw error;
    console.warn(`[sitemap] تعذّرت القاعدة وقت البناء؛ فهرس مؤقت بلا ملفات المواد: ${errorMessage(error)}`);
    plan = { articleChunks: [], systemsLastModified: null };
  }
  return renderSitemapIndex(sitemapIndexEntries(base, plan));
}

/** generateStaticParams للملفات الفرعية: كل ملف معروف يُرسم وقت البناء. تعذّر القاعدة = الثابت وحده. */
export async function buildSitemapStaticParams(loadPlan: PlanLoader): Promise<Array<{ file: string }>> {
  try {
    return sitemapStaticParams(await loadPlan());
  } catch (error) {
    console.warn(`[sitemap] تعذّرت القاعدة وقت البناء؛ لا يُرسم مسبقًا إلا static.xml: ${errorMessage(error)}`);
    return sitemapStaticParams(null);
  }
}

export type ChildSitemapResult = { status: 200; xml: string } | { status: 404 };

/** ملف فرعي باسمه الداخلي (static.xml، systems.xml، articles-N.xml). */
export async function buildChildSitemapXml(
  db: SqlClient,
  base: string,
  fileName: string,
  opts: Pick<SitemapRouteOptions, "loadPlan"> = {},
): Promise<ChildSitemapResult> {
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

  // رقم خارج الخطة: 404 قبل استعلام الملف (الخطة مخزّنة في الإنتاج).
  const plan = await (opts.loadPlan ?? directPlan(db))();
  if (!plannedArticleChunks(plan).includes(file.chunk)) return { status: 404 };

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
