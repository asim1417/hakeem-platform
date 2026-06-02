import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { buildAppealDraft } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["استئناف", "نقض", "التماس إعادة نظر"]),
  reasons: z.array(z.string()).default([])
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = schema.parse(await request.json());
  const user = await getSystemUser();
  const decision = await prisma.simulationDecision.create({
    data: { simulationId: params.id, stage: "OBJECTION", decisionType: payload.kind, content: buildAppealDraft(payload.kind, payload.reasons) }
  });
  await auditEvent({ actorId: user.id, subject: "SIMULATION", action: "HAKEEM_POST_JUDGMENT_CREATED", entityId: params.id, metadata: { description: `تم إنشاء ${payload.kind} تدريبي.`, reasons: payload.reasons } });
  return NextResponse.json({ decision });
}
