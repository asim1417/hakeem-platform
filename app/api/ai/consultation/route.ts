import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().optional(),
  matterType: z.string().optional(),
  facts: z.string().min(20, "أدخل وقائع كافية لربطها بالمكتبة النظامية."),
  question: z.string().optional(),
  userId: z.string().optional(),
  caseId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("CONSULTATIONS_LIMITED", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;
  const payload = schema.parse(await request.json());
  const factsForAnalysis = [
    payload.title ? `عنوان الاستشارة: ${payload.title}` : "",
    payload.matterType ? `نوع المسألة: ${payload.matterType}` : "",
    `الواقعة: ${payload.facts}`,
    payload.question ? `طلب المستخدم: ${payload.question}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const draft = await createAgentConsultationDraft({ facts: factsForAnalysis, actorId });

  let consultationId: string | undefined;
  const consultation = await prisma.consultation.create({
    data: {
      userId: actorId,
      caseId: payload.caseId,
      facts: factsForAnalysis,
      output: draft.output,
      status: draft.blocked ? "BLOCKED" : "GENERATED",
      qualityReport: {
        ...(draft.qualityReport as Record<string, unknown>),
        title: payload.title,
        matterType: payload.matterType,
        question: payload.question
      },
      citations: {
        create: draft.citations
      }
    }
  });
  consultationId = consultation.id;

  await auditEvent({
    actorId,
    subject: "AI_GATEWAY",
    action: draft.blocked ? "CONSULTATION_BLOCKED" : "CONSULTATION_GENERATED",
    entityId: consultationId,
    metadata: {
      requestId: draft.requestId,
      blocked: draft.blocked,
      citations: draft.citations.length,
      provider: draft.provider,
      mode: draft.mode
    }
  });

  const warning = "هذه المخرجات مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو بديلًا عن مراجعة محامٍ مختص.";
  const noCitationMessage = "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";

  return NextResponse.json({
    summary: payload.facts,
    analysis: draft.blocked ? noCitationMessage : draft.output,
    result: draft.blocked ? noCitationMessage : "تم تحليل الواقعة بالاستناد إلى مواد موجودة في قاعدة البيانات.",
    citations: draft.citations,
    warning,
    consultationId,
    blocked: draft.blocked,
    requestId: draft.requestId,
    qualityReport: draft.qualityReport
  });
}
