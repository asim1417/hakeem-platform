import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createConsultationDraft } from "@/lib/modules/ai/ai-gateway";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  facts: z.string().min(20, "أدخل وقائع كافية لربطها بالمكتبة النظامية."),
  userId: z.string().optional(),
  caseId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const payload = schema.parse(await request.json());
  const draft = await createConsultationDraft({ facts: payload.facts, actorId: payload.userId });

  let consultationId: string | undefined;
  if (payload.userId && !draft.blocked) {
    const consultation = await prisma.consultation.create({
      data: {
        userId: payload.userId,
        caseId: payload.caseId,
        facts: payload.facts,
        output: draft.output,
        status: "GENERATED",
        qualityReport: draft.qualityReport,
        citations: {
          create: draft.citations
        }
      }
    });
    consultationId = consultation.id;
  }

  await auditEvent({
    actorId: payload.userId,
    subject: "AI_GATEWAY",
    action: draft.blocked ? "CONSULTATION_BLOCKED" : "CONSULTATION_GENERATED",
    entityId: consultationId,
    metadata: {
      requestId: draft.requestId,
      blocked: draft.blocked,
      citations: draft.citations.length
    }
  });

  return NextResponse.json({ ...draft, consultationId });
}
