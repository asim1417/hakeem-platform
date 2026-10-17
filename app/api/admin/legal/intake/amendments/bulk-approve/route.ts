import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BULK_LIMIT, bulkApproveAmendmentOps } from "@/lib/modules/editorial/intake";
import { editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const body = z.object({ opIds: z.array(z.string().min(1)).min(1).max(BULK_LIMIT), note: z.string().max(2000).optional() });

// POST /api/admin/legal/intake/amendments/bulk-approve — لعمليات rule_exact المطابقة حرفيًّا وبلا مخاطر فقط.
export async function POST(request: NextRequest) {
  const gate = await requireEditorialApi(request, "review");
  if (gate.response) return gate.response;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "قائمة العمليات غير صالحة." }, { status: 400 });
  try {
    return NextResponse.json(await bulkApproveAmendmentOps(editorialDb(), gate.actor, parsed.data.opIds, parsed.data.note));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
