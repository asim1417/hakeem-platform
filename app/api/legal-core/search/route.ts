import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { type ArabicSearchType } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";

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

  const response = await searchLegalCore({
    query,
    searchType,
    categoryIds: readList(searchParams, "categoryIds", "category"),
    systemIds: readList(searchParams, "systemIds", "systemId", "system"),
    sourceTypes: readList(searchParams, "sourceTypes", "sourceType"),
    fields: readList(searchParams, "fields", "field"),
    page,
    limit,
    includeSnippets: searchParams.get("includeSnippets") !== "false",
    includeMatchedParagraphs: searchParams.get("includeMatchedParagraphs") !== "false",
    includeRelatedTerms: searchParams.get("includeRelatedTerms") === "true"
  });

  return NextResponse.json({
    query: response.query,
    searchType: response.searchType,
    total: response.total,
    page: response.page,
    limit: response.limit,
    relatedTerms: response.relatedTerms,
    results: response.results.map((result) => ({
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
    message: response.message
  });
}

function parsePositiveNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readList(searchParams: URLSearchParams, ...keys: string[]) {
  return keys.flatMap((key) => searchParams.getAll(key)).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}
