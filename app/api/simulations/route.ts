import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { encodeClaim } from "@/lib/modules/simulations/hakeem-judge";

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
  const payload = schema.parse(await request.json().catch(() => ({})));
  const user = gate.user!;
  const title = payload.title?.trim() || payload.subject?.trim() || payload.caseTitle?.trim() || "جلسة محاكاة قضائية تدريبية";
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
            content: "تم إنشاء جلسة محاكاة قضائية تدريبية وتقييد الدعوى."
          },
          {
            role: "النظام",
            stage: "CLAIM_FILING",
            content: claimContent
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
      stage: "CLAIM_FILING"
    }
  });

  return NextResponse.json({ sessionId: simulation.id, session: simulation }, { status: 201 });
}
