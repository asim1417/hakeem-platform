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

// القرار الإجرائيّ مفتوحٌ غير محصور: PROCEDURAL_DECISION يحمل نوعًا ونصًّا يحدّدهما القاضي بحرّية
// بناءً على الفهم والتكييف وتنزيل الإفادة على الأنظمة والقواعد القضائيّة.
type AiAction =
  | "PROCEED"
  | "REQUEST_CLARIFICATION"
  | "REQUEST_EVIDENCE"
  | "OFFER_SETTLEMENT"
  | "PROCEDURAL_DECISION";

type AiJudgeNarrative = {
  classification?: string;
  isClear?: boolean;
  clarificationRequest?: string;
  evidenceRequest?: string;
  evidenceAssessment?: string;
  recommendedAction?: AiAction;
  /** الطرف المُوجَّه إليه طلب الإيضاح/البيّنة (المدعي | المدعى عليه) — قد يخالف آخر متحدّث. */
  directedTo?: string;
  /** القرار الإجرائيّ المفتوح: اسمه ونصّه ولمن ينتقل الدور بعده. */
  proceduralDecisionType?: string;
  proceduralDecisionText?: string;
  turnGoesTo?: string;
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

// لمن ينتقل الدور بعد قرارٍ إجرائيّ مفتوح — يقبل الطرفين معًا؛ يسقط للحتميّ عند الالتباس.
function resolveTurnGoesTo(turnGoesTo: string | undefined, fallback: AllowedSpeakerRole): AllowedSpeakerRole {
  const t = (turnGoesTo ?? "").trim();
  if (!t) return fallback;
  if (/الطرفان|الطرفين|كلا|both/i.test(t)) return "both";
  if (/عليه|defendant/i.test(t)) return "defendant";
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

// الطرف المقابل — تُستعمل في النقل التلقائيّ للدور (توجيه اليمين للخصم مثلًا).
function opposite(side: AllowedSpeakerRole): AllowedSpeakerRole {
  return side === "claimant" ? "defendant" : "claimant";
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
    "منهجك القضائيّ في كلّ دور بهذا الترتيب — لا تختصره في تفكيرك: (١) التصوّر: افهم إفادة الخصم/النصّ والوقائع فهمًا دقيقًا. (٢) التوصيف: صِفْ ما جرى ومحلّه. (٣) التكييف والتنزيل: كيّفه قانونيًّا (طلب/دفع شكليّ أو موضوعيّ/بيّنة/إقرار/إنكار/تعقيب/يمين...) ونزّله على الأنظمة والقواعد القضائيّة (الإثبات/المرافعات الشرعيّة/الإجراءات الجزائيّة/المحاكم التجاريّة) مؤصَّلًا بالمواد المتاحة. (٤) القرار: أصدر القرار الإجرائيّ المناسب. اعكس هذا الفهم في خطابك بصياغةٍ قضائيّة، دون إضعافه.",
    "",
    PROCEDURAL_DIGEST,
    "",
    SESSION_MANAGEMENT_FORMULAS,
    "",
    "== تكييف جواب المدّعى عليه (فلسفة الإجراءات) ==",
    "- صنّف الجواب: (إقرارٌ صريح ⇒ ثبتت الواقعة عليه)، (إنكارٌ مجرَّد ⇒ عبء الإثبات على المدّعي)، (جوابٌ عامّ لا يتضمّن إقرارًا ولا إنكارًا ولا دفعًا محرّرًا ⇒ اطلب تحرير الجواب)، (دفعٌ شكليّ ⇒ يُبتّ قبل الموضوع)، (تعقيب).",
    "- إشارة الاكتفاء: إذا قال الطرف «لا أضيف/اكتفيت/ليس لديّ ما أضيف» بعد نطق الطرفين ⇒ القضية مهيّأةٌ لقفل المرافعة، فلا تُعِد طلب ما سبق تقديمه.",
    "- السكوت أو التغيّب رغم التمكين لا يوقف السير؛ يُفهَم أثره وفق قواعد الإثبات، ولا يُعدّ إقرارًا بذاته.",
    "",
    "قواعد صارمة:",
    "- لا تختلق مادّةً ولا رقم مادّة؛ لا تستشهد إلا بالمواد المسترجَعة المذكورة في «الأساس النظاميّ المتاح» أدناه.",
    "- إن كانت المداخلة غامضةً أو ناقصة، اطلب الإيضاح (REQUEST_CLARIFICATION)، وحدّد في directedTo الطرفَ المُلزَم بالإيضاح ولو كان غير المتكلّم (كأن يسأل المدّعى عليه عن مستنداتٍ يملكها المدّعي).",
    "- إن لزمت بيّنةٌ يوجب النظام تقديمها، اطلبها (REQUEST_EVIDENCE) وحدّد في directedTo من يقع عليه عبؤها.",
    "- لا تصدر حكمًا نهائيًّا ولا تقفل باب المرافعة في هذا الرد.",
    "",
    "== القرار الإجرائيّ المفتوح (PROCEDURAL_DECISION) ==",
    "القرارات الإجرائيّة واسعةٌ غير محصورة؛ لا تُقيّد نفسك بقائمة. متى اقتضى تنزيلُ الإفادة على الأنظمة قرارًا إجرائيًّا، اضبط recommendedAction=PROCEDURAL_DECISION واملأ:",
    "- proceduralDecisionType: اسم القرار (مثالًا لا حصرًا: حصر محل النزاع، توجيه اليمين الحاسمة، ندب خبير، الإحالة لعدم الاختصاص، ضمّ الدعوى، وقفها تعليقيًّا، قبول دفعٍ شكليّ أو ردّه، الأمر بإحضار مستند، التصريح بسماع البيّنة/الشهود، الإمهال، طلب تحرير الجواب...).",
    "- proceduralDecisionText: نصّ القرار بالصيغة القضائيّة السعوديّة، مؤصَّلًا بالمواد المتاحة فقط، مبيّنًا سنده من تنزيل الإفادة على النظام.",
    "- turnGoesTo: لمن ينتقل الدور بعد القرار (المدعي | المدعى عليه | الطرفان). وفي توجيه اليمين ينتقل الدور لمن وُجّهت إليه ليؤدّيها أو ينكل.",
    "أعِد الجواب بصيغة JSON فقط، بلا أيّ نصٍّ خارجها، بالمفاتيح:",
    '{"classification": "...", "isClear": true|false, "clarificationRequest": "...", "evidenceRequest": "...", "directedTo": "المدعي|المدعى عليه", "evidenceAssessment": "...", "recommendedAction": "PROCEED|REQUEST_CLARIFICATION|REQUEST_EVIDENCE|OFFER_SETTLEMENT|PROCEDURAL_DECISION", "proceduralDecisionType": "...", "proceduralDecisionText": "...", "turnGoesTo": "المدعي|المدعى عليه|الطرفان", "judgeMessage": "...", "citations": ["نظام ... المادة ..."]}',
    "لا تجعل الدور لطرفٍ بينما توجّه الطلب/القرار لغيره؛ يجب توافق directedTo/turnGoesTo مع خطابك في judgeMessage.",
    "judgeMessage = خطابٌ قضائيٌّ سرديٌّ بصيغة الغائب يعكس فهمك (تصوّرًا فتوصيفًا فتكييفًا فقرارًا) بصياغةٍ سعوديّة سليمة، مثل: «وبعرض [المداخلة/صحيفة الدعوى] على [الطرف] أفاد بأنّ [ملخّصٌ دقيقٌ لما قاله]، وحيث إنّ [التكييف والتنزيل على النظام]؛ فقد قرّرت الدائرة [القرار الإجرائيّ]».",
    "  الطول بحسب الحال: واضحٌ موجزٌ يفي بالمقام — يُوجَز في المسألة البسيطة، ويُفصَّل بقدرٍ في المركّبة، دون تطويلٍ ممل ولا تقصيرٍ مخلّ.",
    "  تجنّب الحشو والتكرار، والعناوين والقوائم وأرقام المواد داخله (تظهر في شريط الشفافيّة ولوحة الأساس النظاميّ). اجعله نصًّا قضائيًّا متّصلًا لا نقاطًا.",
    "citations = أرقام موادّ من المتاح فقط (تُستعمل للتأريض والتحقّق، لا تُكتب داخل judgeMessage)."
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

// خطاب القاضي = فقرةٌ قضائيّة سرديّة موجزة فقط. لا تُلحَق عناوين (تكييف/تقدير/أساس) داخله —
// فالتكييف يظهر في شريط الشفافيّة، والمواد في لوحة الأساس النظاميّ. (يمنع الطول والتكرار.)
function composeJudgeMessage(n: AiJudgeNarrative, fallbackText: string): string {
  return (n.judgeMessage && n.judgeMessage.trim()) || fallbackText;
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
  // ── قرارٌ إجرائيٌّ مفتوح: نوعُه ونصّه يحدّدهما القاضي بناءً على تنزيل الإفادة على الأنظمة،
  // ويُنقَل الدور تلقائيًّا بحسب turnGoesTo (وفي اليمين لمن وُجّهت إليه). يُسجَّل ككتلةٍ مميّزة ──
  if (action === "PROCEDURAL_DECISION") {
    const decisionType = (parsed.proceduralDecisionType || "").trim() || "قرارٌ إجرائيّ";
    const body = (parsed.proceduralDecisionText || parsed.judgeMessage || det.judgeMessage || "").trim();
    const isOath = /يمين/.test(decisionType) || /يمين/.test(body);
    // نقلٌ تلقائيّ للدور: يمينٌ ⇒ الطرف المُوجَّهة إليه؛ وإلا ما حدّده turnGoesTo؛ وإلا الحتميّ.
    const target = isOath
      ? resolveDirectedSide(parsed.directedTo, opposite(side))
      : resolveTurnGoesTo(parsed.turnGoesTo, det.allowedSpeakerRole);
    const result: JudgeTurnResult = {
      ...det,
      decisionType,
      decisionContent: body,
      decisionReason: `تكييف المداخلة: ${meta.classification}؛ تنزيلٌ على الأنظمة والقواعد القضائيّة.${parsed.evidenceAssessment ? " " + parsed.evidenceAssessment : ""}`,
      procedureAction: decisionType,
      nextProceduralStep: decisionType,
      judgeMessage: composeJudgeMessage(parsed, body || det.judgeMessage),
      currentTurn: allowedSpeakerLabel(target),
      nextRole: allowedSpeakerLabel(target),
      allowedSpeakerRole: target,
      disabledRoles: disabledRolesFor(target),
      requiredInput: isOath ? `أداء اليمين الحاسمة أو النكول عنها من ${allowedSpeakerLabel(target)}.` : body || det.requiredInput,
      reason: `قرارٌ إجرائيّ مؤصَّل (${decisionType})؛ نُقل الدور تلقائيًّا إلى ${allowedSpeakerLabel(target)}.`,
      canClosePleading: false,
      canGenerateJudgment: false
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
