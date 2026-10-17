import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideChangeSet, publishChangeSet, revertChangeSet, submitChangeSet, withdrawChangeSet } from "@/lib/modules/editorial/service";
import { editorialDb, editorialErrorResponse, requireEditorialApi, type EditorialNeed } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const NEED: Record<string, EditorialNeed> = { submit: "propose", decide: "review", publish: "review", revert: "view", withdraw: "view" };

const decideBody = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().max(2000).optional() });
const revertBody = z.object({ reason: z.string().min(3).max(2000), emergency: z.boolean().optional() });
const withdrawBody = z.object({ reason: z.string().min(3).max(2000) });

// POST /api/admin/legal/change-sets/[id]/(submit|decide|publish|revert|withdraw)
export async function POST(request: NextRequest, { params }: { params: { id: string; action: string } }) {
  const need = NEED[params.action];
  if (!need) return NextResponse.json({ code: "NOT_FOUND", message: "فعل غير معروف." }, { status: 404 });
  const gate = await requireEditorialApi(request, need);
  if (gate.response) return gate.response;
  const db = editorialDb();
  try {
    if (params.action === "submit") return NextResponse.json(await submitChangeSet(db, gate.actor, params.id));
    if (params.action === "publish") return NextResponse.json(await publishChangeSet(db, gate.actor, params.id));
    const json = await request.json().catch(() => null);
    if (params.action === "decide") {
      const parsed = decideBody.safeParse(json);
      if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "القرار غير صالح." }, { status: 400 });
      return NextResponse.json(await decideChangeSet(db, gate.actor, params.id, parsed.data));
    }
    if (params.action === "withdraw") {
      const parsed = withdrawBody.safeParse(json);
      if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "سبب السحب مطلوب." }, { status: 400 });
      return NextResponse.json(await withdrawChangeSet(db, gate.actor, params.id, parsed.data));
    }
    const parsed = revertBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "سبب التراجع مطلوب." }, { status: 400 });
    return NextResponse.json(await revertChangeSet(db, gate.actor, params.id, parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
