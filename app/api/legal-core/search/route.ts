import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { normalizeArabicText, type ArabicSearchType } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const allowedSearchTypes = new Set(["exact", "contains", "derivatives", "root", "stem", "affixes"]);

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") ?? searchParams.get("q") ?? "";
  const searchTypeParam = searchParams.get("searchType") ?? "contains";
  const searchType = (allowedSearchTypes.has(searchTypeParam) ? searchTypeParam : "contains") as ArabicSearchType;
  const page = parsePositiveNumber(searchParams.get("page"), 1);
  const limit = Math.min(parsePositiveNumber(searchParams.get("limit"), 20), 80);
  const sourceTypes = readList(searchParams, "sourceTypes", "sourceType");

  const response = await searchLegalCore({
    query,
    searchType,
    categoryIds: readList(searchParams, "categoryIds", "category"),
    systemIds: readList(searchParams, "systemIds", "systemId", "system"),
    sourceTypes,
    fields: readList(searchParams, "fields", "field"),
    page,
    limit,
    includeSnippets: searchParams.get("includeSnippets") !== "false",
    includeMatchedParagraphs: searchParams.get("includeMatchedParagraphs") !== "false",
    includeRelatedTerms: searchParams.get("includeRelatedTerms") === "true"
  });

  const judgmentResults = sourceTypes.includes("judgment") || sourceTypes.includes("case_link")
    ? await searchJudgments(query, page, limit)
    : [];

  return NextResponse.json({
    query: response.query,
    searchType: response.searchType,
    total: response.total + judgmentResults.length,
    page: response.page,
    limit: response.limit,
    relatedTerms: response.relatedTerms,
    results: [
      ...response.results.map((result) => ({
      id: result.articleId,
      type: "article",
      resultType: "legal_article",
      systemName: result.systemName,
      systemId: result.systemId,
      articleNumber: result.articleNumber,
      title: result.articleTitle,
      articleTitle: result.articleTitle,
      snippet: result.snippet,
      matchedParagraphs: result.matchedParagraphs,
      matchedTerms: result.matchedTerms,
      category: result.classification,
      classification: result.classification,
      chapter: result.chapter,
      url: result.internalUrl,
      internalUrl: result.internalUrl,
      citation: result.citationLabel,
      citationLabel: result.citationLabel,
      matchType: result.matchType,
      relevanceReason: result.relevanceReason,
        relevanceScore: result.relevanceScore
      })),
      ...judgmentResults
    ],
    message: response.message
  });
}

/** كلمات tsquery مُطبَّعة (نفس تطبيع search_norm) بصيغة OR — نظير بحث المواد. */
function judgmentTsQuery(query: string): string {
  const words = new Set<string>();
  for (const w of normalizeArabicText(query).split(/\s+/)) if (w.length >= 2) words.add(w);
  return [...words].slice(0, 40).join(" | ");
}

/**
 * بحث الأحكام:
 *   ① مفهرس أوّلًا: search_norm العربيّ المُطبَّع عبر فهرس GIN (نظير المواد) — يعالج تباين
 *      الصرف («مقاولات» ⇄ «للمقاولات»)، يرتّب بـ ts_rank_cd، ويبحث في المتن كلّه لا حقلٍ ضيّق.
 *   ② سقوط آمن للبحث المعجميّ (ILIKE) عند غياب العمود (قبل الهجرة/التعبئة) أو عدم وجود مطابقة —
 *      فلا ينكسر شيءٌ قبل تشغيل الهجرة والتعبئة، ويبقى الاستدعاء قائمًا أثناء الانتقال.
 */
async function searchJudgments(query: string, page: number, limit: number) {
  if (!query.trim()) return [];
  const tsq = judgmentTsQuery(query);
  if (tsq) {
    try {
      const ranked = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        // التعبير يطابق حرفيًّا فهرس idx_judicial_cases_search_norm_tsv (وإلّا مسحٌ تسلسليّ).
        `SELECT id FROM judicial_cases
         WHERE search_norm IS NOT NULL
           AND to_tsvector('simple', coalesce(search_norm, '')) @@ to_tsquery('simple', $1)
         ORDER BY ts_rank_cd(to_tsvector('simple', coalesce(search_norm, '')), to_tsquery('simple', $1)) DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        tsq
      );
      if (ranked.length) {
        const ids = ranked.map((r) => r.id);
        const rows = await prisma.judicialCase.findMany({
          where: { id: { in: ids } },
          include: { articleLinks: { include: { article: true }, take: 5 } }
        });
        const rank = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
        return rows.map((judgment) => mapJudgment(judgment, query));
      }
    } catch {
      /* العمود/الفهرس غير مطبَّق بعد → سقوط للمعجميّ */
    }
  }
  return searchJudgmentsLexical(query, page, limit);
}

/** المسار المعجميّ الاحتياطيّ (السلوك السابق) — ILIKE على أعمدة الحكم الخام. */
async function searchJudgmentsLexical(query: string, page: number, limit: number) {
  const judgments = await prisma.judicialCase.findMany({
    where: {
      OR: [
        { judgmentTitle: { contains: query, mode: "insensitive" } },
        { judgmentText: { contains: query, mode: "insensitive" } },
        { appealText: { contains: query, mode: "insensitive" } },
        { caseNo: { contains: query, mode: "insensitive" } },
        { decisionNo: { contains: query, mode: "insensitive" } }
      ]
    },
    include: { articleLinks: { include: { article: true }, take: 5 } },
    orderBy: [{ decisionDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit
  });
  return judgments.map((judgment) => mapJudgment(judgment, query));
}

type JudgmentWithLinks = Prisma.JudicialCaseGetPayload<{
  include: { articleLinks: { include: { article: true } } };
}>;

function mapJudgment(judgment: JudgmentWithLinks, query: string) {
  return ({
    id: judgment.id,
    type: "judgment",
    resultType: "judicial_case",
    systemName: judgment.court ?? "حكم قضائي",
    systemId: null,
    articleNumber: null,
    title: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    articleTitle: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    snippet: buildJudgmentSnippet(judgment.judgmentText ?? "", query),
    matchedParagraphs: [],
    matchedTerms: [query],
    category: judgment.classification,
    classification: judgment.classification,
    chapter: judgment.cityName,
    url: `/dashboard/legal-core/judgments/${judgment.id}`,
    internalUrl: `/dashboard/legal-core/judgments/${judgment.id}`,
    citation: [judgment.court, judgment.caseNo ? `قضية ${judgment.caseNo}` : null, judgment.decisionNo ? `قرار ${judgment.decisionNo}` : null].filter(Boolean).join("، "),
    citationLabel: [judgment.court, judgment.caseNo ? `قضية ${judgment.caseNo}` : null, judgment.decisionNo ? `قرار ${judgment.decisionNo}` : null].filter(Boolean).join("، "),
    matchType: "contains",
    relevanceReason: "تطابق داخل مستودع الأحكام القضائية",
    relevanceScore: judgment.articleLinks.length ? 18 : 10
  });
}

function buildJudgmentSnippet(text: string, query: string) {
  const index = text.indexOf(query);
  if (index < 0) return text.slice(0, 420);
  const start = Math.max(index - 140, 0);
  return `${start > 0 ? "..." : ""}${text.slice(start, start + 520)}${start + 520 < text.length ? "..." : ""}`;
}

function parsePositiveNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readList(searchParams: URLSearchParams, ...keys: string[]) {
  return keys.flatMap((key) => searchParams.getAll(key)).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}
