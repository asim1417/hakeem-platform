import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";
import { getRelationsForEntity, hydrateRelations } from "@/lib/modules/knowledge-graph/relations";

export const dynamic = "force-dynamic";

// GET /api/legal-search?q=... — بحث هجين (نصّي + دلالي + رسم معرفي + OpenSearch).
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? params.get("query") ?? "").trim();
  const limit = Math.min(Number(params.get("limit")) || 10, 30);

  if (q.length < 2) {
    return NextResponse.json({ ok: false, error: "أدخل عبارة بحث (حرفان فأكثر)." }, { status: 400 });
  }

  const search = await hybridSearch({ q, limit });

  // تجميع حسب النوع
  const articles = search.results.filter((r) => r.type === "article");
  const rulings = search.results.filter((r) => r.type === "ruling");
  const principles = search.results.filter((r) => r.type === "principle");

  // العلاقات القانونية لأهمّ المواد المطابقة (اجتياز الرسم المعرفي)
  let relations: Awaited<ReturnType<typeof hydrateRelations>> = [];
  try {
    const seen = new Set<string>();
    for (const a of articles.slice(0, 5)) {
      const rels = await getRelationsForEntity("article", a.id);
      const fresh = rels.filter((r) => !seen.has(r.id));
      fresh.forEach((r) => seen.add(r.id));
      relations.push(...(await hydrateRelations(fresh)));
    }
  } catch {
    relations = [];
  }

  return NextResponse.json({
    ok: true,
    query: q,
    mode: search.mode,
    providers: search.providers, // حالة كل مزوّد: active / unavailable
    counts: {
      articles: articles.length,
      rulings: rulings.length,
      principles: principles.length,
      relations: relations.length,
    },
    articles,
    rulings,
    principles,
    relations,
  });
}
