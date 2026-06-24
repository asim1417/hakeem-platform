import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getSearchSuggestions } from "@/lib/modules/legal-search/suggestions";

export const dynamic = "force-dynamic";

// GET /api/legal-search/suggest?q=... — اقتراحات إكمال تلقائي للبحث.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, suggestions: [] });

  const suggestions = await getSearchSuggestions(q, 8);
  return NextResponse.json({ ok: true, suggestions });
}
