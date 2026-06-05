/**
 * /api/original-hakeem/legal-search
 *
 * Safe, read-only legal search endpoint for hakim1111.html.
 * - No auth required (public judicial training data).
 * - Read-only — no mutations.
 * - Returns general legal articles only (no sensitive data).
 * - Max 10 results per request.
 * - Delegates to searchLegalCore for actual retrieval.
 */

import { NextRequest, NextResponse } from "next/server";
import type { ArabicSearchType } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore, getArticlesByNumber } from "@/lib/modules/legal-core/legal-retrieval";

export const dynamic = "force-dynamic";

const ALLOWED_SEARCH_TYPES = new Set<string>([
  "exact","contains","derivatives","root","stem",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const query = (sp.get("q") ?? sp.get("query") ?? "").trim().slice(0, 200);
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "q parameter required", results: [] },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const rawSearchType = sp.get("searchType") ?? "contains";
  const searchType = (
    ALLOWED_SEARCH_TYPES.has(rawSearchType) ? rawSearchType : "contains"
  ) as ArabicSearchType;

  // Safety cap: max 10 results
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 6), 1), 10);

  // Source types — articles only by default (no sensitive data)
  const rawSources = sp.getAll("sourceTypes").flatMap((s) => s.split(",")).map((s) => s.trim());
  const sourceTypes = rawSources.length > 0 ? rawSources.filter((s) => s !== "case_link") : ["article"];

  // قيد الأنظمة المفضّلة (من خريطة المواد القضائية) — يمنع تسرّب مواد من أنظمة لا صلة لها
  const systemIds = [...sp.getAll("systemIds"), ...sp.getAll("system")]
    .flatMap((s) => s.split("|")).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean)
    .slice(0, 8);

  // وضع التحقق المباشر بالرقم: للتثبّت من وجود مادة مذكورة في الحكم (لا مطابقة نصية)
  const articleNumberParam = sp.get("articleNumber");
  if (articleNumberParam) {
    const n = Number(articleNumberParam.replace(/[^0-9]/g, ""));
    try {
      const arts = await getArticlesByNumber(n, systemIds[0]);
      const results = arts.map((r) => ({
        id: r.articleId, type: "article", resultType: "legal_article",
        systemName: r.systemName, systemId: r.systemId, articleNumber: r.articleNumber,
        title: r.articleTitle, snippet: r.snippet, citationLabel: r.citationLabel, url: r.internalUrl
      }));
      return NextResponse.json(
        { ok: true, mode: "byNumber", total: results.length, results,
          message: results.length ? undefined : "لم يتم العثور على سند نظامي مطابق في النواة القانونية الحالية." },
        { headers: CORS_HEADERS }
      );
    } catch (error) {
      console.error("[legal-search:byNumber] Error:", error);
      return NextResponse.json({ ok: false, error: "خطأ في التحقق", results: [] }, { status: 500, headers: CORS_HEADERS });
    }
  }

  try {
    const response = await searchLegalCore({
      query,
      searchType,
      sourceTypes,
      systemIds: systemIds.length ? systemIds : undefined,
      page: 1,
      limit,
      includeSnippets: true,
      includeMatchedParagraphs: false,
      includeRelatedTerms: false,
    });

    const results = response.results.map((r) => ({
      id: r.articleId,
      type: "article",
      resultType: "legal_article",
      systemName: r.systemName,
      systemId: r.systemId,
      articleNumber: r.articleNumber,
      title: r.articleTitle,
      snippet: r.snippet,
      citationLabel: r.citationLabel,
      url: r.internalUrl,
      relevanceScore: r.relevanceScore,
      matchType: r.matchType,
    }));

    return NextResponse.json(
      {
        ok: true,
        query: response.query,
        searchType: response.searchType,
        total: response.total,
        results,
        message: results.length === 0
          ? "لم يتم العثور على سند نظامي مطابق في النواة القانونية الحالية."
          : undefined,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[legal-search] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "خطأ في الاتصال بالنواة القانونية",
        results: [],
        message: "لم يتم العثور على سند نظامي مطابق في النواة القانونية الحالية.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
