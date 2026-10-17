import type { NextRequest } from "next/server";
import { z } from "zod";
import { decideChangeSet, publishChangeSet, revertChangeSet, submitChangeSet, withdrawChangeSet } from "@/lib/modules/editorial/service";
import { deskJson, editorialDb, editorialErrorResponse, type EditorialNeed, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const NEED: Record<string, EditorialNeed> = { submit: "propose", decide: "review", publish: "review", revert: "view", withdraw: "view" };

const decideBody = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().max(2000).optional() });
const revertBody = z.object({ reason: z.string().min(3).max(2000), emergency: z.boolean().optional() });
const withdrawBody = z.object({ reason: z.string().min(3).max(2000) });

// POST /api/admin/legal/change-sets/[id]/(submit|decide|publish|revert|withdraw)
export async function POST(request: NextRequest, { params }: { params: { id: string; action: string } }) {
  const need = NEED[params.action];
  if (!need) return deskJson({ code: "NOT_FOUND", message: "فعل غير معروف." }, 404);
  const gate = await requireEditorialApi(request, need);
  if (gate.response) return gate.response;
  const db = editorialDb();
  try {
    if (params.action === "submit") return deskJson(await submitChangeSet(db, gate.actor, params.id));
    if (params.action === "publish") return deskJson(await publishChangeSet(db, gate.actor, params.id));
    const json = await readDeskJson(request);
    if (params.action === "decide") {
      const parsed = decideBody.safeParse(json);
      if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "القرار غير صالح." }, 400);
      return deskJson(await decideChangeSet(db, gate.actor, params.id, parsed.data));
    }
    if (params.action === "withdraw") {
      const parsed = withdrawBody.safeParse(json);
      if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "سبب السحب مطلوب." }, 400);
      return deskJson(await withdrawChangeSet(db, gate.actor, params.id, parsed.data));
    }
    const parsed = revertBody.safeParse(json);
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "سبب التراجع مطلوب." }, 400);
    return deskJson(await revertChangeSet(db, gate.actor, params.id, parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
