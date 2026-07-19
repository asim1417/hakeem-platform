import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { computeDeadlines } from "@/lib/modules/judicial-assistant/rules/deadline";
import { buildEvidenceMatrix } from "@/lib/modules/judicial-assistant/rules/evidence";

export const dynamic = "force-dynamic";

const schema = z.object({
  caseId: z.string().min(1),
  serviceId: z.enum(["JS-009", "JS-010"]),
});

/**
 * POST /api/judicial-assistant/action — تشغيل الأعمال الحتميّة (محرّك القواعد، مستقلٌّ عن النموذج).
 * JS-009 حساب المدد، JS-010 مصفوفة الإثبات. RBAC + تدقيق. لا اختلاق: تُبنى من بيانات القضية.
 */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("CONSULTATIONS_FULL", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "طلبٌ غير صالح." }, { status: 400 });
  }

  const kase = await getCase(body.caseId);
  if (!kase) return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });

  const result = body.serviceId === "JS-009" ? computeDeadlines(kase) : buildEvidenceMatrix(kase);

  await auditEvent({
    actorId,
    subject: "CASE",
    action: "JA_DETERMINISTIC_ACTION",
    entityId: kase.id,
    metadata: { service: body.serviceId, caseNumber: kase.caseNumber, synthetic: true },
  }).catch(() => undefined);

  return NextResponse.json(result);
}
