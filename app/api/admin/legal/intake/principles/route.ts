import type { NextRequest } from "next/server";
import { listPrincipleQueue } from "@/lib/modules/editorial/intake";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/intake/principles?after=&view=mine|waiting_others — المبادئ التي تنتظر المراجعة.
// → { items, total, next_cursor, waiting_others }
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const q = request.nextUrl.searchParams;
  try {
    return deskJson(
      await listPrincipleQueue(editorialDb(), {
        topic: q.get("topic") ?? undefined,
        limit: Number(q.get("limit") ?? 25) || 25,
        after: q.get("after") || undefined,
        offset: Number(q.get("offset") ?? 0) || 0,
        view: q.get("view") === "waiting_others" ? "waiting_others" : "mine",
      }, gate.actor),
    );
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
