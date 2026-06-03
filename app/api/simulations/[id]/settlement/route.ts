import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { buildSettlementDraft } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

const schema = z.object({ amount: z.string().optional(), obligations: z.string().optional(), duration: z.string().optional(), waiver: z.string().optional() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = schema.parse(await request.json());
  const user = gate.user!;
  const decision = await prisma.simulationDecision.create({
    data: { simulationId: params.id, stage: "SETTLEMENT", decisionType: "مسودة صلح تدريبية", content: buildSettlementDraft(payload) }
  });
  await prisma.simulation.update({ where: { id: params.id }, data: { stage: "SETTLEMENT" } });
  await auditEvent({ actorId: user.id, subject: "SIMULATION", action: "HAKEEM_SETTLEMENT_DRAFT_CREATED", entityId: params.id, metadata: { description: "تم توليد مسودة صلح تدريبية.", decisionId: decision.id } });
  return NextResponse.json({ decision });
}
