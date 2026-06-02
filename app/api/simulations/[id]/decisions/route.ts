import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  decisionType: z.string().min(2).default("فتح باب المرافعة"),
  content: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = decisionSchema.parse(await request.json().catch(() => ({})));
  const user = await getSystemUser();
  const stage = payload.decisionType.includes("قفل")
    ? "CLOSE_PLEADING"
    : payload.decisionType.includes("صلح")
      ? "SETTLEMENT"
      : payload.decisionType.includes("فتح")
        ? "PLEADING"
        : "PROCEDURAL_DECISION";
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
