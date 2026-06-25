// ─────────────────────────────────────────────────────────────────────────────
// UnderstandingConfirmationEngine — بطاقة تأكيد الفهم وبوابة الإنتاج.
// القاعدة الحاكمة: لا يُنتج حكيم مخرجاً نهائياً عالي المخاطر قبل:
//   (١) عرض فهمه، و(٢) أخذ موافقة المستخدم — إلا إذا اختار صراحةً «مسودة مع الافتراضات».
// «يفهم أولاً، ثم يؤكد الفهم، ثم يسأل عن النواقص، ثم ينتج المخرج».
// ─────────────────────────────────────────────────────────────────────────────
import type {
  IntentResult,
  SimulationCaseFile,
  UnderstandingCard,
  UnderstandingLevel,
  UnderstandingOption,
} from "./types";
import {
  HIGH_RISK_OUTPUTS,
  OUTPUT_LABELS,
  ROLE_LABELS,
  STAGE_LABELS,
  TRACK_LABELS,
} from "./taxonomy";

const UNDERSTANDING_LABELS: Record<UnderstandingLevel, string> = {
  CONFIRMED: "فهم مؤكد",
  LIKELY: "فهم راجح",
  INCOMPLETE: "فهم ناقص",
  AMBIGUOUS: "طلب ملتبس",
  NEEDS_QUESTION: "يحتاج سؤالاً موجهاً",
};

/**
 * هل يُسمح بالإنتاج النهائي الآن؟
 * يُمنع عند: مخرج عالي المخاطر + (فهم ناقص/ملتبس أو نقص مؤثّر)، ما لم يوافق المستخدم
 * صراحةً أو يطلب مسودة أولية مع الافتراضات.
 */
export function canProduce(
  intent: IntentResult,
  approval: "CONFIRM" | "DRAFT_WITH_ASSUMPTIONS" | null
): { allowed: boolean; isDraftWithAssumptions: boolean; reason: string | null } {
  const highRisk = HIGH_RISK_OUTPUTS.includes(intent.requestedOutput);
  const criticalMissing = intent.missingInfo.filter((m) => m.critical).length;
  const weakUnderstanding =
    intent.understanding === "INCOMPLETE" ||
    intent.understanding === "AMBIGUOUS" ||
    intent.understanding === "NEEDS_QUESTION";

  // مسار «مسودة أولية مع الافتراضات» — مسموح صراحةً مع إظهار الافتراضات.
  if (approval === "DRAFT_WITH_ASSUMPTIONS") {
    return { allowed: true, isDraftWithAssumptions: true, reason: null };
  }

  // المخرجات غير عالية المخاطر (تحليل/قوة قضية/خطة) تُنتَج مباشرة كتحليل احتمالي.
  if (!highRisk) {
    return { allowed: true, isDraftWithAssumptions: false, reason: null };
  }

  // مخرج عالي المخاطر: يلزم موافقة صريحة + اكتمال كافٍ.
  if (approval === "CONFIRM" && criticalMissing === 0) {
    return { allowed: true, isDraftWithAssumptions: false, reason: null };
  }
  if (approval === "CONFIRM" && criticalMissing > 0) {
    return {
      allowed: false,
      isDraftWithAssumptions: false,
      reason: "وافقت على الفهم، لكن تبقى نواقص مؤثّرة تمنع مخرجاً نهائياً. استكملها أو اطلب مسودة أولية مع الافتراضات.",
    };
  }
  if (weakUnderstanding || criticalMissing > 0) {
    return {
      allowed: false,
      isDraftWithAssumptions: false,
      reason: "قبل كتابة مخرج نهائي، يلزم تأكيد الفهم واستكمال النواقص المؤثّرة.",
    };
  }
  // فهم مؤكد/راجح بلا نقص، لكن لم تصل موافقة بعد لمخرج عالي المخاطر.
  return {
    allowed: false,
    isDraftWithAssumptions: false,
    reason: "اعرض موافقتك على الفهم قبل إصدار المخرج النهائي.",
  };
}

/** يبني المسار الإجرائي المقترح المختصر (يُفصّل لاحقاً في محرك الإجراء). */
function proposedPath(intent: IntentResult): string[] {
  const steps: string[] = [];
  steps.push("تثبيت الصفة والمصلحة");
  if (intent.track === "ARBITRATION" || intent.hasArbitrationClause) steps.push("فحص اتفاق التحكيم والاختصاص");
  else steps.push("تحديد المحكمة/الجهة المختصة");
  steps.push("فحص شروط قبول الدعوى");
  if (intent.hasJudgment) {
    steps.push("استخراج بيانات الحكم ومنطوقه وأسبابه");
    steps.push("تحديد مواضع الخطأ وصياغة أسباب الاعتراض");
  } else {
    steps.push("تحرير محل النزاع وتحديد عبء الإثبات");
    steps.push("استرجاع النصوص النظامية من النواة");
    steps.push(`صياغة ${OUTPUT_LABELS[intent.requestedOutput]} بمنهج قضائي`);
  }
  steps.push("مراجعة بشرية قبل الاعتماد");
  return steps;
}

/** خيارات بطاقة الفهم. */
function buildOptions(canProduceNow: boolean): UnderstandingOption[] {
  const opts: UnderstandingOption[] = [
    { key: "CONFIRM", label: "صحيح، تابع" },
    { key: "EDIT_ROLE", label: "عدّل الصفة" },
    { key: "EDIT_OUTPUT", label: "عدّل المطلوب" },
    { key: "ADD_INFO", label: "أضف معلومات" },
    { key: "ASK_QUESTIONS", label: "اسألني أسئلة" },
  ];
  if (!canProduceNow) opts.push({ key: "DRAFT_WITH_ASSUMPTIONS", label: "أنشئ مسودة أولية مع الافتراضات" });
  return opts;
}

/** نصّ بيان المستندات. */
function documentsNote(file: SimulationCaseFile | null, attachmentsCount: number): string {
  if (attachmentsCount > 0) return `${attachmentsCount} ملف مرفوع (بانتظار تحديد نوعه قبل التحليل).`;
  if (file && file.evidence.length) return file.evidence.map((e) => e.title).join("، ");
  return "لم تُذكر مستندات متاحة بعد.";
}

/**
 * يبني بطاقة تأكيد الفهم الكاملة من النيّة (وملف القضية إن وُجد).
 */
export function buildUnderstandingCard(
  intent: IntentResult,
  approval: "CONFIRM" | "DRAFT_WITH_ASSUMPTIONS" | null,
  file: SimulationCaseFile | null,
  attachmentsCount: number
): UnderstandingCard {
  const gate = canProduce(intent, approval);
  const question =
    intent.understanding === "AMBIGUOUS" || intent.userRole === "UNKNOWN"
      ? "قبل أن أكمل: ما صفتك في هذه القضية، وما المخرج الذي تريده تحديداً؟"
      : "هل هذا الفهم صحيح؟";

  return {
    userRoleLabel: ROLE_LABELS[intent.userRole],
    disputeTypeLabel: intent.disputeType,
    trackLabel: TRACK_LABELS[intent.track],
    stageLabel: STAGE_LABELS[intent.proceduralStage],
    requestedOutputLabel: OUTPUT_LABELS[intent.requestedOutput],
    documentsNote: documentsNote(file, attachmentsCount),
    missingInfo: intent.missingInfo,
    proposedPath: proposedPath(intent),
    understanding: intent.understanding,
    understandingLabel: UNDERSTANDING_LABELS[intent.understanding],
    confidence: intent.confidence,
    question,
    options: buildOptions(gate.allowed),
    canProduceNow: gate.allowed,
    blockReason: gate.reason,
  };
}

export { UNDERSTANDING_LABELS };
