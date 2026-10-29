/**
 * HKM-061: خريطة الموقع — فهرس (sitemap index) بملفات فرعية. دوال صرفة بلا قاعدة (للاختبار).
 *
 *   /sitemap.xml                 فهرس يسرد الملفات الفرعية (المُرسَل في robots.txt وSearch Console)
 *   /sitemaps/static.xml         الصفحات العامة الثابتة
 *   /sitemaps/systems.xml        صفحات الأنظمة القابلة للفهرسة (/legal/[slug])
 *   /sitemaps/articles-N.xml     صفحات المواد (/legal/[slug]/[article])، ARTICLES_PER_SITEMAP لكل ملف
 *
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

/** حد أعلى لرقم الملف المقبول في المسار (يمنع ملء ذاكرة ISR بأرقام عشوائية): 10,000 × 5,000 رابط. */
export const MAX_ARTICLE_SITEMAPS = 10_000;

export const SITEMAP_INDEX_PATH = "/sitemap.xml";
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
  const m = /^articles-(0|[1-9]\d{0,4})\.xml$/.exec(name);
  if (!m) return null;
  const chunk = Number(m[1]);
  return chunk < MAX_ARTICLE_SITEMAPS ? { kind: "articles", chunk } : null;
}

export function sitemapFileUrl(base: string, file: SitemapFile): string {
  return `${base}${SITEMAP_CHILD_DIR}/${sitemapFileName(file)}`;
}

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

/** urlset؛ يرفض تجاوز حد البروتوكول بدل إخراج ملف يرفضه المحرك. */
export function renderUrlset(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_PROTOCOL_MAX_URLS) {
    throw new Error(`sitemap: ${entries.length} رابطًا تتجاوز حد البروتوكول ${SITEMAP_PROTOCOL_MAX_URLS}`);
  }
  return `${XML_HEAD}<urlset ${NS}>\n${entries.map((e) => entryXml("url", e)).join("\n")}${entries.length ? "\n" : ""}</urlset>\n`;
}

export function renderSitemapIndex(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_PROTOCOL_MAX_URLS) {
    throw new Error(`sitemap index: ${entries.length} ملفًا تتجاوز حد البروتوكول ${SITEMAP_PROTOCOL_MAX_URLS}`);
  }
  return `${XML_HEAD}<sitemapindex ${NS}>\n${entries.map((e) => entryXml("sitemap", e)).join("\n")}${entries.length ? "\n" : ""}</sitemapindex>\n`;
}

export interface ArticleChunkPlan {
  chunk: number;
  urls: number;
  lastModified: Date | null;
}

/** مدخلات الفهرس: الثابتة، ثم الأنظمة، ثم ملفات المواد بالترتيب. */
export function sitemapIndexEntries(
  base: string,
  plan: { articleChunks: readonly ArticleChunkPlan[]; systemsLastModified: Date | null },
): SitemapEntry[] {
  const chunks = [...plan.articleChunks].filter((c) => c.urls > 0).sort((a, b) => a.chunk - b.chunk);
  const articlesLatest = latestDate(...chunks.map((c) => c.lastModified));
  return [
    { loc: sitemapFileUrl(base, { kind: "static" }) },
    // صفحة النظام تعرض نصوص موادها، فتتغير بتغيرها.
    { loc: sitemapFileUrl(base, { kind: "systems" }), lastModified: latestDate(plan.systemsLastModified, articlesLatest) },
    ...chunks.map((c) => ({ loc: sitemapFileUrl(base, { kind: "articles", chunk: c.chunk }), lastModified: c.lastModified })),
  ];
}
