import { NextRequest, NextResponse } from "next/server";
import { listSystems } from "@/lib/modules/library/library-service";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/systems?q=&classification=&page=&pageSize= — قائمة الأنظمة (بحث/تصفية/ترقيم).
export async function GET(request: NextRequest) {
  return handleLegalApi(request, "legal:read", async () => {
    const sp = request.nextUrl.searchParams;
    const result = await listSystems({
      q: sp.get("q") ?? undefined,
      classification: sp.get("classification") ?? undefined,
      page: Number(sp.get("page")) || undefined,
      pageSize: Number(sp.get("pageSize")) || undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  });
}
