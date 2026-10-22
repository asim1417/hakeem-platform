import type { NextRequest } from "next/server";
import { listAudit } from "@/lib/modules/editorial/read";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/audit — سجل التدقيق التحريري (W-04): لعرض الجودة أو المعتمِد (ق-١٢).
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "audit");
  if (gate.response) return gate.response;
  const q = request.nextUrl.searchParams;
  try {
    const items = await listAudit(editorialDb(), gate.actor, {
      action: q.get("action") ?? undefined,
      objectType: q.get("objectType") ?? undefined,
      actor: q.get("actor") ?? undefined,
      limit: Number(q.get("limit") ?? 100) || 100,
    });
    return deskJson({ items });
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
