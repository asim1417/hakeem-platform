import type { NextRequest } from "next/server";
import { z } from "zod";
import { decodePathParam } from "@/lib/modules/editorial/http-guard";
import { decideAmendmentOp } from "@/lib/modules/editorial/intake";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const body = z.object({
  decision: z.enum(["approved", "rejected", "approved_with_edit"]),
  corrected: z.record(z.union([z.string(), z.number()])).optional(),
  note: z.string().max(2000).optional(),
  // ق٢٣-٣: بصمة القرار المعروض؛ إلزامية حين يوجد قرار معلّق (409 بلا كتابة عند الاختلاف).
  expectedDecisionHash: z.string().max(128).optional(),
});

// POST /api/admin/legal/intake/amendments/[opId]/decide — قرار المعتمِد يُضاف صفًّا في uqn_fix.amendment_review.
export async function POST(request: NextRequest, { params }: { params: { opId: string } }) {
  const gate = await requireEditorialApi(request, "review");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "القرار غير صالح." }, 400);
    return deskJson(await decideAmendmentOp(editorialDb(), gate.actor, decodePathParam(params.opId, "معرّف العملية"), parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
