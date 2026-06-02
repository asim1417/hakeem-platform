import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { admissibilityCheck, buildHearingRecord, extractClaim } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSystemUser();
  const session = await prisma.simulation.findUnique({ where: { id: params.id }, include: { messages: true } });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  const claim = extractClaim(session.messages);
  const admissibility = admissibilityCheck(claim);
  if (!admissibility.complete) return NextResponse.json({ message: admissibility.message, admissibility }, { status: 400 });

  const content = buildHearingRecord(session, claim);
  const decision = await prisma.simulationDecision.create({
    data: { simulationId: params.id, stage: "HEARING_RECORD", decisionType: "ضبط جلسة تدريبي", content }
  });
  await prisma.simulation.update({ where: { id: params.id }, data: { stage: "HEARING_RECORD" } });
  await auditEvent({ actorId: user.id, subject: "SIMULATION", action: "HAKEEM_HEARING_RECORD_CREATED", entityId: params.id, metadata: { description: "تم توليد ضبط جلسة تدريبي.", decisionId: decision.id } });
  return NextResponse.json({ decision });
}
