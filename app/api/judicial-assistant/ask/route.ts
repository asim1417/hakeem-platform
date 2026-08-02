import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { askAssistant } from "@/lib/modules/judicial-assistant/ask";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";
import { guardAiService } from "@/lib/modules/billing/service-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ question: z.string().min(3, "اكتب طلبك."), caseId: z.string().optional() });

/** POST /api/judicial-assistant/ask — موجّه المعاون (عقلٌ حرّ مؤصَّل). سياق القضية اختياريّ. */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "اكتب طلبًا واضحًا (٣ أحرف على الأقلّ)." }, { status: 400 });
  }

  let kase = null;
  if (body.caseId) {
    kase = await getCase(body.caseId);
    if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
      return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
    }
  }

  const guard = await guardAiService({ userId: actorId, serviceCode: "ASK_SOURCED", rateLimit: { limit: 30, windowSec: 60 } });
  if (!guard.allowed) {
    return NextResponse.json(
      { message: guard.message, reason: guard.reason },
      { status: guard.reason === "rate_limited" ? 429 : 402 }
    );
  }

  try {
    const result = await askAssistant(body.question, kase, actorId);

    if (kase && result.requestId !== "greeting") {
      await saveAnalysis({
        caseRef: kase.id, caseNumber: kase.caseNumber ?? kase.subject, serviceId: "ASK",
        blocked: result.blocked, payload: { question: body.question, answer: result.answer, citations: result.citations, requestId: result.requestId }, actorId,
      });
    }

    await auditEvent({
      actorId, subject: "CASE", action: result.blocked ? "JA_ASK_BLOCKED" : "JA_ASK", entityId: kase?.id,
      metadata: { requestId: result.requestId, hasCase: Boolean(kase), citations: result.citations.length },
    }).catch(() => undefined);

    // لا يُحاسَب المستخدم على ردٍّ محجوب/مرفوض من حارس النموذج — يُحرَّر الحجز بدل تثبيته.
    if (result.blocked) {
      await guard.release();
    } else {
      await guard.settle();
    }
    return NextResponse.json(result);
  } catch (e) {
    await guard.release();
    throw e;
  }
}
