import { NextRequest, NextResponse } from "next/server";
import { getSystemDetail } from "@/lib/modules/library/library-service";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/systems/:id — تفاصيل نظام مع مواده مجمّعة بالفصول (id أو اسم).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleLegalApi(request, "legal:read", async () => {
    const detail = await getSystemDetail(decodeURIComponent(params.id)).catch(() => null);
    if (!detail || detail.articleCount === 0) return NextResponse.json({ ok: false, error: "النظام غير موجود." }, { status: 404 });
    return NextResponse.json({ ok: true, system: detail });
  });
}
