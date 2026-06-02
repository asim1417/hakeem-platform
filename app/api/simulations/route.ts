import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(3).optional(),
  caseTitle: z.string().optional()
});

export async function POST(request: NextRequest) {
  const payload = schema.parse(await request.json().catch(() => ({})));
  const user = await getSystemUser();
  const title = payload.title?.trim() || payload.caseTitle?.trim() || "جلسة محاكاة قضائية تدريبية";

  const simulation = await prisma.simulation.create({
    data: {
      userId: user.id,
      title,
      stage: "CLAIM_FILING",
      messages: {
        create: {
          role: "النظام",
          stage: "CLAIM_FILING",
          content: "تم إنشاء جلسة محاكاة قضائية تدريبية وتقييد الدعوى."
        }
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
