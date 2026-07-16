// ─────────────────────────────────────────────────────────────────────────────
// أدوات الوكلاء (المرحلة ٢) — ١٦ أداة، كلٌّ يُرجع ToolResult{ok,data,source,confidence,note}.
// أغلفة رفيعة **فوق دوالّ النواة القائمة** (بحث/جلب/زمن/عزو) + استعلامات prisma مباشرة حيث لزم.
// لا تُسرّب embedding ولا الحالات الداخلية. أي تعذّر → ok:false مع note (لا فشل صامت).
// المصدر الوحيد للحقيقة: قاعدة البيانات القانونية. لا تلمس الأمن ولا نواة الترتيب.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";
import type { ToolResult } from "../types";
import {
  searchLegalCore,
  getArticlesByNumber,
  getArticleFullContext,
  type LegalCoreResult,
} from "@/lib/modules/legal-core/legal-retrieval";
import { getArticleVersionAt } from "@/lib/modules/legal-core/article-versions";
import { validateLegalCitation } from "@/lib/modules/legal-core/legal-citation-guard";
import { buildArticleCitation } from "@/lib/modules/legal-core/intelligence";
import { articleStatusBadge } from "@/lib/modules/legal-core/article-status";
import { parseArticleEli } from "@/lib/modules/legal-core/eli";
import { hybridSearch, type MergedResult } from "@/lib/modules/legal-search/hybrid-search";
import { queryNormative } from "../substrate/queries";
import type { NormativeModality } from "../substrate/normative";

function ok<T>(data: T, source: string, confidence = 0.9, note?: string): ToolResult<T> {
  return { ok: true, data, source, confidence, note };
}
function fail<T>(data: T, source: string, note: string): ToolResult<T> {
  return { ok: false, data, source, confidence: 0, note };
}

// ── بحث (٤) ──────────────────────────────────────────────────────────────────
// systemIds اختياريّ = **قيد النطاق** (المرحلة ٣): يُمرَّر لفلتر النواة القائم فلا تتسرّب
// مادةٌ من نظامٍ إلى سؤالٍ عن نظامٍ آخر. لا يلمس نواة الترتيب — يستعمل خطّافها الموجود فقط.
export async function search_articles(query: string, limit = 8, systemIds?: string[]): Promise<ToolResult<LegalCoreResult[]>> {
  try {
    const scoped = systemIds && systemIds.length ? { systemIds } : {};
    const r = await searchLegalCore({ query, sourceTypes: ["article"], limit, includeSnippets: true, semantic: true, ...scoped });
    return ok(r.results, "legal_core.legal_articles", r.results.length ? 0.9 : 0.4, systemIds?.length ? `مقيّد بـ${systemIds.length} نظامًا` : undefined);
  } catch (e) {
    return fail<LegalCoreResult[]>([], "legal_core.legal_articles", `تعذّر بحث المواد: ${(e as Error).message}`);
  }
}

async function hybridByType(query: string, type: "ruling" | "principle", limit: number): Promise<ToolResult<MergedResult[]>> {
  try {
    const r = await hybridSearch({ q: query, limit: Math.max(limit * 3, 20) });
    const items = r.results.filter((x) => x.type === type).slice(0, limit);
    return ok(items, `hybrid.${type}`, items.length ? 0.8 : 0.4, items.length ? undefined : "لا نتائج من هذا النوع");
  } catch (e) {
    return fail<MergedResult[]>([], `hybrid.${type}`, `تعذّر البحث: ${(e as Error).message}`);
  }
}
export const search_rulings = (query: string, limit = 6) => hybridByType(query, "ruling", limit);
export const search_principles = (query: string, limit = 6) => hybridByType(query, "principle", limit);

export async function semantic_search(query: string, limit = 8): Promise<ToolResult<LegalCoreResult[]>> {
  try {
    const r = await searchLegalCore({ query, sourceTypes: ["article"], limit, includeSnippets: true, semantic: true });
    return ok(r.results, "pgvector.embeddings(threshold≥0.6)", r.results.length ? 0.85 : 0.4);
  } catch (e) {
    return fail<LegalCoreResult[]>([], "pgvector.embeddings", `تعذّر البحث الدلالي: ${(e as Error).message}`);
  }
}

// ── جلب (٣) ──────────────────────────────────────────────────────────────────
export async function get_article_by_eli(eliSegments: string[]): Promise<ToolResult<unknown>> {
  const parsed = parseArticleEli(eliSegments);
  if (!parsed) return fail(null, "eli", "مُعرّف ELI غير صالح");
  try {
    const rows = await getArticlesByNumber(parsed.articleNumber, parsed.slug);
    const hit = rows[0] ?? null;
    return hit ? ok(hit, "legal_core.legal_articles", 0.9) : fail(null, "eli", "لم تُوجد المادة لهذا المُعرّف");
  } catch (e) {
    return fail(null, "eli", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

export async function get_system_toc(systemName: string): Promise<ToolResult<Array<{ articleNumber: number; title: string }>>> {
  try {
    const rows = await prisma.legalArticle.findMany({
      where: { lawName: { contains: systemName, mode: "insensitive" } },
      select: { articleNumber: true, title: true },
      orderBy: { articleNumber: "asc" },
      take: 500,
    });
    return ok(rows, "legal_core.legal_articles", rows.length ? 0.9 : 0.3, rows.length ? undefined : "لا مواد لهذا النظام");
  } catch (e) {
    return fail<Array<{ articleNumber: number; title: string }>>([], "legal_core", `تعذّر جلب الفهرس: ${(e as Error).message}`);
  }
}

export async function get_articles_range(systemName: string, from: number, to: number): Promise<ToolResult<unknown[]>> {
  try {
    const rows = await prisma.legalArticle.findMany({
      where: { lawName: { contains: systemName, mode: "insensitive" }, articleNumber: { gte: Math.min(from, to), lte: Math.max(from, to) } },
      select: { id: true, articleNumber: true, title: true, content: true, status: true },
      orderBy: { articleNumber: "asc" },
      take: 100,
    });
    return ok(rows, "legal_core.legal_articles", rows.length ? 0.9 : 0.3);
  } catch (e) {
    return fail<unknown[]>([], "legal_core", `تعذّر جلب المدى: ${(e as Error).message}`);
  }
}

// ── علاقات (٣) ───────────────────────────────────────────────────────────────
export async function get_related_articles(articleId: string): Promise<ToolResult<unknown>> {
  try {
    const ctx = await getArticleFullContext(articleId);
    if (!ctx) return fail(null, "legal_core", "المادة غير موجودة");
    return ok(ctx.related ?? [], "legal_core.related", 0.8);
  } catch (e) {
    return fail(null, "legal_core", `تعذّر جلب المواد ذات الصلة: ${(e as Error).message}`);
  }
}

export async function get_implementing_bylaw(articleId: string): Promise<ToolResult<unknown[]>> {
  try {
    const rels = await prisma.legalRelation.findMany({
      where: { sourceType: "article", sourceId: articleId, relation: "IMPLEMENTS" },
      take: 20,
    });
    return ok(rels, "legal_relations", rels.length ? 0.8 : 0.3, rels.length ? undefined : "لا لائحة تنفيذية مرتبطة مُوسَّمة");
  } catch (e) {
    return fail<unknown[]>([], "legal_relations", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

export async function get_applying_rulings(articleId: string): Promise<ToolResult<unknown[]>> {
  try {
    const rels = await prisma.legalRelation.findMany({
      where: { targetType: "article", targetId: articleId, sourceType: "ruling" },
      take: 20,
    });
    return ok(rels, "legal_relations", rels.length ? 0.75 : 0.3, rels.length ? undefined : "لا أحكام مُطبِّقة مُوسَّمة لهذه المادة");
  } catch (e) {
    return fail<unknown[]>([], "legal_relations", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

// ── زمن (٣) — تعتمد على التوسيم الزمني الموجود (article_versions / article_amendments) ──
export async function get_article_at_date(articleId: string, iso: string): Promise<ToolResult<unknown>> {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return fail(null, "article_versions", "تاريخ غير صالح");
  try {
    const v = await getArticleVersionAt(articleId, at);
    return v ? ok(v, "article_versions", 0.9) : fail(null, "article_versions", "لا نسخة نافذة في هذا التاريخ (قد تكون البيانات الزمنية ناقصة)");
  } catch (e) {
    return fail(null, "article_versions", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

export async function get_amendment_history(articleId: string): Promise<ToolResult<unknown[]>> {
  try {
    const rows = await prisma.articleAmendment.findMany({
      where: { articleId },
      orderBy: { version: "asc" },
      take: 50,
    });
    return ok(rows, "article_amendments", rows.length ? 0.9 : 0.4, rows.length ? undefined : "لا تعديلات مُسجّلة (بيانات قد تكون ناقصة)");
  } catch (e) {
    return fail<unknown[]>([], "article_amendments", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

export async function check_article_status(articleId: string): Promise<ToolResult<{ status: string | null; badge: string | null }>> {
  try {
    const ctx = await getArticleFullContext(articleId);
    if (!ctx) return fail({ status: null, badge: null }, "legal_core", "المادة غير موجودة");
    const badge = articleStatusBadge(ctx.status);
    return ok({ status: ctx.status, badge: badge?.label ?? null }, "legal_core.status", 0.9);
  } catch (e) {
    return fail({ status: null, badge: null }, "legal_core", `تعذّر: ${(e as Error).message}`);
  }
}

// ── عزو (٣) ──────────────────────────────────────────────────────────────────
export function build_citation(systemName: string, articleNumber: number): ToolResult<string> {
  const label = buildArticleCitation(systemName, articleNumber);
  return ok(label, "citation-formatter", 1);
}

export async function verify_citation(input: { articleId?: string; systemName?: string; articleNumber?: number }): Promise<ToolResult<unknown>> {
  const r = await validateLegalCitation(input);
  return r.ok
    ? ok(r, "legal_core.legal_articles", 1)
    : fail(r, "legal_core.legal_articles", r.message); // استشهاد غير مؤصَّل → يُحجَب
}

export async function get_thesaurus_term(term: string): Promise<ToolResult<unknown>> {
  try {
    const row = await prisma.glossaryTerm.findFirst({
      where: { term: { contains: term.trim(), mode: "insensitive" } },
    });
    return row ? ok(row, "glossary_terms", 0.9) : fail(null, "glossary_terms", "لا تعريف معجميّ لهذا المصطلح");
  } catch (e) {
    return fail(null, "glossary_terms", `تعذّر الجلب: ${(e as Error).message}`);
  }
}

/**
 * مسح فهرس نظام كاملًا (للحصر الاستقصائي): يعيد كل مواد النظام بنصّها لاستخراج العناصر
 * حتميًّا (مثل كل المدد). محدود بسقف أمان. ليس ضمن الأدوات الـ١٦ القياسية (أداة استقصاء).
 */
export async function scan_system_articles(
  systemName: string,
  limit = 1200
): Promise<ToolResult<Array<{ articleNumber: number; title: string; content: string }>>> {
  try {
    const rows = await prisma.legalArticle.findMany({
      where: { lawName: { contains: systemName.trim(), mode: "insensitive" } },
      select: { articleNumber: true, title: true, content: true },
      orderBy: { articleNumber: "asc" },
      take: Math.min(Math.max(limit, 1), 2000),
    });
    return ok(rows, "legal_core.legal_articles(full-scan)", rows.length ? 0.95 : 0.3, rows.length ? undefined : "لا مواد لهذا النظام");
  } catch (e) {
    return fail<Array<{ articleNumber: number; title: string; content: string }>>([], "legal_core", `تعذّر مسح النظام: ${(e as Error).message}`);
  }
}

/**
 * وضع المسح المفهوميّ (المرحلة ٣) — للحصر المفهوميّ (مثل «كل مواد السلطة التقديرية للمحكمة»).
 * يمسح **فهرس المعيار** (norm_modality/norm_addressee) ضمن نطاقٍ اختياريّ، **بلا top‑k**،
 * فيُرجِع كل المواد المطابقة للمفهوم دون مواد عرضية. سقوط آمن إلى [] قبل الوسم/الهجرة.
 * يُطابِق شكل LegalCoreResult كي ينساب في خطّ التحقّق/الصياغة كبقيّة الأدوات.
 */
export async function scan_normative(
  opts: { systemName?: string; modality: NormativeModality; addressee?: string; limit?: number }
): Promise<ToolResult<LegalCoreResult[]>> {
  try {
    const hits = await queryNormative(opts);
    const mapped: LegalCoreResult[] = hits.map((h) => ({
      articleId: h.id,
      systemName: h.lawName,
      systemId: null,
      articleNumber: h.articleNumber,
      articleTitle: h.title,
      articleText: h.content,
      classification: null,
      status: null,
      chapter: null,
      relevanceReason: `حصر مفهوميّ: ${opts.modality}${opts.addressee ? ` / ${opts.addressee}` : ""}`,
      citationLabel: `${h.lawName}، المادة ${h.articleNumber}`,
      internalUrl: `/dashboard/legal-core/articles/${h.id}`,
      relevanceScore: 100,
      matchedTerms: [],
      matchedParagraphs: [],
      matchType: "general" as const,
      snippet: (h.content ?? "").slice(0, 450),
      conceptCoverage: 0,
      phraseMatches: 0,
    }));
    return ok(mapped, "legal_core.normative_index(full-scan)", mapped.length ? 0.95 : 0.3, mapped.length ? undefined : "لا مواد مُوسَّمة مطابقة (قد يلزم الوسم/الهجرة)");
  } catch (e) {
    return fail<LegalCoreResult[]>([], "legal_core.normative_index", `تعذّر المسح المفهوميّ: ${(e as Error).message}`);
  }
}

/** سجلّ الأدوات — لتوجيه المنسّق واختباره (المرحلة ٣+). */
export const TOOLS = {
  search_articles,
  search_rulings,
  search_principles,
  semantic_search,
  get_article_by_eli,
  get_system_toc,
  get_articles_range,
  get_related_articles,
  get_implementing_bylaw,
  get_applying_rulings,
  get_article_at_date,
  get_amendment_history,
  check_article_status,
  build_citation,
  verify_citation,
  get_thesaurus_term,
} as const;

export type ToolName = keyof typeof TOOLS;
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];
