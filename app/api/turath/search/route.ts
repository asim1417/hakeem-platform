import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { searchTurath, fetchTurathRaw } from "@/lib/modules/turath/turath-client";

export const dynamic = "force-dynamic";

// GET /api/turath/search?q=... — وسيط بحث حيّ في مكتبة تراث (turath.io).
// المفاتيح/الاتصال تبقى في الخادم؛ الواجهة تستهلك نتائج منسّقة فقط.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? params.get("query") ?? "").trim();
  const limit = Math.min(Number(params.get("limit")) || 10, 20);

  if (q.length < 2) {
    return NextResponse.json({ ok: false, error: "أدخل عبارة بحث (حرفان فأكثر).", results: [] }, { status: 400 });
  }

  // وضع تشخيص مؤقّت: يُظهر شكل استجابة تراث الخام لضبط المحوّل بدقّة.
  if (params.get("debug") === "1") {
    return NextResponse.json(await fetchTurathRaw(q));
  }

  const data = await searchTurath(q, limit);
  // تخزين مؤقّت قصير للنتائج المتطابقة (تخفيف الضغط على تراث).
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
