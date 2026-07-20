import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { updateCaseMeta, deleteCase } from "@/lib/modules/judicial-assistant/store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  subject: z.string().min(3).optional(),
  caseNumber: z.string().nullable().optional(),
  court: z.string().nullable().optional(),
  circuit: z.string().nullable().optional(),
  jurisdiction: z.string().optional(),
  confidentiality: z.string().optional(),
  stage: z.string().optional(),
});

/** PATCH — تعديل بيانات القضية (المالك فقط). */
export async function PATCH(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let patch: z.infer<typeof patchSchema>;
  try {
    patch = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات التعديل غير صالحة." }, { status: 400 });
  }

  const ok = await updateCaseMeta(params.caseId, actorId, patch);
  if (!ok) return NextResponse.json({ message: "تعذّر التعديل (تحقّق من الملكيّة)." }, { status: 404 });

  await auditEvent({ actorId, subject: "CASE", action: "JA_CASE_UPDATED", entityId: params.caseId, metadata: { fields: Object.keys(patch) } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

/** DELETE — حذف القضية بالكامل (المالك فقط). */
export async function DELETE(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  const ok = await deleteCase(params.caseId, actorId);
  if (!ok) return NextResponse.json({ message: "تعذّر الحذف (تحقّق من الملكيّة)." }, { status: 404 });

  await auditEvent({ actorId, subject: "CASE", action: "JA_CASE_DELETED", entityId: params.caseId }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
