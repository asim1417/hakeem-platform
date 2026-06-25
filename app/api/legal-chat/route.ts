import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { runChatTurn } from "@/lib/modules/legal-chat/chat-orchestrator";
import type { ChatTurnInput, SimulationCaseFile } from "@/lib/modules/legal-chat/types";

export const dynamic = "force-dynamic";

const SIM_MODES = ["RESEARCHER", "PLAINTIFF_LAWYER", "DEFENDANT_LAWYER", "OPPONENT", "JUDGE", "ARBITRATOR", "DRAFTING_REVIEWER", "EVIDENCE_EXAMINER", "JUDGMENT_EXAMINER", "CONTRACT_EXAMINER"] as const;
const SEARCH_STRENGTHS = ["QUICK", "BALANCED", "DEEP", "JUDICIAL_EXTENDED", "ARBITRATION"] as const;

const schema = z.object({
  message: z.string().trim().min(2, "اكتب رسالتك (حرفان فأكثر).").max(8000),
  mode: z.enum(SIM_MODES).default("RESEARCHER"),
  searchStrength: z.enum(SEARCH_STRENGTHS).default("BALANCED"),
  approval: z.enum(["CONFIRM", "DRAFT_WITH_ASSUMPTIONS"]).nullable().optional(),
  caseFile: z.any().optional(), // ملف القضية القائم (يُمرّر من العميل كما هو)
  conversationId: z.string().nullable().optional(), // العميل يرسل null في أول رسالة
  redact: z.boolean().nullable().optional(),
  workflow: z.string().max(80).nullable().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().max(300),
        mimeType: z.string().max(120),
        declaredKind: z.string().max(120).optional(),
        content: z.string().max(60000).optional(),
      })
    )
    .max(20)
    .optional(),
});

// POST /api/legal-chat — دورة شات قضائي ذكي (فهم → تأكيد → تحليل → صياغة) مع حوكمة.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  const user = gate.user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "مدخلات غير صحيحة." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const turnInput: ChatTurnInput = {
    message: data.message,
    mode: data.mode,
    searchStrength: data.searchStrength,
    caseFile: (data.caseFile as SimulationCaseFile | undefined) ?? null,
    approval: data.approval ?? null,
    attachments: data.attachments,
    redact: data.redact ?? undefined,
    workflow: data.workflow ?? undefined,
  };

  const result = await runChatTurn(turnInput);

  // الحفظ best-effort: لا يُفشل الرد إن لم تكن جداول الشات مفعّلة بعد.
  let conversationId = data.conversationId ?? null;
  if (user && result.caseFile) {
    try {
      conversationId = await persistTurn(user.id, conversationId, data, result.caseFile, result);
    } catch {
      // الجداول قد تكون غير مُطبّقة على القاعدة بعد (migration بانتظار إذن).
    }
    // سجل التدقيق (AuditTrail) — يستفيد من البنية القائمة.
    try {
      await auditEvent({
        actorId: user.id,
        subject: "SIMULATION",
        action: "LEGAL_CHAT_TURN",
        entityId: conversationId ?? undefined,
        metadata: {
          mode: data.mode,
          searchStrength: data.searchStrength,
          requestedOutput: result.intent.requestedOutput,
          userRole: result.intent.userRole,
          understanding: result.intent.understanding,
          awaitingConfirmation: result.awaitingConfirmation,
          provider: result.provider,
        },
      });
    } catch {
      // تجاهل أخطاء التدقيق حتى لا تُعطّل التجربة.
    }
  }

  return NextResponse.json({ ok: true, conversationId, ...result });
}

/** حفظ الدورة (محادثة + رسالتان + تشغيل) best-effort. */
async function persistTurn(
  userId: string,
  conversationId: string | null,
  data: z.infer<typeof schema>,
  caseFile: SimulationCaseFile,
  result: Awaited<ReturnType<typeof runChatTurn>>
): Promise<string> {
  // أنشئ/حدّث ملف القضية.
  const simCase = await prisma.simulationCase.create({
    data: {
      title: caseFile.title.slice(0, 200),
      userId,
      userRole: caseFile.userRole,
      disputeType: caseFile.disputeType,
      trackType: caseFile.track,
      proceduralStage: caseFile.proceduralStage,
      status: caseFile.status,
      summary: caseFile.summary,
      claimValue: caseFile.claimValue,
      hasArbitrationClause: caseFile.hasArbitrationClause ?? undefined,
      facts: caseFile.facts as unknown as object,
      parties: caseFile.parties as unknown as object,
      evidence: caseFile.evidence as unknown as object,
    },
  });

  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.chatConversation.create({
      data: { title: caseFile.title.slice(0, 200), userId, caseId: simCase.id, mode: data.mode },
    });
    convId = conv.id;
  }

  await prisma.chatMessage.create({
    data: { conversationId: convId, role: "user", content: data.message, attachments: (data.attachments ?? []) as unknown as object },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: convId,
      role: "assistant",
      content: result.reply,
      extractedIntent: result.intent as unknown as object,
    },
  });

  await prisma.simulationRun.create({
    data: {
      caseId: simCase.id,
      userId,
      mode: data.mode,
      outputType: result.intent.requestedOutput,
      understoodRequest: result.intent as unknown as object,
      userApprovalStatus: result.awaitingConfirmation ? "PENDING" : data.approval ?? "AUTO",
      output: result.reply,
      confidence: result.intent.confidence,
    },
  });

  return convId;
}
