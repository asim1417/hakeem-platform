import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { callJudge, encodeTurnState, extractTurnState } from "@/lib/modules/simulations/judge-engine";
import { extractClaim, countEvidenceSignals } from "@/lib/modules/simulations/hakeem-judge";
import { decideJudgeTurnAI, type AiJudgeMeta } from "@/lib/modules/simulations/ai-judge";
import { guardAiService } from "@/lib/modules/billing/service-guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const session = await findOwnedSimulation(user, params.id, {
    messages: { orderBy: { createdAt: "asc" } },
    decisions: { orderBy: { createdAt: "asc" } }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  const guard = await guardAiService({ userId: user.id, serviceCode: "JUDGE_SIMULATION", rateLimit: { limit: 30, windowSec: 60 } });
  if (!guard.allowed) {
    return NextResponse.json({ message: guard.message, reason: guard.reason }, { status: guard.reason === "rate_limited" ? 429 : 402 });
  }

  try {
  const claim = extractClaim(session.messages);
  const previousTurn = extractTurnState(session.messages);

  // القرار الحتميّ = الحارس المشروع (الترتيب الإجرائيّ الإلزاميّ + السقوط الآمن).
  const det = callJudge({
    claim,
    messages: session.messages,
    decisions: session.decisions,
    // إشارة بيّنة مشتقّة من المداخلات والسند (بدل صفرٍ ثابت) — يفعّل فرع البيّنة/القرار الإجرائيّ.
    attachmentsCount: countEvidenceSignals(session.messages, claim)
  });

  // القاضي الذكيّ: يقرأ آخر إفادةٍ، يكيّفها، يقدّر البيّنة وفق نظام الإثبات، ثمّ يقرّر إجرائيًّا
  // ضمن الظرف المشروع (det). عند أيّ فشلٍ أو خروجٍ عن التأريض ⇒ يسقط للحتميّ.
  let result = det;
  let judgeMode: AiJudgeMeta | null = null;
  try {
    const ai = await decideJudgeTurnAI({ claim, messages: session.messages, det });
    if (ai) {
      result = ai.result;
      judgeMode = ai.meta;
    }
  } catch {
    result = det;
    judgeMode = null;
  }

  const judgeMessage = await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: "القاضي الافتراضي",
      stage: result.hearingStage,
      // خطاب القاضي فقط (فقرة قضائيّة موجزة)؛ الدور والمطلوب يظهران في شريط الدور بالواجهة،
      // فلا يُكرَّران هنا (يمنع الطول والتكرار).
      content: result.judgeMessage
    }
  });

  let decision = null;
  if (result.decisionType && !session.decisions.some((item) => item.decisionType === result.decisionType && item.stage === result.hearingStage)) {
    decision = await prisma.simulationDecision.create({
      data: {
        simulationId: params.id,
        stage: result.hearingStage,
        decisionType: result.decisionType,
        content: result.decisionContent ?? result.nextProceduralStep
      }
    });
  }

  const turnState = {
    allowedSpeakerRole: result.allowedSpeakerRole,
    disabledRoles: result.disabledRoles,
    requiredInput: result.requiredInput,
    procedureAction: result.procedureAction,
    currentStage: result.currentStage,
    nextStage: result.nextStage,
    reason: result.reason
  };

  const turnMessage = await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: "النظام",
      stage: result.hearingStage,
      content: encodeTurnState(turnState)
    }
  });

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage: result.hearingStage }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_JUDGE_TURN",
    entityId: params.id,
    metadata: {
      simulationId: params.id,
      previousAllowedRole: previousTurn?.allowedSpeakerRole,
      nextAllowedRole: result.allowedSpeakerRole,
      procedureAction: result.procedureAction,
      currentStage: result.currentStage,
      nextStage: result.nextStage,
      currentTurn: result.currentTurn,
      nextProceduralStep: result.nextProceduralStep,
      decisionType: result.decisionType,
      messageId: judgeMessage.id,
      turnMessageId: turnMessage.id,
      decisionId: decision?.id,
      judge: {
        mode: judgeMode ? "ai" : "deterministic",
        action: judgeMode?.action,
        classification: judgeMode?.classification,
        retrievedArticles: judgeMode?.retrievedArticles ?? 0,
        source: "legal_core.legal_articles"
      }
    }
  });

  // شفافيّة القرار للواجهة: وضع القاضي (ذكيّ/حتميّ) وتكييفه للمداخلة وإجراؤه.
  const judge = {
    mode: judgeMode ? "ai" : "deterministic",
    action: judgeMode?.action ?? null,
    classification: judgeMode?.classification ?? null,
    activatedAgent: judgeMode?.activatedAgent ?? null
  };

  await guard.settle();
  return NextResponse.json({ result, message: judgeMessage, decision, turnState, judge }, { status: 201 });
  } catch (e) {
    await guard.release();
    throw e;
  }
}
