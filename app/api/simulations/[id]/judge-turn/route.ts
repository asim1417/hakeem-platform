import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { callJudge } from "@/lib/modules/simulations/judge-engine";
import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const session = await prisma.simulation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  const result = callJudge({
    claim: extractClaim(session.messages),
    messages: session.messages,
    decisions: session.decisions,
    attachmentsCount: 0
  });

  const judgeMessage = await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: "القاضي الافتراضي",
      stage: result.hearingStage,
      content: result.judgeMessage
    }
  });

  let decision = null;
  if (result.decisionType && !session.decisions.some((item) => item.decisionType === result.decisionType && item.stage === result.hearingStage)) {
    decision = await prisma.simulationDecision.create({
      data: {
        simulationId: params.id,
        stage: result.hearingStage,
        decisionType: result.decisionType,
        content: result.decisionContent ?? result.nextProceduralStep
      }
    });
  }

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage: result.hearingStage }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_JUDGE_TURN",
    entityId: params.id,
    metadata: {
      stage: result.hearingStage,
      currentTurn: result.currentTurn,
      nextProceduralStep: result.nextProceduralStep,
      decisionType: result.decisionType,
      messageId: judgeMessage.id,
      decisionId: decision?.id
    }
  });

  return NextResponse.json({ result, message: judgeMessage, decision }, { status: 201 });
}
