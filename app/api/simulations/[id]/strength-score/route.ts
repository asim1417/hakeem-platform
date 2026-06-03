import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { extractClaim, scoreMarker, strengthScore } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const session = await prisma.simulation.findUnique({ where: { id: params.id }, include: { messages: true } });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  const attachmentsCount = await prisma.attachment.count();
  const score = strengthScore(extractClaim(session.messages), attachmentsCount);
  const message = await prisma.simulationMessage.create({
    data: { simulationId: params.id, role: "النظام", stage: "PROCEDURAL_DECISION", content: `${scoreMarker}${JSON.stringify(score)}` }
  });
  await auditEvent({ actorId: user.id, subject: "SIMULATION", action: "HAKEEM_STRENGTH_SCORE_CREATED", entityId: params.id, metadata: { description: "تم حساب مقياس قوة الدعوى.", ...score } });
  return NextResponse.json({ score, message });
}
