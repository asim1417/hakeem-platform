import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { buildSettlementDraft, extractClaim } from "@/lib/modules/simulations/hakeem-judge";
import { facilitateSettlement } from "@/lib/modules/simulations/courtroom-skills";

export const dynamic = "force-dynamic";

const schema = z.object({ amount: z.string().optional(), obligations: z.string().optional(), duration: z.string().optional(), waiver: z.string().optional(), plaintiffProposal: z.string().optional(), defendantProposal: z.string().optional() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = schema.parse(await request.json());
  const user = gate.user!;
  const session = await findOwnedSimulation(user, params.id, { messages: { orderBy: { createdAt: "asc" } } });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });

  // مهارة تيسير الصلح المؤصَّلة (اسأل حكيم)؛ سقوطٌ آمنٌ للقالب عند أيّ فشل.
  let content = buildSettlementDraft(payload);
  try {
    const skill = await facilitateSettlement(extractClaim(session.messages), session.messages, payload);
    if (skill) content = skill.content;
  } catch {
    content = buildSettlementDraft(payload);
  }

  const decision = await prisma.simulationDecision.create({
    data: { simulationId: params.id, stage: "SETTLEMENT", decisionType: "مسودة صلح تدريبية", content }
  });
  await prisma.simulation.update({ where: { id: params.id }, data: { stage: "SETTLEMENT" } });
  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_SETTLEMENT_DRAFT_CREATED",
    entityId: params.id,
    metadata: { description: "تم توليد مسودة صلح تدريبية.", decisionId: decision.id }
  });
  return NextResponse.json({ decision });
}
