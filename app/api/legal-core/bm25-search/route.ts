/**
 * /api/legal-core/bm25-search?q=... — بحث BM25 عام للقراءة فقط على فهرس النواة المُرمَّز.
 * يعيد النتائج الأعلى صلةً (استشهاد + مقتطف + رمز). لا توليد، لا مساس بالقاعدة.
 */
import { NextRequest, NextResponse } from "next/server";
import { bm25Search } from "@/lib/modules/legal-core/bm25";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // [إصلاح SEARCH-005] كان بلا بوّابة — أُلحق بنفس صلاحية بقيّة مسارات النواة الداخلية.
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 12), 1), 30);
  if (!q) {
    return NextResponse.json({ ok: false, error: "q parameter required", results: [] }, { status: 400 });
  }
  const hits = bm25Search(q, limit);
  return NextResponse.json(
    {
      ok: true,
      query: q,
      total: hits.length,
      results: hits.map((h) => ({
        code: h.code,
        score: h.score,
        citation: h.meta.citation,
        lawName: h.meta.law_name,
        articleNumber: h.meta.article_number,
        snippet: h.meta.snippet
      }))
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
