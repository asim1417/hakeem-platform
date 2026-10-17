import type { NextRequest } from "next/server";
import { listChangeSetsDetailed } from "@/lib/modules/editorial/read";
import { getChangeSet } from "@/lib/modules/editorial/service";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/change-sets/[id] — الدفعة وتغييراتها، ومعها view (ChangeSetView).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  try {
    const db = editorialDb();
    const found = await getChangeSet(db, params.id);
    if (!found) return deskJson({ code: "NOT_FOUND", message: "الدفعة غير موجودة." }, 404);
    const [view] = await listChangeSetsDetailed(db, gate.actor, { id: params.id });
    // خارج نطاق المشاهد: لا تُكشف الدفعة.
    if (!view) return deskJson({ code: "NOT_FOUND", message: "الدفعة غير موجودة." }, 404);
    return deskJson({ ...found, view });
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
