import type { NextRequest } from "next/server";
import { listPrincipleQueue } from "@/lib/modules/editorial/intake";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/intake/principles — المبادئ المستخرجة آليًّا التي تنتظر المراجعة.
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const q = request.nextUrl.searchParams;
  try {
    return deskJson(
      await listPrincipleQueue(editorialDb(), {
        topic: q.get("topic") ?? undefined,
        limit: Number(q.get("limit") ?? 25) || 25,
        offset: Number(q.get("offset") ?? 0) || 0,
      }),
    );
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
