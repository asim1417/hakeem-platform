import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { buildAppealDraft } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

const allowedKinds = new Set(["استئناف", "نقض", "التماس إعادة نظر", "ط§ط³طھط¦ظ†ط§ظپ", "ظ†ظ‚ط¶", "ط§ظ„طھظ…ط§ط³ ط¥ط¹ط§ط¯ط© ظ†ط¸ط±"]);

const schema = z.object({
  kind: z.string().refine((value) => allowedKinds.has(value), "نوع الاعتراض غير مدعوم."),
  reasons: z.array(z.string()).default([])
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;

  const payload = schema.parse(await request.json());
  const user = gate.user!;
  const session = await findOwnedSimulation(user, params.id, {
    judgments: { orderBy: { createdAt: "desc" }, take: 1 }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  if (!session.judgments.length) {
    return NextResponse.json({ message: "لا يمكن فتح مرحلة الاعتراض قبل صدور الحكم." }, { status: 400 });
  }

  const decision = await prisma.simulationDecision.create({
    data: {
      simulationId: params.id,
      stage: "OBJECTION",
      decisionType: payload.kind,
      content: buildAppealDraft(payload.kind, payload.reasons)
    }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_POST_JUDGMENT_CREATED",
    entityId: params.id,
    metadata: { description: `تم إنشاء مسودة ${payload.kind} تدريبية.`, reasons: payload.reasons }
  });

  return NextResponse.json({ decision });
}
