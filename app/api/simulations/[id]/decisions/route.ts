import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { encodeTurnState, extractTurnState, turnForDecision } from "@/lib/modules/simulations/judge-engine";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  decisionType: z.string().min(2).default("فتح باب المرافعة"),
  content: z.string().optional()
});

function stageForDecision(decisionType: string) {
  if (decisionType.includes("قفل")) return "CLOSE_PLEADING" as const;
  if (decisionType.includes("صلح")) return "SETTLEMENT" as const;
  if (decisionType.includes("فتح")) return "PLEADING" as const;
  if (decisionType.includes("المدعى عليه")) return "DEFENDANT_RESPONSE" as const;
  if (decisionType.includes("المدعي") || decisionType.includes("بينة")) return "PLAINTIFF_STATEMENT" as const;
  return "PROCEDURAL_DECISION" as const;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = decisionSchema.parse(await request.json().catch(() => ({})));
  const user = gate.user!;
  const session = await findOwnedSimulation(user, params.id, {
    messages: { orderBy: { createdAt: "asc" } }
  });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });

  const stage = stageForDecision(payload.decisionType);
  const content = payload.content?.trim() || `قرار إجرائي: ${payload.decisionType}.`;
  const previousTurn = extractTurnState(session.messages);
  const turnState = turnForDecision(payload.decisionType, stage);

  const decision = await prisma.simulationDecision.create({
    data: {
      simulationId: params.id,
      stage,
      decisionType: payload.decisionType,
      content
    }
  });

  await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: "النظام",
      stage,
      content: encodeTurnState(turnState)
    }
  });

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_DECISION_CREATED",
    entityId: params.id,
    metadata: {
      simulationId: params.id,
      decisionId: decision.id,
      decisionType: payload.decisionType,
      previousAllowedRole: previousTurn?.allowedSpeakerRole,
      nextAllowedRole: turnState.allowedSpeakerRole,
      procedureAction: turnState.procedureAction,
      currentStage: turnState.currentStage,
      nextStage: turnState.nextStage,
      stage
    }
  });

  return NextResponse.json({ decision, turnState }, { status: 201 });
}
