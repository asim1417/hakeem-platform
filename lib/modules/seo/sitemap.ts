/**
 * HKM-061: خريطة الموقع — فهرس (sitemap index) بملفات فرعية. دوال صرفة بلا قاعدة (للاختبار).
 *
 *   /sitemap.xml                 فهرس يسرد الملفات الفرعية (المُرسَل في robots.txt وSearch Console)
 *   /sitemap-static.xml          الصفحات العامة الثابتة
 *   /sitemap-systems.xml         صفحات الأنظمة القابلة للفهرسة (/legal/[slug])
 *   /sitemap-articles-N.xml      صفحات المواد (/legal/[slug]/[article])، ARTICLES_PER_SITEMAP لكل ملف
 *
 * الملفات الفرعية في جذر الموقع (قاعدة الموقع في sitemaps.org: الملف يسرد ما تحت مجلده فقط، وBing يطبّقها)،
 * وتُعاد كتابتها في next.config.mjs إلى المسار الداخلي app/sitemaps/[file] (static.xml، systems.xml، articles-N.xml).
 * الروابط تُبنى بالصيغة نفسها التي تكتبها الصفحات في canonical (resolveSystemSlug + articleKey).
 */
import { resolveSystemSlug } from "@/lib/modules/legal-core/eli";
import { articleKey } from "@/lib/modules/legal-core/article-key";

/** حد بروتوكول sitemaps.org لكل ملف (وحجم ≤ 50MB غير مضغوط). */
export const SITEMAP_PROTOCOL_MAX_URLS = 50_000;

/**
 * مواد لكل ملف فرعي. أصغر عمدًا من حد البروتوكول: جسم استجابة دالة Vercel ≤ 4.5MB، ورابط المادة
 * بالـ slug العربي المرمّز نحو 300 بايت. القياس على الإنتاج (29/10/2026): 5,000 رابط ≈ 1.3–1.8MB لكل ملف،
 * والمواد كلها (29,704) في ملف واحد ≈ 9MB — تتجاوز الحد.
 */
export const ARTICLES_PER_SITEMAP = 5_000;

/**
 * حد أعلى لرقم ملف المواد المقبول في الاسم: 100 ملف × 5,000 = 500,000 مادة (الإنتاج 29/10: 6 ملفات).
 * الحد الفعلي أضيق: رقم خارج خطة المواد الحالية يُرد 404 قبل استعلام الملف (sitemap-routes.ts).
 */
export const MAX_ARTICLE_SITEMAPS = 100;

/** أقصى حجم لملف فرعي (بايت). أقل من حد استجابة دالة Vercel (4.5MB) بهامش؛ تجاوزه خطأ لا ملف مبتور. */
export const SITEMAP_MAX_BYTES = 4_000_000;

export const SITEMAP_INDEX_PATH = "/sitemap.xml";
/** المسار الداخلي (هدف إعادة الكتابة) للملفات الفرعية. */
export const SITEMAP_CHILD_DIR = "/sitemaps";

/** الصفحات العامة الثابتة (كما كانت في app/sitemap.ts قبل HKM-061). */
export const STATIC_SITEMAP_PATHS: readonly string[] = ["/", "/legal", "/developers", "/api-docs", "/terms", "/privacy"];

export type SitemapFile = { kind: "static" } | { kind: "systems" } | { kind: "articles"; chunk: number };

export function sitemapFileName(file: SitemapFile): string {
  if (file.kind === "static") return "static.xml";
  if (file.kind === "systems") return "systems.xml";
  return `articles-${file.chunk}.xml`;
}

/** يحلّل اسم الملف الفرعي من المسار؛ null = غير معروف (404). لا أصفار بادئة حتى لا يتكرر الملف بمسارين. */
export function parseSitemapFileName(name: string): SitemapFile | null {
  if (name === "static.xml") return { kind: "static" };
  if (name === "systems.xml") return { kind: "systems" };
  const m = /^articles-(0|[1-9]\d{0,2})\.xml$/.exec(name);
  if (!m) return null;
  const chunk = Number(m[1]);
  return chunk < MAX_ARTICLE_SITEMAPS ? { kind: "articles", chunk } : null;
}

/** المسار العام في جذر الموقع (ما يُدرج في الفهرس): /sitemap-static.xml، /sitemap-systems.xml، /sitemap-articles-N.xml. */
export function sitemapPublicPath(file: SitemapFile): string {
  return `/sitemap-${sitemapFileName(file)}`;
}

export function sitemapFileUrl(base: string, file: SitemapFile): string {
  return `${base}${sitemapPublicPath(file)}`;
}

/**
 * إعادة كتابة المسارات العامة إلى المسار الداخلي — تُستعمل في next.config.mjs (afterFiles).
 * رقم ملف المواد بخانتين على الأكثر (يطابق MAX_ARTICLE_SITEMAPS = 100).
 */
export const SITEMAP_REWRITES: ReadonlyArray<{ source: string; destination: string }> = [
  { source: "/sitemap-:kind(static|systems).xml", destination: `${SITEMAP_CHILD_DIR}/:kind.xml` },
  { source: "/sitemap-articles-:n(\\d{1,2}).xml", destination: `${SITEMAP_CHILD_DIR}/articles-:n.xml` },
];

/** مسار صفحة النظام كما في canonical صفحة /legal/[slug]. */
export function systemPagePath(eliSlug: string | null | undefined, name: string): string {
  return `/legal/${encodeURIComponent(resolveSystemSlug(eliSlug, name))}`;
}

/** مسار صفحة المادة كما في canonical صفحة /legal/[slug]/[article]. */
export function articlePagePath(eliSlug: string | null | undefined, name: string, articleNumber: number, articleBis = 0): string {
  return `${systemPagePath(eliSlug, name)}/${articleKey(articleNumber, articleBis)}`;
}

function asValidDate(d: Date | string | null | undefined): Date | null {
  if (d === null || d === undefined) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** أحدث تاريخ صالح، أو null. */
export function latestDate(...dates: Array<Date | string | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const v = asValidDate(d);
    if (v && (!best || v.getTime() > best.getTime())) best = v;
  }
  return best;
}

/** صيغة W3C Datetime بالثواني وبتوقيت UTC (2026-10-29T14:19:55Z). */
export function w3cDatetime(d: Date | string | null | undefined): string | null {
  const v = asValidDate(d);
  return v ? v.toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export interface SitemapEntry {
  loc: string;
  lastModified?: Date | string | null;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

function entryXml(tag: "url" | "sitemap", e: SitemapEntry): string {
  const lastmod = w3cDatetime(e.lastModified);
  return `<${tag}><loc>${xmlEscape(e.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</${tag}>`;
}

function assertByteBudget(xml: string, what: string): string {
  const bytes = new TextEncoder().encode(xml).length;
  if (bytes > SITEMAP_MAX_BYTES) {
    throw new Error(`${what}: ${bytes} بايت تتجاوز الحد ${SITEMAP_MAX_BYTES} — صغّر ARTICLES_PER_SITEMAP`);
  }
  return xml;
}

/** urlset؛ يرفض تجاوز حد البروتوكول أو حد الحجم بدل إخراج ملف يرفضه المحرك أو تقطعه Vercel. */
export function renderUrlset(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_PROTOCOL_MAX_URLS) {
    throw new Error(`sitemap: ${entries.length} رابطًا تتجاوز حد البروتوكول ${SITEMAP_PROTOCOL_MAX_URLS}`);
  }
  return assertByteBudget(
    `${XML_HEAD}<urlset ${NS}>\n${entries.map((e) => entryXml("url", e)).join("\n")}${entries.length ? "\n" : ""}</urlset>\n`,
    "sitemap"
  );
}

export function renderSitemapIndex(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_PROTOCOL_MAX_URLS) {
    throw new Error(`sitemap index: ${entries.length} ملفًا تتجاوز حد البروتوكول ${SITEMAP_PROTOCOL_MAX_URLS}`);
  }
  return assertByteBudget(
    `${XML_HEAD}<sitemapindex ${NS}>\n${entries.map((e) => entryXml("sitemap", e)).join("\n")}${entries.length ? "\n" : ""}</sitemapindex>\n`,
    "sitemap index"
  );
}

export interface ArticleChunkPlan {
  chunk: number;
  urls: number;
  lastModified: Date | null;
}

export interface SitemapPlan {
  articleChunks: ArticleChunkPlan[];
  systemsLastModified: Date | null;
}

/** ملفات المواد غير الفارغة في الخطة، بالترتيب (داخل حد الاسم). */
export function plannedArticleChunks(plan: Pick<SitemapPlan, "articleChunks">): number[] {
  return plan.articleChunks
    .filter((c) => c.urls > 0 && c.chunk >= 0 && c.chunk < MAX_ARTICLE_SITEMAPS)
    .map((c) => c.chunk)
    .sort((a, b) => a - b);
}

/** معاملات generateStaticParams: الثابت دائمًا، والأنظمة وملفات المواد إن عُرفت الخطة (null = القاعدة غير متاحة). */
export function sitemapStaticParams(plan: Pick<SitemapPlan, "articleChunks"> | null): Array<{ file: string }> {
  const files: SitemapFile[] = [{ kind: "static" }];
  if (plan) {
    files.push({ kind: "systems" }, ...plannedArticleChunks(plan).map((chunk) => ({ kind: "articles" as const, chunk })));
  }
  return files.map((f) => ({ file: sitemapFileName(f) }));
}

/** مدخلات الفهرس: الثابتة، ثم الأنظمة، ثم ملفات المواد بالترتيب. */
export function sitemapIndexEntries(
  base: string,
  plan: { articleChunks: readonly ArticleChunkPlan[]; systemsLastModified: Date | null },
): SitemapEntry[] {
  const chunks = [...plan.articleChunks]
    .filter((c) => c.urls > 0 && c.chunk >= 0 && c.chunk < MAX_ARTICLE_SITEMAPS)
    .sort((a, b) => a.chunk - b.chunk);
  const articlesLatest = latestDate(...chunks.map((c) => c.lastModified));
  return [
    { loc: sitemapFileUrl(base, { kind: "static" }) },
    // صفحة النظام تعرض نصوص موادها، فتتغير بتغيرها.
    { loc: sitemapFileUrl(base, { kind: "systems" }), lastModified: latestDate(plan.systemsLastModified, articlesLatest) },
    ...chunks.map((c) => ({ loc: sitemapFileUrl(base, { kind: "articles", chunk: c.chunk }), lastModified: c.lastModified })),
  ];
}
