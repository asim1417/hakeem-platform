// ─────────────────────────────────────────────────────────────────────────────
// Hakeem Conversation Intelligence Engine (User Understanding & Dialogue Orchestrator).
// عقل الشات الأول: يفهم المستخدم ويدير الحوار قبل أي تحليل أو استرجاع أو صياغة.
// القاعدة: حكيم يفهم الإنسان أولاً، ثم المسألة، ثم يؤكد، ثم يسترجع، ثم يحلل، ثم يصوغ.
// «لا قضية = لا تحليل · لا مسألة = لا مصادر».
// حتمي بالكامل (يعمل دون اتصال) ويميّز التحية واللهجة ومستوى المستخدم.
//
// @deprecated (المرحلة ٥ — إعادة هندسة الحوار): مصدر قرار الحوار الأساسي أصبح العقل
// النموذجي `dialogue-brain.ts` (يقوده نموذج لغوي فهمًا وصياغةً وتصنيفًا). هذا المحرّك
// الحتمي — بقوائم الكلمات (MARKERS) و`classifyConversation`/`classifyDialogue` —
// يبقى **مسارًا احتياطيًا (fallback)** يعمل فقط عند تعذّر النموذج (offline/فشل/JSON
// غير صالح)، عبر `runChatTurnDeterministic` في chat-orchestrator. لا تُضِف إليه قوائم
// كلمات جديدة لمعالجة حالات الحوار — عالِجها في طبقة النموذج. يبقى هنا لضمان عدم التعطّل.
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

// ── قواميس الكشف (MARKERS) — احتياطية فقط بعد المرحلة ٥ ──
// @deprecated: هذه القوائم كانت تقود الحوار؛ صار يقوده dialogue-brain. تبقى للسقوط
// الآمن عند غياب النموذج فقط. لا تُوسّعها لمعالجة صياغات جديدة — عالِجها في النموذج.
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
 *
 * @deprecated (المرحلة ٥): مسار احتياطي (fallback) — يُستدعى في runChatTurnDeterministic
 * فقط عند تعذّر dialogue-brain. القرار الأساسي للحوار يقوده النموذج.
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

// ─────────────────────────────────────────────────────────────────────────────
// MessageIntentClassifier + ConversationRepairEngine + AssumptionManager.
// يميّز كلام المستخدم عن القضية من كلامه عن أداء الشات، ويتعامل مع التصحيح
// والملاحظات بلا استنتاج متسرّع. «لا تفترض قبل أن تفهم».
// ─────────────────────────────────────────────────────────────────────────────
import type { DialogueState } from "./types";

export type MessageIntent =
  | "greeting"
  | "greeting_with_request"
  | "small_talk"
  | "social_smalltalk"
  | "sports_or_news_smalltalk"
  | "non_legal_general"
  | "possible_consumer_issue"
  | "vague_case_signal"
  | "legal_request"
  | "clear_legal_request"
  | "case_fact"
  | "incident"
  | "court_document_reference"
  | "document_reference"
  | "answer_to_question"
  | "user_correction"
  | "assistant_feedback"
  | "identity_or_capability"
  | "frustration_or_confusion"
  | "report_request"
  | "draft_request"
  | "unclear"
  | "unknown";

/** SaudiLegalPhraseMapper — معانٍ قانونية محتملة (احتمالية لا جزم). */
export const SAUDI_PHRASE_MAP: { keys: string[]; meaning: string }[] = [
  { keys: ["جاني تبليغ", "وصلني تبليغ", "ورقه من ناجز", "ورقة من ناجز"], meaning: "تبليغ قضائي يحتاج تصنيف نوعه" },
  { keys: ["رافع علي", "رفعوا علي", "مرفوع علي"], meaning: "المستخدم غالبًا مدّعى عليه" },
  { keys: ["ابغى ارد عليهم", "ارد على الطرف"], meaning: "مذكرة جوابية أو رد" },
  { keys: ["ابغى ارفع عليه", "ابي اقاضي"], meaning: "صحيفة دعوى" },
  { keys: ["صدر ضدي حكم", "حكم ضدي"], meaning: "مسار اعتراض/استئناف/تنفيذ" },
  { keys: ["ما سلمني", "ما سلم"], meaning: "إخلال بالتسليم" },
  { keys: ["ما خلص الشغل", "ماخلص"], meaning: "إخلال في عقد مقاولة" },
  { keys: ["ما سدد", "يقول اني ما سددت"], meaning: "مطالبة مالية مع دفع بالسداد" },
  { keys: ["عندي تحويلات", "تحويلات بنكيه"], meaning: "دليل مالي" },
  { keys: ["عندي واتساب", "مراسلات"], meaning: "دليل رقمي" },
  { keys: ["ابغى اوقف التنفيذ"], meaning: "طلب وقف تنفيذ/إشكال بحسب المرحلة" },
];

export function mapSaudiPhrase(message: string): string | null {
  const n = normalizeArabic(message);
  for (const e of SAUDI_PHRASE_MAP) if (hasAny(n, e.keys)) return e.meaning;
  return null;
}

// ملاحظات المستخدم على أداء الشات (meta) — أعلى أولوية.
const FEEDBACK_MARKERS = [
  "تستعجل", "استعجلت", "لا تستعجل", "ما فهمتني", "ما فهمت علي", "ماتفهمني", "لا تحلل", "لا تستنتج",
  "اهدا", "تمهل", "بطئ", "على مهلك", "ركز معي", "انت متخصص", "انت غلطان في الفهم", "لا تتسرع", "خذ وقتك",
  // صيغ «لم» للنفي + شكاوى عدم الفهم الشائعة.
  "لم تفهمني", "لم تفهم", "لم تستوعب", "ما فهمتني جيدا", "مافهمتني", "ما فهمت قصدي", "ما استوعبت", "انت ما فهمت", "ماتفهم علي",
];
// تصحيح المستخدم لفهم حكيم.
const CORRECTION_MARKERS = [
  "قصدي", "اقصد", "ما اقصد", "انت فهمت غلط", "فهمت غلط", "مو هذا", "مو كذا", "مب كذا", "ليس كذا",
  "وليس", "غلط الفهم", "تصحيح", "لا مو", "ما هو كذا",
];
// قلق/ارتباك.
const FRUSTRATION_MARKERS = ["متوتر", "قلقان", "تعبت", "مدري وش اسوي", "ما ادري وش اسوي", "ضايق", "زهقت", "محتار جدا"];
// أسئلة عن هوية حكيم وقدراته (meta) — «ما اسمك»، «من أنت»، «وش تسوي»، «هل أنت روبوت».
const IDENTITY_MARKERS = [
  "ما اسمك", "وش اسمك", "ايش اسمك", "شو اسمك", "اسمك ايش", "اسمك وش", "اسمك ايه",
  "من انت", "مين انت", "انت مين", "من تكون", "مين تكون", "عرف بنفسك", "عرفني بنفسك", "عرف عن نفسك",
  "هل انت روبوت", "هل انت بوت", "هل انت ذكاء", "انت ذكاء اصطناعي", "هل انت انسان", "هل انت بشر", "هل انت عاقل", "انت عاقل",
  "وش تسوي", "ايش تسوي", "وش تقدر تسوي", "ايش تقدر تسوي", "وش تقدر", "ايش تقدر تساعد", "وش وظيفتك", "ايش وظيفتك", "وش تخصصك",
];
// إشارات الغموض (وصف عام لا تكييف).
const VAGUE_MARKERS = ["معقده", "معقد", "صعبه", "صعب", "متشابكه", "متشابك", "موضوع", "مشكله", "قضيه", "حالتي", "امري"];

// دردشة اجتماعية عامة.
const SOCIAL_MARKERS = ["وش الاخبار", "وش اخبارك", "كيف الحال", "كيف حالك", "شخبارك", "شلونك", "اخبارك", "وش مسوي"];
// رياضة/أخبار خارج النطاق.
const SPORTS_NEWS_MARKERS = ["مباراه", "المنتخب", "الدوري", "نادي", "النصر", "الهلال", "الاتحاد", "الاهلي", "كوره", "لاعب", "هدف", "الطقس", "الجو حار"];
// مواضيع عامة خارج التخصّص القانوني (أكل/سفر/طقس/فن/جغرافيا…).
const NON_LEGAL_TOPIC_MARKERS = ["اكله", "اكل", "طعام", "وجبه", "مطعم", "طبخ", "وصفه", "سفر", "سياحه", "وجهه سياحيه", "فيلم", "مسلسل", "اغنيه", "لون", "جغرافيا", "عاصمه", "دوله", "اندونيسيا", "الطقس", "نكته", "برمجه", "رياضيات", "تاريخ العالم"];
// كلمات استفهام (للتمييز بين سؤال عام وسؤال قانوني).
const QUESTION_WORDS = ["وش", "ايش", "كيف", "اين", "وين", "متى", "ليش", "كم", "هل", "ما هي", "ما هو"];
// احتمال قضية مستهلك.
const CONSUMER_MARKERS = ["اشتريت", "شريت", "بضاعه", "منتج", "سلعه", "فاسد", "فاسده", "معيب", "معيبه", "تالف", "المتجر", "المحل", "البائع", "استبدال", "استرجاع", "ضمان"];
// إشارة مستند قضائي.
const COURT_DOC_MARKERS = ["جاني تبليغ", "وصلني تبليغ", "ورقه من ناجز", "ورقة من ناجز", "تبليغ من المحكمه", "صحيفه دعوى", "ورقه من المحكمه", "رساله من المحكمه", "ابلغوني"];
// واقعة بسيطة (جريمة/اعتداء/فقد) — توجيه عملي + سؤال عن البلاغ، لا تقرير ولا مصادر.
const INCIDENT_MARKERS = ["انسرق", "انسرقت", "سرقوا", "سرق", "نشل", "ضاع", "ضاعت", "فقدت", "اعتدى", "ضربني", "تعدى علي", "نصب علي", "احتيال", "ابتزاز", "هددني", "تهديد", "دخلوا بيتي", "تحرش"];

const NEGATED_CONCEPTS: { keys: string[]; assumption: string }[] = [
  { keys: ["عقدي", "عقديه", "عقد"], assumption: "نزاع عقدي" },
  { keys: ["تجاري", "تجاريه"], assumption: "نزاع تجاري" },
  { keys: ["عمالي", "عمل"], assumption: "نزاع عمالي" },
  { keys: ["جزائي", "جنائي"], assumption: "قضية جزائية" },
  { keys: ["مدني", "مدنيه"], assumption: "نزاع مدني" },
];

/** يستخرج الافتراض الذي نفاه المستخدم («... وليس عقدية» → «نزاع عقدي»). */
export function extractNegatedAssumption(message: string): string | null {
  const n = normalizeArabic(message);
  const m = n.match(/(?:وليس|ليس|مو|مب|مهو|ماهو)\s+([^\s،.]+)/);
  const negated = m?.[1] ?? "";
  for (const c of NEGATED_CONCEPTS) if (negated && c.keys.some((k) => negated.includes(normalizeArabic(k)))) return c.assumption;
  // قد يأتي المفهوم في موضع آخر من جملة التصحيح.
  for (const c of NEGATED_CONCEPTS) if (hasAny(n, c.keys) && hasAny(n, ["وليس", "ليس", "مو", "مب"])) return c.assumption;
  return null;
}

const EMPTY_DIALOGUE: DialogueState = { rejectedAssumptions: [], confirmedFacts: [], askedQuestions: [], mode: "normal" };

export function normalizeDialogue(d?: DialogueState | null): DialogueState {
  return {
    rejectedAssumptions: d?.rejectedAssumptions ?? [],
    confirmedFacts: d?.confirmedFacts ?? [],
    askedQuestions: d?.askedQuestions ?? [],
    mode: d?.mode === "slow_guided_intake" ? "slow_guided_intake" : "normal",
  };
}

export interface DialogueDecision {
  intent: MessageIntent;
  reply: string;
  buttons: string[];
  dialogue: DialogueState; // الحالة المُحدَّثة
  /** يمنع الاسترجاع والتقرير لهذه الدورة (تحية/غموض/تصحيح/ملاحظة). */
  blockAnalysis: boolean;
}

/**
 * ConversationRepairEngine — يلتقط الأنواع التي توقف الاستنتاج:
 * ملاحظة على الأداء، تصحيح، قلق، غموض. يعيد null إذا لم تكن الرسالة من هذه الأنواع.
 *
 * @deprecated (المرحلة ٥): مسار احتياطي (fallback) — القرار الأساسي للحوار يقوده
 * dialogue-brain؛ هذا يعمل فقط عند تعذّر النموذج.
 */
export function classifyDialogue(
  message: string,
  det: IntentResult,
  prev?: DialogueState | null
): DialogueDecision | null {
  const n = normalizeArabic(message);
  const dialogue = normalizeDialogue(prev);
  const stripped = n.replace(/\s/g, "");
  const hasArabic = /[ء-ي]/.test(n);

  // ٠) رسالة ناقصة (حرف/حرفان) أو ضجيج عشوائي (أحرف مكررة/غير عربية بلا معنى) → طلب توضيح.
  const isRepeatedNoise = /^(.)\1{2,}$/.test(stripped); // مثل «IIII» أو «ههههه»
  const isGibberish = !hasArabic && !/^\d+$/.test(stripped) && stripped.length <= 12;
  if (stripped.length <= 2 || isRepeatedNoise || isGibberish) {
    return {
      intent: "unclear",
      reply:
        "ما وصلتني رسالة واضحة 🙂. اكتب لي موضوعك بجملة بسيطة بطريقتك — مثل: «جاني تبليغ من المحكمة» أو «شركة تطالبني بمبلغ» — وأنا أساعدك خطوة خطوة.",
      buttons: PATH_BUTTONS,
      dialogue,
      blockAnalysis: true,
    };
  }

  // ١) ملاحظة على أداء الشات (meta) — أعلى أولوية، حتى لو حملت كلمات قضية.
  if (hasAny(n, FEEDBACK_MARKERS)) {
    return {
      intent: "assistant_feedback",
      reply:
        "معك حق، أعتذر. سأبطئ الآن ولن أفترض شيئًا من عندي.\nاكتب لي القصة بطريقتك من البداية، أو قل لي فقط: هل عندك دعوى قائمة أم لا؟",
      buttons: ["نعم، عندي دعوى قائمة", "لا، ما زلت قبل الدعوى", "خلني أكتب القصة"],
      dialogue: { ...dialogue, mode: "slow_guided_intake" },
      blockAnalysis: true,
    };
  }

  // ٢) تصحيح المستخدم لفهم حكيم.
  if (hasAny(n, CORRECTION_MARKERS)) {
    const rejected = extractNegatedAssumption(message);
    const rejectedAssumptions = rejected && !dialogue.rejectedAssumptions.includes(rejected)
      ? [...dialogue.rejectedAssumptions, rejected]
      : dialogue.rejectedAssumptions;
    const reply = rejected
      ? `صحيح، فهمت عليك الآن، وأعتذر عن الافتراض السابق. لن أعتبرها «${rejected}»، ولن أفترض نوع النزاع من عندي.\nسؤال واحد فقط: هل القضية منظورة في المحكمة حاليًا؟`
      : "تمام، شكرًا لتصحيحك. سأصحّح فهمي ولن أفترض شيئًا.\nاكتب لي ما تقصده تحديدًا، وسؤالي الوحيد الآن: هل القضية منظورة في المحكمة حاليًا؟";
    return {
      intent: "user_correction",
      reply,
      buttons: ["نعم، منظورة بالمحكمة", "لا، قبل رفع الدعوى", "صدر فيها حكم"],
      dialogue: { ...dialogue, rejectedAssumptions, mode: "slow_guided_intake" },
      blockAnalysis: true,
    };
  }

  // ٣) قلق/ارتباك.
  if (hasAny(n, FRUSTRATION_MARKERS)) {
    return {
      intent: "frustration_or_confusion",
      reply:
        "أفهم شعورك، ولا يهمّك — نرتّب الأمر بهدوء خطوة خطوة.\nأول شيء فقط: هل عندك موعد جلسة أو مهلة محدّدة؟ وإن كان عندك تاريخ اكتبه لي.",
      buttons: ["عندي جلسة قريبة", "صدر ضدي حكم", "ما زلت قبل الدعوى", "خلني أكتب القصة"],
      dialogue: { ...dialogue, mode: "slow_guided_intake" },
      blockAnalysis: true,
    };
  }

  // ٣.٥) سؤال عن الهوية/القدرات («ما اسمك»، «من أنت»، «وش تسوي») → تعريف موجز بحكيم ثم توجيه.
  if (hasAny(n, IDENTITY_MARKERS)) {
    return {
      intent: "identity_or_capability",
      reply:
        "أنا «حكيم» — مساعد قانوني سعودي ذكي. مهمّتي أن أساعدك تفهم وضعك القضائي وترتّب وقائعك ودفوعك وأوراقك خطوة بخطوة وفق الأنظمة السعودية. لست محاميًا ولا أُصدر أحكامًا، لكني أوضّح لك الصورة وأجهّز معك التحليل والمذكرات. عن أي موضوع نبدأ؟",
      buttons: PATH_BUTTONS,
      dialogue,
      blockAnalysis: true,
    };
  }

  const noConcrete = det.track === "UNKNOWN" && det.requestedOutput === "UNKNOWN" && det.userRole === "UNKNOWN" && !det.hasJudgment;

  // ٤) إشارة مستند قضائي → دخول حواري لـlegal intake (سؤال عن نوع المستند + رفعه).
  if (hasAny(n, COURT_DOC_MARKERS)) {
    return {
      intent: "court_document_reference",
      reply:
        "يبدو أنك استلمت مستندًا/تبليغًا قضائيًا. خلنا نحدّده بهدوء قبل أي خطوة:\nهل هو تبليغ بدعوى جديدة، أم موعد جلسة، أم حكم؟ ويمكنك رفع صورة المستند وسأقرأه لك وأوضّح الخطوة التالية.",
      buttons: ["تبليغ بدعوى جديدة", "موعد جلسة", "حكم صادر", "أرفع صورة المستند"],
      dialogue,
      blockAnalysis: true,
    };
  }

  // ٥-أ) واقعة بسيطة (جريمة/فقد/اعتداء) → توجيه عملي + سؤال واحد عن البلاغ، بلا تقرير ولا مصادر.
  if (hasAny(n, INCIDENT_MARKERS)) {
    return {
      intent: "incident",
      reply:
        "أنا معك، ولا يهمّك — نبدأ بالأهم عمليًا.\nفي مثل هذه الوقائع، الخطوة الأولى غالبًا تقديم بلاغ لدى الجهة المختصة (الشرطة/أبشر أو منصة «أبشر أفراد»). سؤال واحد فقط: هل قدّمت بلاغًا حتى الآن؟",
      buttons: ["نعم، قدّمت بلاغًا", "لا، لم أبلّغ بعد", "أبغى أعرف كيف أبلّغ", "عندي تفاصيل أكثر"],
      dialogue,
      blockAnalysis: true,
    };
  }

  // ٥) دردشة اجتماعية / رياضة-أخبار / احتمال مستهلك — فقط عند غياب أي إشارة قانونية.
  if (noConcrete && hasAny(n, SPORTS_NEWS_MARKERS) && !hasAny(n, CONSUMER_MARKERS)) {
    return {
      intent: "sports_or_news_smalltalk",
      reply:
        "هذا خارج تخصّصي القانوني 🙂، لكن لو عندك سؤال قانوني متعلق بالرياضة — مثل عقد لاعب، أو تذاكر، أو حقوق بث، أو نزاع رياضي — أقدر أساعدك فيه.",
      buttons: ["عندي نزاع رياضي", "عندي عقد", "موضوع آخر"],
      dialogue,
      blockAnalysis: true,
    };
  }
  // سؤال عام خارج التخصّص (أكل/جغرافيا/طقس/فن…) → ردّ «خارج تخصّصي» لطيف، لا القالب القانوني.
  if (noConcrete && hasAny(n, NON_LEGAL_TOPIC_MARKERS) && !hasAny(n, WEAK_LEGAL_WORDS) && !hasAny(n, VAGUE_MARKERS)) {
    const isQuestion = hasAny(n, QUESTION_WORDS) || /\?|؟/.test(message);
    return {
      intent: "non_legal_general",
      reply:
        (isQuestion ? "هذا سؤال عام خارج تخصّصي القانوني 🙂. " : "هذا خارج تخصّصي القانوني 🙂. ") +
        "أنا هنا للمواضيع القضائية والقانونية السعودية — مثل دعوى، أو مذكرة، أو عقد، أو حكم. عندك موضوع من هذا النوع؟",
      buttons: PATH_BUTTONS,
      dialogue,
      blockAnalysis: true,
    };
  }
  if (noConcrete && hasAny(n, CONSUMER_MARKERS)) {
    return {
      intent: "possible_consumer_issue",
      reply:
        "قد تكون هذه مسألة تتعلق بحقوق المستهلك. هل تريد فقط معرفة التصرّف المناسب، أم لديك فاتورة ورفض البائع الاستبدال أو التعويض؟",
      buttons: ["أريد معرفة التصرف", "رفض البائع الاستبدال", "عندي فاتورة", "موضوع آخر"],
      dialogue,
      blockAnalysis: true,
    };
  }
  if (noConcrete && hasAny(n, SOCIAL_MARKERS) && n.split(/\s+/).length <= 6) {
    return {
      intent: "social_smalltalk",
      reply:
        "الأخبار طيّبة، حيّاك الله. 🌿 أنا جاهز أساعدك متى ما كان عندك موضوع قانوني أو مستند أو دعوى تريد ترتيبها.",
      buttons: PATH_BUTTONS,
      dialogue,
      blockAnalysis: true,
    };
  }

  // ٦) إشارة غامضة (وصف عام بلا تكييف) — لا تُحوَّل إلى نوع نزاع.
  if (noConcrete && hasAny(n, VAGUE_MARKERS) && n.split(/\s+/).length <= 8) {
    return {
      intent: "vague_case_signal",
      reply:
        "فهمت أن لديك قضية صعبة أو متشابكة، لكن نوعها لم يتّضح بعد ولن أفترضه.\nخلنا نبدأ بسؤال واحد فقط: هل القضية منظورة في المحكمة الآن، أم ما زالت قبل رفع الدعوى؟",
      buttons: ["منظورة بالمحكمة", "قبل رفع الدعوى", "صدر فيها حكم", "ما أدري"],
      dialogue,
      blockAnalysis: true,
    };
  }

  return null;
}
