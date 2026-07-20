import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
<<<<<<< HEAD
import { gateAdvancedUse, settleAdvancedUse } from "@/lib/modules/billing/access-gate";
=======
import { canConsume, consumeOne } from "@/lib/modules/billing/quota";
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";
>>>>>>> origin/main

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().optional(),
  matterType: z.string().optional(),
  facts: z.string().min(20, "أدخل وقائع كافية لربطها بالمكتبة النظامية."),
  question: z.string().optional(),
  userId: z.string().optional(),
  caseId: z.string().optional(),
  // موافقة صريحة على حفظ أسرار الموكّل كاملةً (القرار). بلا موافقة: يُخزَّن نصٌّ مُعمّى.
  consentToStore: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("CONSULTATIONS_LIMITED", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;
  // حصّة أولًا، ثم نقاط advanced_use عند النفاد.
  const access = await gateAdvancedUse(actorId);
  if (!access.allowed) {
    return NextResponse.json(
      { blocked: true, reason: "exhausted", message: access.message },
      { status: 200 }
    );
  }
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

  // القرار: الحفظ الكامل يتطلّب موافقةً صريحة؛ بدونها يُخزَّن نصٌّ مُعمّى (بلا معرّفات الأطراف).
  const consented = payload.consentToStore === true;
  const storedFacts = consented ? factsForAnalysis : sanitizeForModel(factsForAnalysis).text;

  let consultationId: string | undefined;
  const consultation = await prisma.consultation.create({
    data: {
      userId: actorId,
      caseId: payload.caseId,
      facts: storedFacts,
      output: draft.output,
      status: draft.blocked ? "BLOCKED" : "GENERATED",
      qualityReport: {
        ...(draft.qualityReport as Record<string, unknown>),
        storage: consented ? "full_with_consent" : "redacted",
        consentToStore: consented,
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

  // الخصم بعد النجاح فقط (استشارة مُولَّدة فعلًا، لا محجوبة). النقاط خُصمت مسبقًا إن via=credits.
  if (!draft.blocked) void settleAdvancedUse(actorId, access.via).catch(() => undefined);

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
