import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/modules/editorial/read";
import { editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/audit — سجل التدقيق التحريري (W-04).
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const q = request.nextUrl.searchParams;
  try {
    const items = await listAudit(editorialDb(), {
      action: q.get("action") ?? undefined,
      objectType: q.get("objectType") ?? undefined,
      actor: q.get("actor") ?? undefined,
      limit: Number(q.get("limit") ?? 100) || 100,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
