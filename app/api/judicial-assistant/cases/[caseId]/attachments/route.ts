import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { addAttachment, removeAttachment } from "@/lib/modules/judicial-assistant/store";

export const dynamic = "force-dynamic";

// النصّ مُستخرَجٌ في المتصفّح (extractFile) — الملفّ لا يغادر الجهاز؛ يُرسَل النصّ فقط (PDPL).
const schema = z.object({
  name: z.string().min(1),
  text: z.string().min(1, "لا نصّ في المرفق."),
});

/** POST /api/judicial-assistant/cases/[caseId]/attachments — إضافة مرفقٍ للمالك فقط. */
export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات المرفق غير صالحة." }, { status: 400 });
  }

  const ok = await addAttachment(params.caseId, actorId, payload);
  if (!ok) return NextResponse.json({ message: "تعذّر إضافة المرفق (تحقّق من الملكيّة)." }, { status: 404 });

  await auditEvent({
    actorId, subject: "CASE", action: "JA_ATTACHMENT_ADDED", entityId: params.caseId,
    metadata: { name: payload.name, chars: payload.text.length },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

/** DELETE ?attId=… — حذف مرفقٍ واحد (المالك فقط). */
export async function DELETE(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  const attId = request.nextUrl.searchParams.get("attId");
  if (!attId) return NextResponse.json({ message: "معرّف المرفق مفقود." }, { status: 400 });

  const ok = await removeAttachment(params.caseId, actorId, attId);
  if (!ok) return NextResponse.json({ message: "تعذّر حذف المرفق (تحقّق من الملكيّة)." }, { status: 404 });

  await auditEvent({ actorId, subject: "CASE", action: "JA_ATTACHMENT_REMOVED", entityId: params.caseId, metadata: { attId } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
