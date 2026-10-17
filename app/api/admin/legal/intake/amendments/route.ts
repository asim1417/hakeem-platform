import type { NextRequest } from "next/server";
import { listAmendmentQueue } from "@/lib/modules/editorial/intake";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/intake/amendments?after=&view=mine|waiting_others — عمليات التعديل المستخرجة آليًّا بلا قرار.
// → { items, total, next_cursor, waiting_others }
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const q = request.nextUrl.searchParams;
  const confidence = q.get("confidence");
  try {
    const result = await listAmendmentQueue(editorialDb(), {
      confidence: confidence === "rule_exact" || confidence === "needs_review" ? confidence : undefined,
      opType: q.get("opType") ?? undefined,
      target: q.get("target") ?? undefined,
      bulkOnly: q.get("bulk") === "1",
      limit: Number(q.get("limit") ?? 25) || 25,
      // الترقيم بالمفتاح (ق٢٦)؛ offset يبقى للتوافق حين لا يُرسل after.
      after: q.get("after") || undefined,
      offset: Number(q.get("offset") ?? 0) || 0,
      view: q.get("view") === "waiting_others" ? "waiting_others" : "mine",
    }, gate.actor);
    return deskJson(result);
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
