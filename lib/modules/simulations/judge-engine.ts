import type { SimulationDecision, SimulationMessage, SimulationStage } from "@prisma/client";
import type { ClaimData } from "./hakeem-judge";

const partyRoles = ["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"];
export const turnMarker = "HAKEEM_TURN::";

export type AllowedSpeakerRole = "claimant" | "defendant" | "claimant_agent" | "defendant_agent" | "judge" | "both" | "none" | "system";

export type TurnState = {
  allowedSpeakerRole: AllowedSpeakerRole;
  disabledRoles: AllowedSpeakerRole[];
  requiredInput: string;
  procedureAction: string;
  currentStage: SimulationStage;
  nextStage: SimulationStage;
  reason: string;
};

export type JudgeTurnInput = {
  claim?: ClaimData;
  messages: Array<Pick<SimulationMessage, "role" | "content" | "stage" | "createdAt">>;
  decisions: Array<Pick<SimulationDecision, "decisionType" | "content" | "stage" | "createdAt">>;
  attachmentsCount?: number;
};

export type JudgeTurnResult = {
  hearingStage: SimulationStage;
  currentTurn: string;
  nextRole: string;
  nextProceduralStep: string;
  judgeMessage: string;
  decisionType?: string;
  decisionContent?: string;
  decisionReason: string;
  currentStage: SimulationStage;
  nextStage: SimulationStage;
  procedureAction: string;
  allowedSpeakerRole: AllowedSpeakerRole;
  disabledRoles: AllowedSpeakerRole[];
  requiredInput: string;
  reason: string;
  needsDocument: boolean;
  needsPlaintiffReply: boolean;
  needsDefendantAnswer: boolean;
  canOfferSettlement: boolean;
  availableActions: string[];
  canClosePleading: boolean;
  canGenerateJudgment: boolean;
};

export function isPleadingClosed(decisions: Array<Pick<SimulationDecision, "decisionType" | "content">>) {
  return decisions.some((decision) => `${decision.decisionType} ${decision.content}`.includes("قفل باب المرافعة"));
}

export function encodeTurnState(state: TurnState) {
  return `${turnMarker}${JSON.stringify(state)}`;
}

export function extractTurnState(messages?: Array<Pick<SimulationMessage, "content">>): TurnState | null {
  const source = [...(messages ?? [])].reverse().find((message) => message.content.startsWith(turnMarker));
  if (!source) return null;
  try {
    return JSON.parse(source.content.slice(turnMarker.length)) as TurnState;
  } catch {
    return null;
  }
}

export function roleToAllowedSpeaker(role: string): AllowedSpeakerRole {
  if (role === "المدعي") return "claimant";
  if (role === "وكيل المدعي") return "claimant_agent";
  if (role === "المدعى عليه") return "defendant";
  if (role === "وكيل المدعى عليه") return "defendant_agent";
  if (role === "القاضي الافتراضي") return "judge";
  return "system";
}

export function allowedSpeakerLabel(role: AllowedSpeakerRole) {
  const labels: Record<AllowedSpeakerRole, string> = {
    claimant: "المدعي",
    defendant: "المدعى عليه",
    claimant_agent: "وكيل المدعي",
    defendant_agent: "وكيل المدعى عليه",
    judge: "القاضي الافتراضي",
    both: "الطرفان",
    none: "لا أحد",
    system: "النظام"
  };
  return labels[role];
}

export function disabledRolesFor(allowedSpeakerRole: AllowedSpeakerRole): AllowedSpeakerRole[] {
  const parties: AllowedSpeakerRole[] = ["claimant", "claimant_agent", "defendant", "defendant_agent"];
  if (allowedSpeakerRole === "both") return [];
  if (allowedSpeakerRole === "none" || allowedSpeakerRole === "judge" || allowedSpeakerRole === "system") return parties;
  if (allowedSpeakerRole === "claimant" || allowedSpeakerRole === "claimant_agent") return ["defendant", "defendant_agent"];
  if (allowedSpeakerRole === "defendant" || allowedSpeakerRole === "defendant_agent") return ["claimant", "claimant_agent"];
  return parties;
}

export function isRoleAllowedToSpeak(senderRole: string, turn: TurnState | null) {
  const speaker = roleToAllowedSpeaker(senderRole);
  if (speaker === "system" || speaker === "judge") return true;
  if (!turn) return true;
  if (turn.allowedSpeakerRole === "both") return ["claimant", "claimant_agent", "defendant", "defendant_agent"].includes(speaker);
  if (turn.allowedSpeakerRole === "none" || turn.allowedSpeakerRole === "judge" || turn.allowedSpeakerRole === "system") return false;
  if (turn.allowedSpeakerRole === "claimant") return speaker === "claimant" || speaker === "claimant_agent";
  if (turn.allowedSpeakerRole === "defendant") return speaker === "defendant" || speaker === "defendant_agent";
  return speaker === turn.allowedSpeakerRole;
}

export function turnMessageForBlockedRole(turn: TurnState | null) {
  if (!turn) return "ليس لهذا الدور حق الإدخال في المرحلة الحالية.";
  if (turn.allowedSpeakerRole === "none") return "تم قفل باب المرافعة، ولا يمكن إضافة مداخلات جديدة.";
  if (turn.allowedSpeakerRole === "defendant") return "الدور الحالي للمدعى عليه، ولا يمكنك الإدخال حتى يصدر القاضي قرارًا بتمكينك من الكلام.";
  if (turn.allowedSpeakerRole === "claimant") return "الدور الحالي للمدعي، ولا يمكنك الإدخال في هذه المرحلة.";
  if (turn.allowedSpeakerRole === "both") return "يسمح للطرفين بالإدخال في هذه المرحلة.";
  return `ليس لهذا الدور حق الإدخال في المرحلة الحالية. الدور المسموح: ${allowedSpeakerLabel(turn.allowedSpeakerRole)}.`;
}

export function turnForDecision(decisionType: string, stage: SimulationStage): TurnState {
  let allowedSpeakerRole: AllowedSpeakerRole = "judge";
  let requiredInput = "انتظار قرار إجرائي تال من القاضي.";
  let nextStage = stage;

  if (decisionType.includes("قفل")) {
    allowedSpeakerRole = "none";
    requiredInput = "تم قفل باب المرافعة ولا تقبل مداخلات جديدة.";
    nextStage = "CLOSE_PLEADING";
  } else if (decisionType.includes("المدعى عليه") || decisionType.includes("مستند من المدعى عليه")) {
    allowedSpeakerRole = "defendant";
    requiredInput = decisionType.includes("مستند") ? "تقديم المستند المطلوب أو بيان عدم وجوده." : "تقديم الجواب على الدعوى.";
    nextStage = "DEFENDANT_RESPONSE";
  } else if (decisionType.includes("المدعي") || decisionType.includes("بينة")) {
    allowedSpeakerRole = "claimant";
    requiredInput = decisionType.includes("بينة") || decisionType.includes("مستند") ? "تقديم البينة أو وصفها أو إرفاقها." : "تقديم تعقيب المدعي.";
    nextStage = "PLAINTIFF_STATEMENT";
  } else if (decisionType.includes("صلح")) {
    allowedSpeakerRole = "both";
    requiredInput = "تلقي موقف الطرفين من الصلح.";
    nextStage = "SETTLEMENT";
  } else if (decisionType.includes("فتح")) {
    allowedSpeakerRole = "claimant";
    requiredInput = "تقديم مداخلة المدعي الافتتاحية.";
    nextStage = "PLAINTIFF_STATEMENT";
  }

  return {
    allowedSpeakerRole,
    disabledRoles: disabledRolesFor(allowedSpeakerRole),
    requiredInput,
    procedureAction: decisionType,
    currentStage: stage,
    nextStage,
    reason: "تم تحديد الدور بناءً على القرار الإجرائي."
  };
}

function buildResult(
  base: Omit<JudgeTurnResult, "currentStage" | "nextStage" | "procedureAction" | "allowedSpeakerRole" | "disabledRoles" | "requiredInput" | "reason">,
  turn: Omit<TurnState, "disabledRoles">
): JudgeTurnResult {
  return {
    ...base,
    currentStage: turn.currentStage,
    nextStage: turn.nextStage,
    procedureAction: turn.procedureAction,
    allowedSpeakerRole: turn.allowedSpeakerRole,
    disabledRoles: disabledRolesFor(turn.allowedSpeakerRole),
    requiredInput: turn.requiredInput,
    reason: turn.reason
  };
}

export function determineNextTurn(input: JudgeTurnInput): JudgeTurnResult {
  const visibleMessages = input.messages.filter((message) => !message.content.startsWith("HAKEEM_"));
  const partyMessages = visibleMessages.filter((message) => partyRoles.includes(message.role));
  const lastParty = [...partyMessages].reverse()[0];
  const closed = isPleadingClosed(input.decisions);
  const hasEvidence = Boolean(input.attachmentsCount && input.attachmentsCount > 0);
  const hasPlaintiff = partyMessages.some((message) => message.role === "المدعي" || message.role === "وكيل المدعي");
  const hasDefendant = partyMessages.some((message) => message.role === "المدعى عليه" || message.role === "وكيل المدعى عليه");

  if (closed) {
    return buildResult(
      {
        hearingStage: "TRAINING_JUDGMENT",
        currentTurn: "القاضي الافتراضي",
        nextRole: "القاضي الافتراضي",
        nextProceduralStep: "إصدار مسودة حكم قضائي مسبب",
        judgeMessage: "ثبت قفل باب المرافعة في هذه المحاكاة. يمكن الآن إصدار مسودة حكم قضائي مسبب، ولا يجوز لأي طرف إضافة مداخلة جديدة.",
        decisionReason: "قفل باب المرافعة يمنع إدخال مرافعات جديدة ويفتح مرحلة إعداد المسودة.",
        needsDocument: false,
        needsPlaintiffReply: false,
        needsDefendantAnswer: false,
        canOfferSettlement: false,
        availableActions: ["إصدار مسودة حكم قضائي مسبب", "تصدير ضبط الجلسة", "تصدير تقرير الجلسة"],
        canClosePleading: false,
        canGenerateJudgment: true
      },
      {
        currentStage: "CLOSE_PLEADING",
        nextStage: "TRAINING_JUDGMENT",
        procedureAction: "قفل باب المرافعة",
        allowedSpeakerRole: "none",
        requiredInput: "لا توجد مداخلات بعد قفل باب المرافعة.",
        reason: "تم قفل باب المرافعة، وانتهى حق الأطراف في الكلام."
      }
    );
  }

  if (!hasPlaintiff) {
    return buildResult(
      {
        hearingStage: "PLAINTIFF_STATEMENT",
        currentTurn: "المدعي",
        nextRole: "المدعي",
        nextProceduralStep: "تمكين المدعي من عرض الدعوى",
        decisionType: "تمكين المدعي من عرض الدعوى",
        decisionContent: "قررت الدائرة الافتراضية تمكين المدعي من عرض دعواه وبيان الوقائع والطلبات على وجه محدد.",
        decisionReason: "لم تسجل مداخلة افتتاحية من المدعي، ولا تستقيم المواجهة القضائية قبل سماع الدعوى.",
        judgeMessage: "قررت الدائرة الافتراضية تمكين المدعي من عرض دعواه، وعلى المدعي بيان الوقائع والطلبات وسنده في المطالبة، مع إرفاق ما لديه من بينات إن وجدت.",
        needsDocument: true,
        needsPlaintiffReply: true,
        needsDefendantAnswer: false,
        canOfferSettlement: false,
        availableActions: ["إدخال مداخلة المدعي", "طلب مستند", "ضبط الجلسة"],
        canClosePleading: false,
        canGenerateJudgment: false
      },
      {
        currentStage: "HEARING_RECORD",
        nextStage: "PLAINTIFF_STATEMENT",
        procedureAction: "تمكين المدعي من عرض الدعوى",
        allowedSpeakerRole: "claimant",
        requiredInput: "بيان المدعي لدعواه ووقائعها وطلباته.",
        reason: "لم تسجل مداخلة من المدعي."
      }
    );
  }

  if (!hasDefendant || lastParty?.role === "المدعي" || lastParty?.role === "وكيل المدعي") {
    return buildResult(
      {
        hearingStage: "DEFENDANT_RESPONSE",
        currentTurn: "المدعى عليه",
        nextRole: "المدعى عليه",
        nextProceduralStep: "تمكين المدعى عليه من الجواب",
        decisionType: "تمكين المدعى عليه من الجواب",
        decisionContent: "قررت الدائرة الافتراضية تمكين المدعى عليه من الجواب على الدعوى والطلبات وما قدم من بينات.",
        decisionReason: "بعد عرض الدعوى يجب تمكين المدعى عليه من الجواب تحقيقًا لمبدأ المواجهة.",
        judgeMessage: "قررت الدائرة الافتراضية تمكين المدعى عليه من الجواب على الدعوى، وعلى المدعى عليه بيان موقفه من الوقائع والطلبات والمستندات المقدمة.",
        needsDocument: !hasEvidence,
        needsPlaintiffReply: false,
        needsDefendantAnswer: true,
        canOfferSettlement: true,
        availableActions: ["إدخال جواب المدعى عليه", "طلب مستند من المدعى عليه", "عرض الصلح"],
        canClosePleading: false,
        canGenerateJudgment: false
      },
      {
        currentStage: "PLAINTIFF_STATEMENT",
        nextStage: "DEFENDANT_RESPONSE",
        procedureAction: "تمكين المدعى عليه من الجواب",
        allowedSpeakerRole: "defendant",
        requiredInput: "بيان موقف المدعى عليه من الوقائع والطلبات والمستندات.",
        reason: "بعد مداخلة المدعي يلزم تمكين المدعى عليه من الجواب."
      }
    );
  }

  if (partyMessages.length < 4) {
    return buildResult(
      {
        hearingStage: "PLAINTIFF_STATEMENT",
        currentTurn: "المدعي",
        nextRole: "المدعي",
        nextProceduralStep: "تمكين المدعي من التعقيب",
        decisionType: "تمكين المدعي من التعقيب",
        decisionContent: "قررت الدائرة الافتراضية تمكين المدعي من التعقيب على جواب المدعى عليه.",
        decisionReason: "ورد جواب المدعى عليه، ومن الملائم تمكين المدعي من التعقيب على الدفوع الجوهرية.",
        judgeMessage: "قررت الدائرة الافتراضية تمكين المدعي من التعقيب على جواب المدعى عليه، وعلى المدعي توضيح أثر الدفوع في طلباته.",
        needsDocument: !hasEvidence,
        needsPlaintiffReply: true,
        needsDefendantAnswer: false,
        canOfferSettlement: true,
        availableActions: ["تعقيب المدعي", "طلب إيضاح", "عرض الصلح"],
        canClosePleading: false,
        canGenerateJudgment: false
      },
      {
        currentStage: "DEFENDANT_RESPONSE",
        nextStage: "PLAINTIFF_STATEMENT",
        procedureAction: "تمكين المدعي من التعقيب",
        allowedSpeakerRole: "claimant",
        requiredInput: "تقديم تعقيب المدعي على جواب المدعى عليه.",
        reason: "ورد جواب المدعى عليه، ويلزم تمكين المدعي من التعقيب."
      }
    );
  }

  return buildResult(
    {
      hearingStage: hasEvidence ? "PROCEDURAL_DECISION" : "SETTLEMENT",
      currentTurn: "القاضي الافتراضي",
      nextRole: "القاضي الافتراضي",
      nextProceduralStep: hasEvidence ? "تقدير كفاية البينات ثم قفل باب المرافعة" : "عرض الصلح أو طلب مستندات إضافية",
      decisionType: hasEvidence ? "تقدير كفاية البينات" : "عرض الصلح",
      decisionContent: hasEvidence
        ? "ترى الدائرة الافتراضية أن ملف المحاكاة يتضمن مرافعات وبينات أولية تكفي للانتقال إلى قفل باب المرافعة عند جاهزية الأطراف."
        : "تعرض الدائرة الافتراضية الصلح على الأطراف، ومع عدم الاتفاق يمكن طلب مستند أو قفل باب المرافعة إذا اكتملت المرافعات.",
      decisionReason: hasEvidence ? "تعددت مداخلات الخصوم وظهرت بينات أولية في الملف." : "اكتملت المرافعات الأساسية دون مرفق ظاهر، والصلح أو طلب المستند أولى قبل القفل.",
      judgeMessage: hasEvidence
        ? "اكتملت مداخلات أساسية وظهرت بينات في الملف. يمكن طلب إيضاح أخير أو قفل باب المرافعة تمهيدًا لمسودة الحكم."
        : "قررت الدائرة الافتراضية عرض الصلح على الطرفين، ولكل طرف بيان موقفه من الصلح قبل الانتقال إلى الإجراء التالي.",
      needsDocument: !hasEvidence,
      needsPlaintiffReply: false,
      needsDefendantAnswer: false,
      canOfferSettlement: true,
      availableActions: ["قفل باب المرافعة", "عرض الصلح", "طلب مستند", "طلب إيضاح"],
      canClosePleading: true,
      canGenerateJudgment: false
    },
    {
      currentStage: hasEvidence ? "PROCEDURAL_DECISION" : "SETTLEMENT",
      nextStage: hasEvidence ? "PROCEDURAL_DECISION" : "SETTLEMENT",
      procedureAction: hasEvidence ? "تقدير كفاية البينات" : "عرض الصلح",
      allowedSpeakerRole: hasEvidence ? "judge" : "both",
      requiredInput: hasEvidence ? "انتظار قرار القاضي بطلب إيضاح أو قفل باب المرافعة." : "تلقي موقف الطرفين من الصلح.",
      reason: hasEvidence ? "اكتملت مداخلات أساسية وظهرت بينات." : "اكتملت مرافعات أساسية ويمكن عرض الصلح على الطرفين."
    }
  );
}

export function callJudge(input: JudgeTurnInput) {
  return determineNextTurn(input);
}
