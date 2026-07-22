import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { nextStageForRole } from "@/lib/modules/simulations/simulation-labels";
import {
  encodeTurnState,
  extractTurnState,
  isPleadingClosed,
  isRoleAllowedToSpeak,
  roleToAllowedSpeaker,
  turnMessageForBlockedRole,
  type TurnState
} from "@/lib/modules/simulations/judge-engine";

export const dynamic = "force-dynamic";

const allowedRoles = ["القاضي الافتراضي", "المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه", "النظام"] as const;

const messageSchema = z.object({
  role: z.enum(allowedRoles),
  content: z.string().min(2, "نص الرسالة مطلوب.")
});

function lockedTurn(stage: ReturnType<typeof nextStageForRole>, previous: TurnState | null): TurnState {
  return {
    allowedSpeakerRole: "judge",
    disabledRoles: ["claimant", "claimant_agent", "defendant", "defendant_agent"],
    requiredInput: "انتظار قرار القاضي الافتراضي لتحديد الطرف الممكّن من الكلام.",
    procedureAction: "انتظار قرار القاضي",
    currentStage: stage,
    nextStage: stage,
    reason: previous ? `انتهت مداخلة الدور المسموح (${previous.allowedSpeakerRole}) ويجب أن يحدد القاضي الدور التالي.` : "تمت إضافة مداخلة، ويلزم قرار القاضي لتحديد الدور التالي."
  };
}

function closedTurn(stage: ReturnType<typeof nextStageForRole>): TurnState {
  return {
    allowedSpeakerRole: "none",
    disabledRoles: ["claimant", "claimant_agent", "defendant", "defendant_agent"],
    requiredInput: "تم قفل باب المرافعة.",
    procedureAction: "قفل باب المرافعة",
    currentStage: stage,
    nextStage: "TRAINING_JUDGMENT",
    reason: "لا تقبل مداخلات جديدة بعد قفل باب المرافعة."
  };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const session = await findOwnedSimulation(gate.user!, params.id, {
    messages: { orderBy: { createdAt: "asc" } },
    decisions: { orderBy: { createdAt: "asc" } },
    judgments: { orderBy: { createdAt: "asc" } }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  return NextResponse.json({ session, turnState: extractTurnState(session.messages) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = messageSchema.parse(await request.json());
  const user = gate.user!;
  const stage = nextStageForRole(payload.role);
  const session = await findOwnedSimulation(user, params.id, {
    messages: { orderBy: { createdAt: "asc" } },
    decisions: { orderBy: { createdAt: "asc" } }
  });

  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });

  const previousTurn = isPleadingClosed(session.decisions) ? closedTurn(stage) : extractTurnState(session.messages);
  if (!isRoleAllowedToSpeak(payload.role, previousTurn)) {
    await auditEvent({
      actorId: user.id,
      subject: "SIMULATION",
      action: "SIMULATION_MESSAGE_REJECTED_BY_TURN",
      entityId: params.id,
      metadata: {
        senderRole: payload.role,
        senderSpeakerRole: roleToAllowedSpeaker(payload.role),
        allowedSpeakerRole: previousTurn?.allowedSpeakerRole,
        procedureAction: previousTurn?.procedureAction,
        currentStage: previousTurn?.currentStage,
        nextStage: previousTurn?.nextStage
      }
    }).catch(() => undefined);

    return NextResponse.json({ message: "ليس لهذا الدور حق الإدخال في المرحلة الحالية.", detail: turnMessageForBlockedRole(previousTurn), turnState: previousTurn }, { status: 403 });
  }

  const nextTurn = roleToAllowedSpeaker(payload.role) === "system" || roleToAllowedSpeaker(payload.role) === "judge" ? previousTurn : lockedTurn(stage, previousTurn);
  const message = await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: payload.role,
      stage,
      content: payload.content
    }
  });

  if (nextTurn) {
    await prisma.simulationMessage.create({
      data: {
        simulationId: params.id,
        role: "النظام",
        stage,
        content: encodeTurnState(nextTurn)
      }
    });
  }

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_MESSAGE_CREATED",
    entityId: params.id,
    metadata: {
      role: payload.role,
      stage,
      description: "تمت إضافة مداخلة إلى جلسة المحاكاة.",
      previousAllowedRole: previousTurn?.allowedSpeakerRole,
      nextAllowedRole: nextTurn?.allowedSpeakerRole,
      procedureAction: nextTurn?.procedureAction,
      currentStage: previousTurn?.currentStage,
      nextStage: nextTurn?.nextStage
    }
  });

  return NextResponse.json({ message, turnState: nextTurn }, { status: 201 });
}
