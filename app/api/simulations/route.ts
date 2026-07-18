import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { encodeClaim } from "@/lib/modules/simulations/hakeem-judge";
import { encodeTurnState } from "@/lib/modules/simulations/judge-engine";
import { gateAdvancedUse, settleAdvancedUse } from "@/lib/modules/billing/access-gate";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(3).optional(),
  caseTitle: z.string().optional(),
  caseType: z.string().optional(),
  plaintiffName: z.string().optional(),
  plaintiffCapacity: z.string().optional(),
  defendantName: z.string().optional(),
  defendantCapacity: z.string().optional(),
  subject: z.string().optional(),
  facts: z.string().optional(),
  requests: z.string().optional(),
  claimAmount: z.string().optional(),
  legalGrounds: z.string().optional(),
  defenses: z.string().optional(),
  attendance: z.string().optional()
});

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const sessions = await prisma.simulation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 25,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } },
      judgments: { orderBy: { createdAt: "asc" } }
    }
  });

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const access = await gateAdvancedUse(user.id);
  if (!access.allowed) {
    return NextResponse.json(
      { blocked: true, reason: "exhausted", message: access.message },
      { status: 402 }
    );
  }
  const payload = schema.parse(await request.json().catch(() => ({})));
  const title = payload.title?.trim() || payload.subject?.trim() || payload.caseTitle?.trim() || "جلسة محاكاة قضائية";
  const claimContent = encodeClaim(payload);

  const simulation = await prisma.simulation.create({
    data: {
      userId: user.id,
      title,
      stage: "CLAIM_FILING",
      messages: {
        create: [
          {
            role: "النظام",
            stage: "CLAIM_FILING",
            content: "تم إنشاء جلسة محاكاة قضائية وتقييد الدعوى مبدئيًا."
          },
          {
            role: "النظام",
            stage: "CLAIM_FILING",
            content: claimContent
          },
          {
            role: "النظام",
            stage: "PLAINTIFF_STATEMENT",
            content: encodeTurnState({
              allowedSpeakerRole: "claimant",
              disabledRoles: ["defendant", "defendant_agent"],
              requiredInput: "بيان المدعي لدعواه ووقائعها وطلباته.",
              procedureAction: "تمكين المدعي من عرض الدعوى",
              currentStage: "CLAIM_FILING",
              nextStage: "PLAINTIFF_STATEMENT",
              reason: "بدأت الجلسة بتقييد الدعوى، والدور الأول للمدعي."
            })
          }
        ]
      }
    }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_SESSION_CREATED",
    entityId: simulation.id,
    metadata: {
      description: `تم إنشاء جلسة محاكاة: ${title}`,
      stage: "CLAIM_FILING",
      nextAllowedRole: "claimant",
      procedureAction: "تمكين المدعي من عرض الدعوى"
    }
  });

  // الخصم بعد النجاح فقط (جلسة أُنشئت فعلًا).
  void settleAdvancedUse(user.id, access.via).catch(() => undefined);

  return NextResponse.json({ sessionId: simulation.id, session: simulation }, { status: 201 });
}
