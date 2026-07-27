import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { admissibilityCheck, buildHearingRecord, extractClaim } from "@/lib/modules/simulations/hakeem-judge";
import { assessAdmissibility } from "@/lib/modules/simulations/courtroom-skills";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const session = await findOwnedSimulation(user, params.id, { messages: true });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  const claim = extractClaim(session.messages);
  // الحارس الحتميّ لاكتمال البيانات (شرطٌ صلب) ثمّ مهارة فحص القبول المؤصَّلة (اسأل حكيم).
  const admissibility = admissibilityCheck(claim);
  if (!admissibility.complete) return NextResponse.json({ message: admissibility.message, admissibility }, { status: 400 });

  let content = buildHearingRecord(session, claim);
  try {
    const skill = await assessAdmissibility(claim);
    if (skill) content = `${content}\n\n${skill.content}`;
  } catch {
    /* فحص القبول المؤصَّل اختياريّ — لا يكسر ضبط الجلسة */
  }
  const decision = await prisma.simulationDecision.create({
    data: { simulationId: params.id, stage: "HEARING_RECORD", decisionType: "ضبط جلسة تدريبية", content }
  });
  await prisma.simulation.update({ where: { id: params.id }, data: { stage: "HEARING_RECORD" } });
  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_HEARING_RECORD_CREATED",
    entityId: params.id,
    metadata: { description: "تم توليد ضبط جلسة تدريبي.", decisionId: decision.id }
  });
  return NextResponse.json({ decision });
}
