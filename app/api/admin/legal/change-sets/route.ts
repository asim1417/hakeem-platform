import type { NextRequest } from "next/server";
import { z } from "zod";
import { listChangeSetsDetailed } from "@/lib/modules/editorial/read";
import { createChangeSet } from "@/lib/modules/editorial/service";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { WORK_STATUSES } from "@/lib/modules/editorial/types";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "checks_failed", "pending", "approved", "rejected", "published", "reverted", "open"] as const;

// GET /api/admin/legal/change-sets?status=open — الدفعات بتفاصيلها (ChangeSetView[]) في نطاق المشاهد.
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const raw = request.nextUrl.searchParams.get("status") ?? "open";
  const status = (STATUSES as readonly string[]).includes(raw) ? raw : "open";
  try {
    return deskJson({ items: await listChangeSetsDetailed(editorialDb(), gate.actor, { status }) });
  } catch (error) {
    return editorialErrorResponse(error);
  }
}

const evidence = z.object({ instrument: z.string(), url: z.string(), quote: z.string() });
const body = z.object({
  title: z.string().min(3).max(200),
  changes: z
    .array(
      z.object({
        op: z.literal("set_work_status"),
        targetId: z.string().min(1).max(100),
        status: z.enum(WORK_STATUSES),
        evidence,
        note: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(50),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

// POST /api/admin/legal/change-sets — مسودة دفعة جديدة (الفعل التجريبي: set_work_status).
export async function POST(request: NextRequest) {
  const gate = await requireEditorialApi(request, "propose");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "مدخلات الدفعة غير صالحة." }, 400);
    const result = await createChangeSet(editorialDb(), gate.actor, parsed.data);
    return deskJson(result, 201);
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
