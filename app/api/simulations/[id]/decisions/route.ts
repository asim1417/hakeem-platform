import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  decisionType: z.string().min(2).default("فتح باب المرافعة"),
  content: z.string().optional()
});

function stageForDecision(decisionType: string) {
  if (decisionType.includes("قفل")) return "CLOSE_PLEADING" as const;
  if (decisionType.includes("صلح")) return "SETTLEMENT" as const;
  if (decisionType.includes("فتح")) return "PLEADING" as const;
  return "PROCEDURAL_DECISION" as const;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = decisionSchema.parse(await request.json().catch(() => ({})));
  const user = gate.user!;
  const stage = stageForDecision(payload.decisionType);
  const content = payload.content?.trim() || `قرار إجرائي: ${payload.decisionType}.`;

  const decision = await prisma.simulationDecision.create({
    data: {
      simulationId: params.id,
      stage,
      decisionType: payload.decisionType,
      content
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
      decisionId: decision.id,
      decisionType: payload.decisionType,
      stage
    }
  });

  return NextResponse.json({ decision }, { status: 201 });
}
