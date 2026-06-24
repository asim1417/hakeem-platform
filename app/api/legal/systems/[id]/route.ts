import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getSystemDetail } from "@/lib/modules/library/library-service";

export const dynamic = "force-dynamic";

// GET /api/legal/systems/:id — تفاصيل نظام مع مواده مجمّعة بالفصول (id أو اسم).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const detail = await getSystemDetail(decodeURIComponent(params.id)).catch(() => null);
  if (!detail || detail.articleCount === 0) return NextResponse.json({ ok: false, error: "النظام غير موجود." }, { status: 404 });
  return NextResponse.json({ ok: true, system: detail });
}
