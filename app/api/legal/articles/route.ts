import { NextRequest, NextResponse } from "next/server";
import { listArticlesForSync } from "@/lib/modules/library/library-service";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// [INT-001] GET /api/legal/articles?updatedSince=&page=&pageSize=&systemId=
// سحب جماعي + تغذية تغييرات للمزامنة الخارجية (أنظمة إدارة/مواقع/فهارس ذكاء).
// المزامنة التزايدية: مرّر syncCursor العائد كـ updatedSince في الطلب التالي.
export async function GET(request: NextRequest) {
  return handleLegalApi(request, "legal:read", async () => {
    const sp = request.nextUrl.searchParams;
    const result = await listArticlesForSync({
      page: Number(sp.get("page")) || undefined,
      pageSize: Number(sp.get("pageSize")) || undefined,
      updatedSince: sp.get("updatedSince") ?? undefined,
      systemId: sp.get("systemId") ?? undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  });
}
