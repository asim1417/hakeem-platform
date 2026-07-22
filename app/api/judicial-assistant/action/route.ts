import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { computeDeadlines } from "@/lib/modules/judicial-assistant/rules/deadline";
import { buildEvidenceMatrix } from "@/lib/modules/judicial-assistant/rules/evidence";
import { buildTimeline } from "@/lib/modules/judicial-assistant/rules/timeline";
import { checkJurisdiction, checkAdmissibility } from "@/lib/modules/judicial-assistant/rules/admissibility";
import { analyzeProcedure, checkOperative, checkQuality, buildTaskList } from "@/lib/modules/judicial-assistant/rules/checklists";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";
import { DETERMINISTIC_IDS } from "@/lib/modules/judicial-assistant/routing";

export const dynamic = "force-dynamic";

const schema = z.object({
  caseId: z.string().min(1),
  // مصدرٌ واحد مع التوجيه — لا تباعد بين المسار والواجهة.
  serviceId: z.enum(DETERMINISTIC_IDS),
});

/**
 * POST /api/judicial-assistant/action — تشغيل الأعمال الحتميّة (محرّك القواعد، مستقلٌّ عن النموذج).
 * JS-009 حساب المدد، JS-010 مصفوفة الإثبات. RBAC + تدقيق. لا اختلاق: تُبنى من بيانات القضية.
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

  try {
  const result =
    body.serviceId === "JS-009" ? computeDeadlines(kase)
    : body.serviceId === "JS-004" ? buildTimeline(kase)
    : body.serviceId === "JS-006" ? checkJurisdiction(kase)
    : body.serviceId === "JS-007" ? checkAdmissibility(kase)
    : body.serviceId === "JS-008" ? analyzeProcedure(kase)
    : body.serviceId === "JS-019" ? checkOperative(kase)
    : body.serviceId === "JS-020" ? checkQuality(kase)
    : body.serviceId === "JS-024" ? buildTaskList(kase)
    : buildEvidenceMatrix(kase);

  await saveAnalysis({
    caseRef: kase.id,
    caseNumber: kase.caseNumber ?? kase.subject,
    serviceId: body.serviceId,
    blocked: false,
    payload: result as unknown as Record<string, unknown>,
    actorId,
  });

  await auditEvent({
    actorId,
    subject: "CASE",
    action: "JA_DETERMINISTIC_ACTION",
    entityId: kase.id,
    metadata: { service: body.serviceId, caseNumber: kase.caseNumber ?? kase.subject },
  }).catch(() => undefined);

  return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ message: `تعذّر تشغيل الخدمة: ${err instanceof Error ? err.message.slice(0, 200) : "خطأٌ غير متوقّع"}` }, { status: 500 });
  }
}
