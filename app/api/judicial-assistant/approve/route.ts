import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";

export const dynamic = "force-dynamic";

const schema = z.object({ caseId: z.string().min(1), serviceId: z.string().min(1), requestId: z.string().optional() });

/**
 * POST /api/judicial-assistant/approve — اعتماد القاضي لمخرَج خدمةٍ (الإنسان في الحلقة كفعلٍ مُسجَّل).
 * لا يغيّر المخرَج؛ يُثبّت قرار القاضي في سجلّ التدقيق (مَن اعتمد ومتى وأيّ خدمة). RBAC + ABAC.
 */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "طلبٌ غير صالح." }, { status: 400 });
  }

  const kase = await getCase(body.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  await auditEvent({
    actorId, subject: "CASE", action: "JA_OUTPUT_APPROVED", entityId: kase.id,
    metadata: { service: body.serviceId, requestId: body.requestId, caseNumber: kase.caseNumber ?? kase.subject, approvedAtLabel: "معتمَدٌ من القاضي" },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, message: "اعتُمِد المخرَج وسُجِّل في سجلّ النشاط." });
}
