import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { allowedSpeakerLabel, callJudge, encodeTurnState, extractTurnState } from "@/lib/modules/simulations/judge-engine";
import { extractClaim, countEvidenceSignals } from "@/lib/modules/simulations/hakeem-judge";
import { decideJudgeTurnAI, type AiJudgeMeta } from "@/lib/modules/simulations/ai-judge";

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
      content: [
        result.judgeMessage,
        "",
        `الطرف الممكّن من الكلام: ${allowedSpeakerLabel(result.allowedSpeakerRole)}.`,
        `المطلوب: ${result.requiredInput}`,
        `سبب القرار: ${result.reason}`
      ].join("\n")
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
    classification: judgeMode?.classification ?? null
  };

  return NextResponse.json({ result, message: judgeMessage, decision, turnState, judge }, { status: 201 });
}
