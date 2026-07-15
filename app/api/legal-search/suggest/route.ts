import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getSearchSuggestions } from "@/lib/modules/legal-search/suggestions";
import { getRecentSearches } from "@/lib/modules/legal-search/search-log";

export const dynamic = "force-dynamic";

// GET /api/legal-search/suggest?q=... — اقتراحات إكمال تلقائي للبحث.
// عند q فارغ: يعيد آخر عمليات بحث المستخدم الحالي (kind: "recent") لعرضها عند التركيز.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  // صندوق فارغ عند التركيز → سجل بحث المستخدم الأخير (خاص به فقط).
  if (q.length < 2) {
    const recent = await getRecentSearches(6);
    const suggestions = recent.map((value) => ({ value, kind: "recent" as const, hint: "بحث سابق" }));
    return NextResponse.json({ ok: true, suggestions });
  }

  const suggestions = await getSearchSuggestions(q, 8);
  return NextResponse.json({ ok: true, suggestions });
}
