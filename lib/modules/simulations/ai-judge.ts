// القاضي التفاعليّ الذكيّ (المرحلة الأولى — الدماغ المؤصَّل).
// خلافًا لـ determineNextTurn الحتميّ (الذي يقرّر بعدّ المداخلات دون قراءة النصّ)، هذه الوحدة
// تقرأ آخر إفادةٍ من الخصم، تحلّلها وتكيّفها قانونيًّا، تقدّر البيّنة وفق نظام الإثبات وعبء
// الإثبات، ثمّ تقرّر إجرائيًّا: تُبقي الدور لطلب إيضاح/بيّنة إن كان المقدَّم غير واضح، أو تنتقل
// للمرحلة التالية، أو تعرض الصلح. هجين: الذكاء يقرّر، والحارس الحتميّ (det) يمنع أيّ ترتيبٍ باطل،
// وحارس التأريض يرفض أيّ رقم مادّة غير مسترجَع — وعند أيّ فشلٍ يسقط للحتميّ الآمن.
import type { SimulationMessage } from "@prisma/client";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { collectStrings } from "@/lib/modules/grounding/verify-guard";
import { groundForJudge, verifyJudgeGrounding, PROCEDURAL_DIGEST } from "./judicial-brain";
import { SESSION_MANAGEMENT_FORMULAS } from "./judicial-drafting";
import { resolveSpecializedAgent } from "./specialized-agents";
import type { ClaimData } from "./hakeem-judge";
import {
  allowedSpeakerLabel,
  disabledRolesFor,
  type AllowedSpeakerRole,
  type JudgeTurnResult
} from "./judge-engine";

const PARTY_ROLES = ["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"];

type AiAction =
  | "PROCEED"
  | "REQUEST_CLARIFICATION"
  | "REQUEST_EVIDENCE"
  | "OFFER_SETTLEMENT"
  | "FRAME_DISPUTE"
  | "DIRECT_OATH"
  | "APPOINT_EXPERT";

// خريطة القرار الإجرائيّ إلى مسمّاه القضائيّ (يُخزَّن ويُعرَض ككتلةٍ مميّزة عن الحكم).
const PROCEDURAL_DECISION_LABEL: Record<string, string> = {
  FRAME_DISPUTE: "حصر محل النزاع",
  DIRECT_OATH: "توجيه اليمين الحاسمة",
  APPOINT_EXPERT: "ندب خبير"
};

type AiJudgeNarrative = {
  classification?: string;
  isClear?: boolean;
  clarificationRequest?: string;
  evidenceRequest?: string;
  evidenceAssessment?: string;
  recommendedAction?: AiAction;
  /** الطرف المُوجَّه إليه طلب الإيضاح/البيّنة (المدعي | المدعى عليه) — قد يخالف آخر متحدّث. */
  directedTo?: string;
  judgeMessage?: string;
  citations?: string[];
};

// يحدّد الطرف المُوجَّه إليه الطلب من نصّ القاضي؛ يسقط لآخر متحدّثٍ إن لم يُحدَّد أو التبس.
function resolveDirectedSide(directedTo: string | undefined, fallback: AllowedSpeakerRole): AllowedSpeakerRole {
  const t = (directedTo ?? "").trim();
  if (!t) return fallback;
  if (/عليه|مدّعى عليه|مدعى عليه|defendant/i.test(t)) return "defendant";
  if (/مدّعي|مدعي|claimant|plaintiff/i.test(t)) return "claimant";
  return fallback;
}

export type AiJudgeInput = {
  claim?: ClaimData;
  messages: Array<Pick<SimulationMessage, "role" | "content" | "stage" | "createdAt">>;
  /** الحارس الحتميّ: الظرف الإجرائيّ المشروع (من determineNextTurn). */
  det: JudgeTurnResult;
};

export type AiJudgeMeta = {
  mode: "ai";
  action: AiAction;
  classification: string;
  retrievedArticles: number;
  /** التخصّص المفعّل بناءً على نوع الدعوى (نطاق تأريض القاضي). */
  activatedAgent: string;
};

function lastPartyStatement(messages: AiJudgeInput["messages"]) {
  const visible = messages.filter((m) => !m.content.startsWith("HAKEEM_") && PARTY_ROLES.includes(m.role));
  return visible.length ? visible[visible.length - 1] : null;
}

function sideOf(role: string): AllowedSpeakerRole {
  return role === "المدعي" || role === "وكيل المدعي" ? "claimant" : "defendant";
}

function transcript(messages: AiJudgeInput["messages"], limit = 8) {
  return messages
    .filter((m) => !m.content.startsWith("HAKEEM_") && m.role !== "النظام")
    .slice(-limit)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
}

function extractJson(raw: string): AiJudgeNarrative | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as AiJudgeNarrative;
  } catch {
    return null;
  }
}

function buildSystemPrompt() {
  return [
    "أنت قاضٍ افتراضيّ تدريبيّ في منصّة حكيم، محايدٌ لا ينحاز لطرف.",
    "مهمّتك: اقرأ آخر مداخلةٍ من الخصم، وحلّلها وكيّفها قانونيًّا (طلب/دفع/بيّنة/إقرار/تعقيب)، وقدّر كفاية بيّنتها وعبء الإثبات وفق نظام الإثبات، ثمّ قرّر الإجراء التالي.",
    "",
    PROCEDURAL_DIGEST,
    "",
    SESSION_MANAGEMENT_FORMULAS,
    "",
    "قواعد صارمة:",
    "- لا تختلق مادّةً ولا رقم مادّة؛ لا تستشهد إلا بالمواد المسترجَعة المذكورة في «الأساس النظاميّ المتاح» أدناه.",
    "- إن كانت المداخلة غامضةً أو ناقصة، اطلب الإيضاح، وحدّد في directedTo الطرفَ المُلزَم بالإيضاح: فإن كان محلّ الاستفسار من شأن الطرف الآخر (كأن يسأل المدّعى عليه عن مستنداتٍ يملكها المدّعي) فوجِّه الطلب إلى ذلك الطرف لا إلى من تكلّم.",
    "- إن كان الادّعاء يفتقر إلى بيّنةٍ يوجب النظام تقديمها، اطلب البيّنة، وحدّد في directedTo مَن يقع عليه عبء تقديمها (المدعي غالبًا هو المكلَّف بإثبات دعواه).",
    "- لا تصدر حكمًا ولا تقفل باب المرافعة في هذا الرد؛ قرارك إجرائيٌّ فقط.",
    "القرارات الإجرائيّة المتاحة (استعملها بصياغتها القضائيّة في judgeMessage عند اقتضائها):",
    "- FRAME_DISPUTE (حصر محل النزاع): بعد سماع الدعوى والإجابة، إذا اتّضح محلّ النزاع فحرّره: «محلّ النزاع ينحصر في: هل (...) أم (...)؟».",
    "- DIRECT_OATH (توجيه اليمين الحاسمة): إذا عجز المدّعي عن البيّنة الموصلة وطلب يمين المدّعى عليه، فوجّهها بصيغة: «واللهِ العظيم إنّي (...)». قرارٌ إجرائيّ لا حكم.",
    "- APPOINT_EXPERT (ندب خبير): إذا توقّف الفصل على مسألةٍ فنّيّة، فاندب خبيرًا وحدّد مهمّته.",
    "أعِد الجواب بصيغة JSON فقط، بلا أيّ نصٍّ خارجها، بالمفاتيح:",
    '{"classification": "...", "isClear": true|false, "clarificationRequest": "...", "evidenceRequest": "...", "directedTo": "المدعي|المدعى عليه", "evidenceAssessment": "...", "recommendedAction": "PROCEED|REQUEST_CLARIFICATION|REQUEST_EVIDENCE|OFFER_SETTLEMENT|FRAME_DISPUTE|DIRECT_OATH|APPOINT_EXPERT", "judgeMessage": "...", "citations": ["نظام الإثبات المادة ..."]}',
    "directedTo (عند REQUEST_CLARIFICATION/REQUEST_EVIDENCE): الطرف المُلزَم بالردّ، ويجب أن يوافق خطابَك في judgeMessage — لا تجعل الدور لطرفٍ بينما توجّه الطلب لغيره.",
    "judgeMessage = خطاب القاضي المسبَّب بالعربية الفصحى (2-4 جمل). citations = أرقام موادّ من المتاح فقط."
  ].join("\n");
}

function buildUserPrompt(input: AiJudgeInput, statement: string, citationBlock: string) {
  const c = input.claim;
  const claimBlock = c
    ? [
        `الموضوع: ${c.subject ?? "غير محدد"}`,
        `الوقائع: ${c.facts ?? "غير محددة"}`,
        `الطلبات: ${c.requests ?? "غير محددة"}`,
        `الأساس النظاميّ الذي ذكره المدّعي: ${c.legalGrounds ?? "غير مذكور"}`
      ].join("\n")
    : "لم تُسجّل بيانات دعوى مبنيَنة.";
  return [
    "== بيانات الدعوى ==",
    claimBlock,
    "",
    "== محضر المرافعة (الأحدث) ==",
    transcript(input.messages),
    "",
    "== المداخلة محلّ التكييف الآن ==",
    statement,
    "",
    "== الظرف الإجرائيّ المشروع (لا تتجاوزه) ==",
    `الدور المسموح افتراضًا بعد هذه المداخلة: ${allowedSpeakerLabel(input.det.allowedSpeakerRole)}.`,
    `يجوز عرض الصلح الآن: ${input.det.canOfferSettlement ? "نعم" : "لا"}.`,
    "",
    "== الأساس النظاميّ المتاح (استشهد منه حصرًا) ==",
    citationBlock,
    "",
    "حلّل المداخلة وأصدر قرارك الإجرائيّ بصيغة JSON."
  ].join("\n");
}

function composeJudgeMessage(n: AiJudgeNarrative, fallbackText: string): string {
  const parts: string[] = [];
  parts.push((n.judgeMessage && n.judgeMessage.trim()) || fallbackText);
  if (n.classification) parts.push(`\nتكييف المداخلة: ${n.classification}.`);
  if (n.evidenceAssessment) parts.push(`تقدير البيّنة وعبء الإثبات: ${n.evidenceAssessment}`);
  if (n.citations && n.citations.length) parts.push(`الأساس النظاميّ: ${n.citations.join("، ")}`);
  return parts.join("\n");
}

/**
 * القرار الذكيّ الهجين. يعيد نتيجةً بشكل JudgeTurnResult (مطابقة للحتميّ) بعد المصالحة مع
 * الحارس، أو null عند أيّ فشل (فيسقط النداء إلى determineNextTurn).
 */
export async function decideJudgeTurnAI(
  input: AiJudgeInput
): Promise<{ result: JudgeTurnResult; meta: AiJudgeMeta } | null> {
  // لا يوجد ما يُحلَّل بعد (بداية الجلسة) → دَع الحتميّ يفتح ويمكّن المدّعي.
  const last = lastPartyStatement(input.messages);
  if (!last || input.det.canGenerateJudgment) return null;

  // تفعيل التخصّص حسب نوع الدعوى: يُقيَّد تأريض القاضي في أنظمة الوكيل المتخصّص المناسب.
  const agent = resolveSpecializedAgent(input.claim?.caseType);
  const grounding = await groundForJudge(
    [input.claim?.subject, input.claim?.facts, last.content].filter(Boolean).join(" "),
    6,
    agent.scopeSystems
  );

  const llm = await callCentralProvider({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input, last.content, grounding.citationBlock),
    maxTokens: 1400
  });
  if (!llm.ok || !llm.content.trim()) return null;

  const parsed = extractJson(llm.content);
  if (!parsed) return null;

  // حارس التأريض المشترك: أيّ رقم مادّة في مخرَج النموذج ليس ضمن المسترجَع ⇒ رفض والسقوط للحتميّ.
  if (!verifyJudgeGrounding(collectStrings(parsed), grounding.allowedNumbers)) return null;

  const action: AiAction = parsed.recommendedAction ?? "PROCEED";
  const side = sideOf(last.role);
  const det = input.det;
  const meta: AiJudgeMeta = {
    mode: "ai",
    action,
    classification: parsed.classification ?? "غير محدد",
    retrievedArticles: grounding.articleCount,
    activatedAgent: agent.label
  };

  // ── طلب إيضاح أو بيّنة: يُوجَّه الدور للطرف المُلزَم بالردّ (قد يكون غير آخر متحدّث) ──
  if (action === "REQUEST_CLARIFICATION" || action === "REQUEST_EVIDENCE") {
    const isClarify = action === "REQUEST_CLARIFICATION";
    // الطرف المُوجَّه إليه الطلب: من نصّ القاضي (directedTo)، وإلا فآخر متحدّث. يمنع تناقض
    // «الدور لطرفٍ والطلب موجَّهٌ لغيره».
    const target = resolveDirectedSide(parsed.directedTo, side);
    const ask =
      (isClarify ? parsed.clarificationRequest : parsed.evidenceRequest)?.trim() ||
      (isClarify ? "المطلوب إيضاح المداخلة وتحديد وجه الطلب." : "المطلوب تقديم البيّنة أو سند الإثبات.");
    const decisionType = isClarify ? "طلب إيضاح" : "طلب بيّنة";
    const result: JudgeTurnResult = {
      ...det,
      hearingStage: det.currentStage,
      currentTurn: allowedSpeakerLabel(target),
      nextRole: allowedSpeakerLabel(target),
      nextProceduralStep: isClarify ? `طلب إيضاح من ${allowedSpeakerLabel(target)} قبل الانتقال` : `طلب بيّنة/سند إثبات من ${allowedSpeakerLabel(target)}`,
      decisionType,
      decisionContent: ask,
      decisionReason: `تكييف المداخلة: ${meta.classification}.${parsed.evidenceAssessment ? " " + parsed.evidenceAssessment : ""}`,
      judgeMessage: composeJudgeMessage(parsed, ask),
      currentStage: det.currentStage,
      nextStage: det.currentStage,
      procedureAction: decisionType,
      allowedSpeakerRole: target,
      disabledRoles: disabledRolesFor(target),
      requiredInput: ask,
      reason: isClarify
        ? `المداخلة تستوجب إيضاحًا من ${allowedSpeakerLabel(target)} قبل الانتقال.`
        : `الفصل يتوقّف على بيّنةٍ يقع عبء تقديمها على ${allowedSpeakerLabel(target)}.`,
      canClosePleading: false,
      canGenerateJudgment: false
    };
    return { result, meta };
  }

  // ── قرارٌ إجرائيّ مميّز (حصر محل النزاع/توجيه اليمين/ندب خبير): يُسجَّل ككتلةٍ متمايزة عن
  // الحكم، مع الإبقاء على الترتيب المشروع من الحارس الحتميّ (لا ابتداعَ انتقالٍ باطل) ──
  if (action === "FRAME_DISPUTE" || action === "DIRECT_OATH" || action === "APPOINT_EXPERT") {
    const decisionType = PROCEDURAL_DECISION_LABEL[action];
    const body = (parsed.judgeMessage && parsed.judgeMessage.trim()) || det.judgeMessage;
    const result: JudgeTurnResult = {
      ...det,
      decisionType,
      decisionContent: body,
      decisionReason: `تكييف المداخلة: ${meta.classification}.${parsed.evidenceAssessment ? " " + parsed.evidenceAssessment : ""}`,
      procedureAction: decisionType,
      nextProceduralStep: decisionType,
      judgeMessage: composeJudgeMessage(parsed, det.judgeMessage)
    };
    return { result, meta };
  }

  // ── عرض الصلح: مسموحٌ فقط إن أجازه الحارس الحتميّ ──
  if (action === "OFFER_SETTLEMENT" && det.canOfferSettlement) {
    const result: JudgeTurnResult = {
      ...det,
      hearingStage: "SETTLEMENT",
      currentTurn: "القاضي الافتراضي",
      nextRole: "الطرفان",
      nextProceduralStep: "عرض الصلح على الطرفين",
      decisionType: "عرض الصلح",
      decisionContent: parsed.judgeMessage ?? "تعرض الدائرة الصلح على الطرفين.",
      decisionReason: parsed.evidenceAssessment ?? det.decisionReason,
      judgeMessage: composeJudgeMessage(parsed, det.judgeMessage),
      currentStage: det.currentStage,
      nextStage: "SETTLEMENT",
      procedureAction: "عرض الصلح",
      allowedSpeakerRole: "both",
      disabledRoles: disabledRolesFor("both"),
      requiredInput: "تلقّي موقف الطرفين من الصلح.",
      reason: "رأى القاضي عرض الصلح ملائمًا في هذه المرحلة.",
      canOfferSettlement: true
    };
    return { result, meta };
  }

  // ── PROCEED (وكذلك OFFER_SETTLEMENT غير المسموح): الترتيب الحتميّ المشروع، بخطابٍ مُثرًى ومكيَّف ──
  const result: JudgeTurnResult = {
    ...det,
    judgeMessage: composeJudgeMessage(parsed, det.judgeMessage),
    decisionReason: parsed.evidenceAssessment ? `${det.decisionReason} ${parsed.evidenceAssessment}` : det.decisionReason
  };
  return { result, meta: { ...meta, action: "PROCEED" } };
}
