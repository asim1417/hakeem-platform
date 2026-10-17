import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideAmendmentOp } from "@/lib/modules/editorial/intake";
import { editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const body = z.object({
  decision: z.enum(["approved", "rejected", "approved_with_edit"]),
  corrected: z.record(z.union([z.string(), z.number()])).optional(),
  note: z.string().max(2000).optional(),
});

// POST /api/admin/legal/intake/amendments/[opId]/decide — قرار المعتمِد يُضاف صفًّا في uqn_fix.amendment_review.
export async function POST(request: NextRequest, { params }: { params: { opId: string } }) {
  const gate = await requireEditorialApi(request, "review");
  if (gate.response) return gate.response;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "القرار غير صالح." }, { status: 400 });
  try {
    return NextResponse.json(await decideAmendmentOp(editorialDb(), gate.actor, decodeURIComponent(params.opId), parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
