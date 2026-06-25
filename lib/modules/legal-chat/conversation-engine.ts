// ─────────────────────────────────────────────────────────────────────────────
// Hakeem Conversation Intelligence Engine (User Understanding & Dialogue Orchestrator).
// عقل الشات الأول: يفهم المستخدم ويدير الحوار قبل أي تحليل أو استرجاع أو صياغة.
// القاعدة: حكيم يفهم الإنسان أولاً، ثم المسألة، ثم يؤكد، ثم يسترجع، ثم يحلل، ثم يصوغ.
// «لا قضية = لا تحليل · لا مسألة = لا مصادر».
// حتمي بالكامل (يعمل دون اتصال) ويميّز التحية واللهجة ومستوى المستخدم.
// ─────────────────────────────────────────────────────────────────────────────
import type { IntentResult } from "./types";
import { normalizeArabic, hasAny } from "./taxonomy";

export type ConversationMessageType =
  | "greeting"
  | "greeting_with_request"
  | "non_legal_smalltalk"
  | "weak_legal_signal"
  | "legal_intent"
  | "ready_for_analysis";

/** مستويات الفهم التسعة (من تحية فقط إلى جاهز لمخرج نهائي). */
export type UnderstandingStage =
  | "GreetingOnly"
  | "NonLegalSmallTalk"
  | "WeakLegalSignal"
  | "ProbableLegalIntent"
  | "LegalMatterIdentified"
  | "CaseIntakeReady"
  | "AnalysisReady"
  | "DraftReady"
  | "FinalDraftReviewReady";

export type UserLevel = "layperson" | "legal_practitioner" | "unknown";
export type Dialect = "saudi" | "msa" | "mixed" | "unknown";
export type ToneNeeded = "warm" | "urgent" | "professional" | "reassuring";

/** حالة تجربة المحادثة (الشات أولًا، التقرير لاحقًا). */
export type ConversationStage =
  | "greeting"
  | "intake"
  | "clarifying"
  | "understanding_confirmation"
  | "analysis_ready"
  | "report_ready"
  | "report_shown"
  | "drafting";

export interface ConversationResult {
  messageType: ConversationMessageType;
  stage: UnderstandingStage;
  userLevel: UserLevel;
  dialect: Dialect;
  tone: ToneNeeded;
  normalizedMeaning: string;
  reply: string; // نص ردّ حكيم (لغة محادثة دافئة)
  nextQuestion: string;
  suggestedButtons: string[]; // كل زرّ هو نصّ يُرسَل عند الضغط
  /** هل يُسمح بتشغيل محركات التحليل/الاسترجاع/الصياغة؟ */
  runAnalysis: boolean;
  /** المحركات المسموح بها في هذه الدورة (حوكمة التدرّج). */
  allowedEngines: string[];
}

// ── قواميس الكشف ──
const GREETING_WORDS = [
  "السلام عليكم", "سلام عليكم", "السلام", "وعليكم السلام", "مرحبا", "مرحبًا", "اهلا", "أهلا", "هلا", "هلو",
  "صباح الخير", "مساء الخير", "صباح النور", "تحية طيبة", "يعطيك العافيه", "يعطيك العافية", "حياك", "حياكم",
];
const SMALLTALK_WORDS = ["كيف حالك", "كيفك", "شخبارك", "شلونك", "وش اخبارك", "شكرا", "مشكور", "تسلم", "جزاك الله", "الله يعطيك العافيه"];

// إشارات قانونية ضعيفة (تدلّ على وجود مسألة دون تحديدها).
const WEAK_LEGAL_WORDS = [
  "مشكله", "مشكلة", "قضيه", "قضية", "نزاع", "خصم", "خصمي", "الطرف الثاني", "شركه", "شركة", "محكمه", "محكمة",
  "ناجز", "تبليغ", "مطالبه", "مطالبة", "فلوس", "حقي", "ضدي", "علي دعوى", "رفع علي", "وش اسوي", "وش اعمل",
  "ما ادري", "محتار", "موقفي", "مقاول", "الشغل", "ما خلص", "ماخلص", "ما سلم", "ما سلمني", "عقد", "عقدي",
  "فاتوره", "فاتورة", "تحويلات", "ايصال", "ايصالات", "واتساب", "مراسلات", "اتصالح", "اتفق معه", "ما سدد",
];

// مصطلحات تدلّ على مستخدم ممارس/محامٍ.
const PRACTITIONER_TERMS = [
  "مذكره جوابيه", "مذكرة جوابية", "دفوع", "دفع شكلي", "دفع موضوعي", "الاختصاص", "تسبيب", "خطه اثبات", "خطة إثبات",
  "لائحه اعتراضيه", "لائحة اعتراضية", "نقض", "تمييز", "التماس اعاده النظر", "وكيل المدعي", "وكيل المدعى عليه",
  "ماده نظاميه", "مادة", "بينه", "بيّنة", "صحيفه الدعوى", "منطوق الحكم", "حيثيات", "الدائره", "عبء الاثبات",
];

// إشارات اللهجة السعودية العامية.
const SAUDI_DIALECT_MARKERS = ["ابغى", "أبغى", "ابي", "أبي", "وش", "جاني", "جاtني", "ودي", "عندي", "يبي", "يبغى", "ماخلص", "ما خلص", "سددت", "تطالبني", "رافع علي", "ليش", "كذا", "بكره", "بغيت"];

// إشارات القلق/الاستعجال.
const URGENCY_MARKERS = ["متوتر", "خايف", "اخاف", "أخاف", "قلقان", "بكره", "بكرة", "غدا", "غدًا", "مستعجل", "ضروري", "يفوتني", "مهله", "مهلة", "الموعد", "جلسه بكره", "جلسة بكرة"];

// إشارة وجود حكم (تحوّل للمسار الاعتراضي).
const JUDGMENT_MARKERS = ["صدر ضدي", "صدر علي", "صدر حكم", "حكم ضدي", "حكم علي", "صدر بحقي"];

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** يزيل عبارات التحية من بداية الرسالة ويعيد ما تبقّى. */
function stripGreeting(message: string): { hadGreeting: boolean; remainder: string } {
  let text = message.trim();
  let hadGreeting = false;
  const norm = normalizeArabic(text);
  for (const g of GREETING_WORDS) {
    if (norm.startsWith(normalizeArabic(g)) || norm === normalizeArabic(g)) {
      hadGreeting = true;
      break;
    }
  }
  if (hadGreeting) {
    // احذف أول عبارة تحية مطابقة (تقريبياً) من النص الأصلي.
    const re = /^(?:و?عليكم\s+السلام(?:\s+ورحمة\s+الله(?:\s+وبركاته)?)?|السلام\s+عليكم(?:\s+ورحمة\s+الله(?:\s+وبركاته)?)?|سلام\s+عليكم|مرحب[ًاا]?|أهل[ًاا]?|اهل[ًاا]?|هلا|هلو|صباح\s+(?:الخير|النور)|مساء\s+(?:الخير|النور)|تحية\s+طيبة|يعطيك\s+العافية|حيا(?:ك|كم))[\s،.!ـ]*/u;
    text = text.replace(re, "").trim();
  }
  return { hadGreeting, remainder: text };
}

function detectUserLevel(normalized: string): UserLevel {
  if (hasAny(normalized, PRACTITIONER_TERMS)) return "legal_practitioner";
  if (hasAny(normalized, SAUDI_DIALECT_MARKERS) || hasAny(normalized, WEAK_LEGAL_WORDS)) return "layperson";
  return "unknown";
}

function detectDialect(normalized: string): Dialect {
  const saudi = hasAny(normalized, SAUDI_DIALECT_MARKERS);
  return saudi ? "saudi" : normalized ? "msa" : "unknown";
}

function detectTone(normalized: string, hasJudgment: boolean): ToneNeeded {
  if (hasAny(normalized, URGENCY_MARKERS)) return "reassuring";
  if (hasJudgment) return "reassuring";
  return "warm";
}

/** عبارات افتتاح دافئة بحسب التحية. */
const WARM_GREETING_REPLY =
  "وعليكم السلام ورحمة الله وبركاته، حيّاك الله. 🌿\nاشرح لي موضوعك بكلماتك — ولو كان مختصرًا أو بلهجتك العامية — وأنا أرتّبه لك قانونيًا خطوة خطوة قبل أي تحليل. لا تحتاج تصيغه بلغة قانونية.";

const PATH_BUTTONS = ["وصلتني دعوى", "أريد رفع دعوى", "صدر ضدي حكم", "تحليل مستند", "تقييم موقفي", "لست متأكدًا"];
const ROLE_BUTTONS = ["أنا المدّعى عليه", "أنا المدّعي", "أنا وكيل أحد الطرفين", "لست متأكدًا"];

/** هل الوقائع جوهرية بما يكفي لفتح التحليل؟ (قصة فعلية لا مجرّد طلب). */
function hasSubstantiveStory(remainder: string): boolean {
  const len = remainder.trim().length;
  const clauses = remainder.split(/[،.؛\n]+| و /).map((s) => s.trim()).filter((s) => s.length > 12);
  return len >= 90 && clauses.length >= 2;
}

/**
 * المُصنِّف الرئيسي: يحدّد نوع الرسالة ومستوى الفهم والردّ والأزرار والبوابة.
 * يأخذ النيّة الحتمية المُستخرَجة مسبقاً (دون LLM) لتقدير الإشارة القانونية.
 */
export function classifyConversation(
  message: string,
  det: IntentResult,
  hasExistingCase: boolean
): ConversationResult {
  const { hadGreeting, remainder } = stripGreeting(message);
  const normalizedFull = normalizeArabic(message);
  const normalizedRem = normalizeArabic(remainder);

  const userLevel = detectUserLevel(normalizedFull);
  const dialect = detectDialect(normalizedFull);
  const hasJudgment = det.hasJudgment || hasAny(normalizedFull, JUDGMENT_MARKERS);
  const tone = detectTone(normalizedFull, hasJudgment);

  // قوة الإشارة القانونية.
  const categories =
    Number(det.userRole !== "UNKNOWN") +
    Number(det.track !== "UNKNOWN") +
    Number(det.requestedOutput !== "UNKNOWN") +
    Number(hasJudgment);
  const hasWeakSignal = hasAny(normalizedFull, WEAK_LEGAL_WORDS) || categories > 0;
  const substantive = hasSubstantiveStory(remainder) || (hasExistingCase && det.facts.length >= 40);

  const base = {
    userLevel,
    dialect,
    tone,
    normalizedMeaning: remainder || message.trim(),
  };

  // ١) تحية فقط (لا محتوى بعدها).
  if (hadGreeting && wordCount(remainder) === 0) {
    return {
      ...base,
      messageType: "greeting",
      stage: "GreetingOnly",
      reply: WARM_GREETING_REPLY,
      nextQuestion: "",
      suggestedButtons: PATH_BUTTONS,
      runAnalysis: false,
      allowedEngines: ["GreetingResponse", "SuggestedPaths"],
    };
  }

  // ٢) دردشة عامة غير قانونية.
  if (!hasWeakSignal && hasAny(normalizedFull, SMALLTALK_WORDS) && !substantive) {
    return {
      ...base,
      messageType: "non_legal_smalltalk",
      stage: "NonLegalSmallTalk",
      reply:
        "حيّاك الله وأسعد بخدمتك. 🌿\nأنا هنا لمساعدتك في أمورك القضائية والقانونية. اكتب لي موضوعك بطريقتك، وسأوجّهك خطوة خطوة.",
      nextQuestion: "ما الموضوع الذي تريد المساعدة فيه؟",
      suggestedButtons: PATH_BUTTONS,
      runAnalysis: false,
      allowedEngines: ["GreetingResponse", "SuggestedPaths"],
    };
  }

  // ٣) قصة فعلية كافية → نفتح التحليل (سواء وُجدت تحية أم لا).
  if (substantive && det.track !== "UNKNOWN") {
    return {
      ...base,
      messageType: "ready_for_analysis",
      stage: "AnalysisReady",
      reply: "", // الردّ التفصيلي يبنيه المنسّق مع بطاقة الفهم.
      nextQuestion: "",
      suggestedButtons: [],
      runAnalysis: true,
      allowedEngines: ["IntentEngine", "UnderstandingCard", "CaseFile", "Retrieval", "Analysis", "EvidencePlan", "ArgumentMap", "Drafting"],
    };
  }

  // ٤) نيّة قانونية راجحة لكنها ناقصة → أسئلة موجّهة (لا تحليل).
  if (categories >= 1) {
    const greetPrefix = hadGreeting ? "وعليكم السلام ورحمة الله وبركاته، حيّاك الله.\n" : "";
    const { reply, nextQuestion, buttons } = buildGuidedIntake(det, hasJudgment, userLevel);
    return {
      ...base,
      messageType: hadGreeting ? "greeting_with_request" : "legal_intent",
      stage: "ProbableLegalIntent",
      reply: greetPrefix + reply,
      nextQuestion,
      suggestedButtons: buttons,
      runAnalysis: false,
      allowedEngines: ["IntentEngine", "GuidedIntake", "DocumentRequest"],
    };
  }

  // ٥) إشارة قانونية ضعيفة → سؤال موجّه واحد.
  if (hasWeakSignal) {
    const greetPrefix = hadGreeting ? "وعليكم السلام ورحمة الله وبركاته، حيّاك الله.\n" : "";
    return {
      ...base,
      messageType: hadGreeting ? "greeting_with_request" : "weak_legal_signal",
      stage: "WeakLegalSignal",
      reply:
        greetPrefix +
        "واضح أن لديك موضوعًا قانونيًا، وأريد أفهمه معك بهدوء قبل أي خطوة.\nحتى أوجّهك صحيحًا، أخبرني باختصار: ما الذي حصل؟ ومن الطرف الآخر (شخص/شركة/جهة)؟ ويمكنك رفع أي مستند لديك.",
      nextQuestion: "ما الذي حصل باختصار، ومن الطرف الآخر؟",
      suggestedButtons: PATH_BUTTONS,
      runAnalysis: false,
      allowedEngines: ["IntentEngine", "GuidedIntake", "DocumentRequest"],
    };
  }

  // ٦) لا إشارة قانونية واضحة → دعوة لطيفة لوصف الموضوع.
  return {
    ...base,
    messageType: "non_legal_smalltalk",
    stage: "NonLegalSmallTalk",
    reply:
      "حيّاك الله. اكتب لي موضوعك القانوني بطريقتك — مثل: «جاني تبليغ من المحكمة» أو «شركة تطالبني بمبلغ» — وسأوجّهك خطوة خطوة.",
    nextQuestion: "ما الموضوع الذي تريد المساعدة فيه؟",
    suggestedButtons: PATH_BUTTONS,
    runAnalysis: false,
    allowedEngines: ["GreetingResponse", "SuggestedPaths"],
  };
}

/** يبني أسئلة الاستقصاء الموجّهة (٢-٣ أسئلة) بحسب ما نُقص وما اكتُشف. */
function buildGuidedIntake(
  det: IntentResult,
  hasJudgment: boolean,
  userLevel: UserLevel
): { reply: string; nextQuestion: string; buttons: string[] } {
  // مسار الاعتراض (صدر حكم).
  if (hasJudgment) {
    return {
      reply:
        "أفهم أنه صدر ضدّك حكم، وأنا معك خطوة خطوة. قبل أي إجراء أحتاج أعرف وضع الحكم:\n" +
        "١) متى تبلّغت بالحكم (التاريخ)؟\n٢) هل الحكم ابتدائي أم نهائي؟\n٣) هل لديك صورة الحكم (المنطوق والأسباب)؟\n" +
        "لو ترفع صورة الحكم الآن أقدر أوضّح لك طريق الاعتراض والمدة المتبقية.",
      nextQuestion: "متى تبلّغت بالحكم، وهل لديك صورته؟",
      buttons: ["أرفع صورة الحكم", "تبلّغت اليوم", "تبلّغت قبل أيام", "لا أعرف نوعه"],
    };
  }

  // طلب واضح النوع لكنّه يحتاج صفة/مستندات/دفاع (مثل: «أبغى أرد على دعوى»).
  const wantsAnswer = det.requestedOutput === "ANSWER_MEMO" || det.requestedOutput === "REPLY_MEMO";
  const wantsClaim = det.requestedOutput === "CLAIM_SHEET";

  if (wantsAnswer || det.userRole === "DEFENDANT") {
    const layperson = userLevel !== "legal_practitioner";
    return {
      reply: layperson
        ? "فهمت أنك تريد الرد على دعوى — ولا تحتاج تكتبها بلغة قانونية الآن. أحتاج منك معلومتين أو ثلاث فقط حتى أوجّهك صحيحًا:\n" +
          "١) هل أنت من رُفعت عليه الدعوى؟\n٢) ما موضوعها إن كان واضحًا (مطالبة مالية، عمل، عقار…)؟\n٣) هل لديك صحيفة الدعوى أو تبليغ ناجز؟"
        : "فهمت أن المطلوب إعداد مذكرة جوابية. قبل الصياغة أحتاج أحدّد معك: صفتك (مدّعى عليه/وكيله)، والمستندات المتاحة، وأهم دفاع (سداد/عدم تسليم/عدم استحقاق/شرط تحكيم).",
      nextQuestion: "هل أنت المدّعى عليه؟ وما موضوع الدعوى؟",
      buttons: ["أنا المدّعى عليه", "أرفع صحيفة الدعوى", "مطالبة مالية", "نزاع عمل", "نزاع عقد", "اسألني خطوة خطوة"],
    };
  }

  if (wantsClaim || det.userRole === "PLAINTIFF") {
    return {
      reply:
        "فهمت أنك تريد رفع دعوى/مطالبة. حتى أوجّهك صحيحًا أخبرني باختصار:\n" +
        "١) ضد من ستكون الدعوى (شخص/شركة)؟\n٢) ما طلبك الأساسي (مبلغ، تنفيذ التزام، فسخ…)؟\n٣) هل لديك مستندات (عقد/فواتير/مراسلات)؟",
      nextQuestion: "ضد من، وما طلبك الأساسي؟",
      buttons: ["مطالبة مالية", "نزاع عقد/مقاولة", "نزاع عقار", "عندي مستندات", "اسألني خطوة خطوة"],
    };
  }

  // نوع نزاع ظاهر لكن المطلوب غير محدّد.
  return {
    reply:
      `فهمت أن لديك ${det.disputeType}. حتى أوجّهك صحيحًا: هل تريد رفع دعوى، أم الرد على دعوى مرفوعة عليك، أم فقط تقييم موقفك قبل التقاضي؟`,
    nextQuestion: "ما الذي تريده تحديدًا؟",
    buttons: ["أريد رفع دعوى", "أريد الرد على دعوى", "تقييم موقفي", "أرفع مستند"],
  };
}

// ── طلب عرض التقرير (الشات أولًا، التقرير بعد موافقة المستخدم) ──
const SHOW_REPORT_SIGNALS = [
  "اعرض التقرير", "عرض التقرير", "نعم اعرض", "اعرض التحليل", "عرض التحليل", "التحليل التفصيلي",
  "اعرض ملف القضيه", "ملف القضيه", "التقرير الاولي", "اعرض التقرير الاولي", "ابغى التقرير", "ورني التقرير",
  "نعم التقرير", "اعرض التفاصيل",
];
const DRAFT_SIGNALS = ["صغ مذكره", "اكتب مذكره", "جهز مذكره", "اعد مذكره", "صياغه مذكره", "صغ لائحه", "اكتب لائحه", "صغ المذكره"];

/** يكشف ما إذا طلب المستخدم عرض التقرير الكامل أو جزءاً منه أو صياغة مذكرة. */
export function detectReportRequest(message: string): {
  show: boolean;
  partial: "evidence" | "similar" | "strategies" | null;
  draft: boolean;
} {
  const n = normalizeArabic(message);
  const partial: "evidence" | "similar" | "strategies" | null =
    /خطه اثبات فقط|اعرض خطه الاثبات|خطه الاثبات فقط/.test(n)
      ? "evidence"
      : /الاحكام المشابهه فقط|اعرض الاحكام|احكام مشابهه فقط/.test(n)
        ? "similar"
        : /مقارنه الاستراتيجيات فقط|الاستراتيجيات فقط|قارن الاستراتيجيات/.test(n)
          ? "strategies"
          : null;
  const show = hasAny(n, SHOW_REPORT_SIGNALS) || partial !== null;
  const draft = hasAny(n, DRAFT_SIGNALS);
  return { show, partial, draft };
}

/** يحوّل مستوى الفهم إلى حالة محادثة أساسية. */
export function baseStage(stage: UnderstandingStage): ConversationStage {
  switch (stage) {
    case "GreetingOnly":
      return "greeting";
    case "NonLegalSmallTalk":
      return "intake";
    case "WeakLegalSignal":
    case "ProbableLegalIntent":
      return "clarifying";
    default:
      return "analysis_ready";
  }
}
