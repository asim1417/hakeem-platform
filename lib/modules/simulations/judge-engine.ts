import type { SimulationDecision, SimulationMessage, SimulationStage } from "@prisma/client";
import type { ClaimData } from "./hakeem-judge";

const partyRoles = ["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"];

export type JudgeTurnInput = {
  claim?: ClaimData;
  messages: Array<Pick<SimulationMessage, "role" | "content" | "stage" | "createdAt">>;
  decisions: Array<Pick<SimulationDecision, "decisionType" | "content" | "stage" | "createdAt">>;
  attachmentsCount?: number;
};

export type JudgeTurnResult = {
  hearingStage: SimulationStage;
  currentTurn: string;
  nextProceduralStep: string;
  judgeMessage: string;
  decisionType?: string;
  decisionContent?: string;
  availableActions: string[];
  canClosePleading: boolean;
  canGenerateJudgment: boolean;
};

export function isPleadingClosed(decisions: Array<Pick<SimulationDecision, "decisionType" | "content">>) {
  return decisions.some((decision) => `${decision.decisionType} ${decision.content}`.includes("قفل باب المرافعة"));
}

export function determineNextTurn(input: JudgeTurnInput): JudgeTurnResult {
  const visibleMessages = input.messages.filter((message) => !message.content.startsWith("HAKEEM_"));
  const partyMessages = visibleMessages.filter((message) => partyRoles.includes(message.role));
  const lastParty = [...partyMessages].reverse()[0];
  const closed = isPleadingClosed(input.decisions);
  const hasEvidence = Boolean(input.attachmentsCount && input.attachmentsCount > 0);
  const hasPlaintiff = partyMessages.some((message) => message.role.includes("المدعي") && !message.role.includes("المدعى عليه"));
  const hasDefendant = partyMessages.some((message) => message.role.includes("المدعى عليه"));

  if (closed) {
    return {
      hearingStage: "TRAINING_JUDGMENT",
      currentTurn: "القاضي الافتراضي",
      nextProceduralStep: "إصدار مسودة حكم قضائي مسبب",
      judgeMessage: "ثبت قفل باب المرافعة في هذه المحاكاة. يمكن الآن إصدار مسودة حكم قضائي مسبب مع التنبيه النظامي بأنها مسودة تدريبية لا تمثل حكمًا قضائيًا فعليًا.",
      availableActions: ["إصدار مسودة حكم قضائي مسبب", "تصدير ضبط الجلسة", "تصدير تقرير الجلسة"],
      canClosePleading: false,
      canGenerateJudgment: true
    };
  }

  if (!hasPlaintiff) {
    return {
      hearingStage: "PLAINTIFF_STATEMENT",
      currentTurn: "المدعي",
      nextProceduralStep: "تمكين المدعي من تحرير دعواه وطلباته",
      decisionType: "تمكين المدعي من عرض الدعوى",
      decisionContent: "قررت الدائرة الافتراضية تمكين المدعي من عرض دعواه وبيان الوقائع والطلبات على وجه محدد.",
      judgeMessage: "تفتتح الجلسة، ويطلب من المدعي بيان دعواه وطلباته وسنده في المطالبة، مع إرفاق ما لديه من بينات إن وجدت.",
      availableActions: ["إدخال مداخلة المدعي", "طلب مستند", "ضبط الجلسة"],
      canClosePleading: false,
      canGenerateJudgment: false
    };
  }

  if (!hasDefendant || lastParty?.role === "المدعي" || lastParty?.role === "وكيل المدعي") {
    return {
      hearingStage: "DEFENDANT_RESPONSE",
      currentTurn: "المدعى عليه",
      nextProceduralStep: "تمكين المدعى عليه من الجواب",
      decisionType: "تمكين المدعى عليه من الجواب",
      decisionContent: "قررت الدائرة الافتراضية تمكين المدعى عليه من الجواب على الدعوى والطلبات وما قدم من بينات.",
      judgeMessage: "بعد سماع دعوى المدعي، يطلب من المدعى عليه تقديم جوابه التفصيلي على الوقائع والطلبات، وبيان ما لديه من دفوع أو مستندات.",
      availableActions: ["إدخال جواب المدعى عليه", "طلب مستند", "عرض الصلح"],
      canClosePleading: false,
      canGenerateJudgment: false
    };
  }

  if (partyMessages.length < 4) {
    return {
      hearingStage: "PLAINTIFF_STATEMENT",
      currentTurn: "المدعي",
      nextProceduralStep: "تمكين المدعي من التعقيب",
      decisionType: "تمكين المدعي من الرد",
      decisionContent: "قررت الدائرة الافتراضية تمكين المدعي من التعقيب على جواب المدعى عليه.",
      judgeMessage: "بعد جواب المدعى عليه، يمنح المدعي فرصة للتعقيب على الدفوع وتوضيح أثرها في طلباته.",
      availableActions: ["تعقيب المدعي", "طلب إيضاح", "عرض الصلح"],
      canClosePleading: false,
      canGenerateJudgment: false
    };
  }

  return {
    hearingStage: hasEvidence ? "PROCEDURAL_DECISION" : "SETTLEMENT",
    currentTurn: "القاضي الافتراضي",
    nextProceduralStep: hasEvidence ? "تقدير كفاية البينات ثم قفل باب المرافعة" : "عرض الصلح أو طلب مستندات إضافية",
    decisionType: hasEvidence ? "تقدير كفاية البينات" : "عرض الصلح",
    decisionContent: hasEvidence
      ? "ترى الدائرة الافتراضية أن ملف المحاكاة يتضمن مرافعات وبينات أولية تكفي للانتقال إلى قفل باب المرافعة عند جاهزية الأطراف."
      : "تعرض الدائرة الافتراضية الصلح على الأطراف، ومع عدم الاتفاق يمكن طلب مستند أو قفل باب المرافعة إذا اكتملت المرافعات.",
    judgeMessage: hasEvidence
      ? "اكتملت مداخلات أساسية وظهرت بينات في الملف. يمكن طلب إيضاح أخير أو قفل باب المرافعة تمهيدًا لمسودة الحكم."
      : "اكتملت المرافعات الأساسية دون مرفقات ظاهرة. يوصى بعرض الصلح أو طلب مستند مؤيد قبل قفل باب المرافعة.",
    availableActions: ["قفل باب المرافعة", "عرض الصلح", "طلب مستند", "طلب إيضاح"],
    canClosePleading: true,
    canGenerateJudgment: false
  };
}

export function callJudge(input: JudgeTurnInput) {
  return determineNextTurn(input);
}
