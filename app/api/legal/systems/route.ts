import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { listSystems } from "@/lib/modules/library/library-service";

export const dynamic = "force-dynamic";

// GET /api/legal/systems?q=&classification=&page=&pageSize= — قائمة الأنظمة (بحث/تصفية/ترقيم).
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const sp = request.nextUrl.searchParams;
  const result = await listSystems({
    q: sp.get("q") ?? undefined,
    classification: sp.get("classification") ?? undefined,
    page: Number(sp.get("page")) || undefined,
    pageSize: Number(sp.get("pageSize")) || undefined
  });
  return NextResponse.json({ ok: true, ...result });
}
