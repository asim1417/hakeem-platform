import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/search?q=&limit= — واجهة بحث قانوني (بوابة خارجية بمفتاح أو جلسة داخلية).
export async function GET(request: NextRequest) {
  return handleLegalApi(request, "legal:read", async () => {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 50);
    if (q.length < 2) return NextResponse.json({ ok: false, error: "أدخل عبارة بحث (حرفان فأكثر)." }, { status: 400 });

    const data = await hybridSearch({ q, limit });
    // لا نُخرج حقول الحالة الداخلية (مثل needs_review) في الواجهة العامة.
    const results = data.results.map((r) => {
      if (!r.meta) return r;
      const { status: _s, reviewStatus: _rs, ...metaPublic } = r.meta as Record<string, unknown>;
      return { ...r, meta: metaPublic };
    });
    return NextResponse.json({ ok: true, query: q, total: results.length, providers: data.providers, results });
  });
}
