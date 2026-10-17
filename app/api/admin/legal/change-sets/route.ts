import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createChangeSet, listChangeSets } from "@/lib/modules/editorial/service";
import { editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { WORK_STATUSES, type EditorialStatus } from "@/lib/modules/editorial/types";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "checks_failed", "pending", "approved", "rejected", "published", "reverted", "open"] as const;

// GET /api/admin/legal/change-sets?status=open — دفعات المحررين.
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  const raw = request.nextUrl.searchParams.get("status") ?? "open";
  const status = (STATUSES as readonly string[]).includes(raw) ? (raw as EditorialStatus | "open") : "open";
  try {
    return NextResponse.json({ items: await listChangeSets(editorialDb(), { status }) });
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
});

// POST /api/admin/legal/change-sets — مسودة دفعة جديدة (الفعل التجريبي: set_work_status).
export async function POST(request: NextRequest) {
  const gate = await requireEditorialApi(request, "propose");
  if (gate.response) return gate.response;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "مدخلات الدفعة غير صالحة." }, { status: 400 });
  try {
    const result = await createChangeSet(editorialDb(), gate.actor, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
