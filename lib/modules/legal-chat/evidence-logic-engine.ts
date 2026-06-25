// ─────────────────────────────────────────────────────────────────────────────
// EvidenceLogicEngine + المحلّلات الحتمية المساعدة.
// المحاكاة القضائية لا قيمة لها دون معرفة عبء الإثبات وقوة الدليل.
// يبني: خطة إثبات، خريطة حجج، قائمة مسائل، خط زمني، درجة ثقة قانونية،
// والخطوة التالية الأفضل — كلها من ملف القضية + تحليل النواة (دون اختلاق).
// ─────────────────────────────────────────────────────────────────────────────
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import type {
  ArgumentMapRow,
  ConfidenceFactor,
  EvidencePlanRow,
  GroundedSource,
  IntentResult,
  LegalConfidenceScore,
  LegalIssue,
  SimulationCaseFile,
  TimelineEvent,
} from "./types";

/** المكلّف بالإثبات بحسب صفة المستخدم وطبيعة الواقعة. */
function burdenLabel(intent: IntentResult): string {
  if (intent.userRole === "DEFENDANT" || intent.userRole === "DEFENDANT_LAWYER")
    return "المدّعي (والمدّعى عليه فيما يدّعيه من وفاء/براءة)";
  return "المدّعي (البيّنة على من ادّعى)";
}

/**
 * خطة الإثبات: لكل واقعة منتِجة، مَن يثبتها، الدليل الحالي، قوته، النقص، الإجراء، الأثر.
 */
export function buildEvidencePlan(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null
): EvidencePlanRow[] {
  const burden = burdenLabel(intent);
  const facts = (analysis?.materialFacts?.length ? analysis.materialFacts : caseFile.facts.map((f) => f.text)).slice(0, 6);
  const haveEvidence = caseFile.evidence.length > 0;
  const evidenceList = caseFile.evidence.map((e) => e.title).join("، ");

  if (facts.length === 0) {
    return [
      {
        fact: "العلاقة محل النزاع وسندها",
        burdenOn: burden,
        currentEvidence: haveEvidence ? evidenceList : "لم تُحدَّد البيّنات بعد",
        strength: "غير مقدّرة",
        gap: "تحديد الوقائع المنتِجة والمستندات المؤيِّدة",
        suggestedAction: "تقديم سند العلاقة (عقد/مراسلات) وبيان البيّنات",
        impact: "مؤثّر في ثبوت أصل الحق",
      },
    ];
  }

  return facts.map((fact) => ({
    fact,
    burdenOn: burden,
    currentEvidence: haveEvidence ? evidenceList : "بانتظار تحديد البيّنة المؤيِّدة لهذه الواقعة",
    strength: haveEvidence ? "متوسطة (رهن المناقشة)" : "غير مكتملة",
    gap: haveEvidence ? "ربط الدليل بالواقعة على نحو منتج ومقبول" : "لا يوجد دليل مرتبط بهذه الواقعة بعد",
    suggestedAction: "تحديد الدليل المنتج (محرر/شهادة/خبرة/قرينة) وربطه بالواقعة",
    impact: "مؤثّر في ترجيح ثبوت الواقعة",
  }));
}

/**
 * خريطة الحجج: لكل مسألة، حجة المستخدم ودليلها، ودفع الخصم، والرد، والتقييم.
 */
export function buildArgumentMap(
  intent: IntentResult,
  analysis: CaseAnalysisResult | null
): ArgumentMapRow[] {
  const issues =
    analysis?.materialFacts?.slice(0, 3) ??
    [intent.disputeType];
  const defenses = analysis?.potentialDefenses?.map((d) => d.text) ?? [];

  return issues.map((issue, i) => ({
    issue,
    userArgument:
      intent.userRole === "DEFENDANT" || intent.userRole === "DEFENDANT_LAWYER"
        ? "إنكار/عدم ثبوت ما يدّعيه الخصم في هذه المسألة"
        : "ثبوت الحق محل المطالبة في هذه المسألة",
    userEvidence: "البيّنة المقدّمة (تُحدَّد بدقة بعد جرد المستندات)",
    opponentArgument: defenses[i] ?? "دفع محتمل بعدم الثبوت أو الوفاء أو انتفاء الشرط",
    response: "الرد بتعزيز البيّنة وربطها بالواقعة ومناقشة دليل الخصم",
    assessment: "يتوقّف على اكتمال البيّنة ومناقشتها في الجلسة",
  }));
}

/** قائمة المسائل محل النزاع. */
export function buildIssuesList(
  intent: IntentResult,
  analysis: CaseAnalysisResult | null,
  sources: GroundedSource[]
): LegalIssue[] {
  const basisNote = sources.length ? sources[0].reference : "تُحدَّد النصوص بعد الاسترجاع من النواة";
  const items: LegalIssue[] = [];
  items.push({
    issue: "هل تثبت الصفة والمصلحة وشروط قبول الدعوى؟",
    relatedFacts: "بيانات الأطراف والعلاقة محل النزاع",
    evidence: "سند الصفة/الوكالة والمستندات المؤسِّسة",
    basisNote,
    probableOutcome: "شرط أولي للنظر في الموضوع",
  });
  if (intent.hasArbitrationClause || intent.track === "ARBITRATION") {
    items.push({
      issue: "هل يحجب شرط التحكيم اختصاص القضاء؟",
      relatedFacts: "بند التحكيم في العقد ونطاقه",
      evidence: "نص العقد وبند التحكيم",
      basisNote: "نظام التحكيم (يُسترجع من النواة)",
      probableOutcome: "قد يؤدي إلى الدفع بعدم الاختصاص",
    });
  }
  const facts = analysis?.materialFacts ?? intent.facts ? [intent.facts] : [];
  (analysis?.materialFacts?.slice(0, 3) ?? []).forEach((f) =>
    items.push({
      issue: `هل تثبت واقعة: ${f}؟`,
      relatedFacts: f,
      evidence: "البيّنة المرتبطة بالواقعة",
      basisNote,
      probableOutcome: "مؤثّر في النتيجة بحسب قوة البيّنة",
    })
  );
  void facts;
  return items;
}

/** الخط الزمني للقضية — يستخرج تواريخ من نص الوقائع إن وُجدت. */
export function buildTimeline(caseFile: SimulationCaseFile): TimelineEvent[] {
  const text = caseFile.facts.map((f) => f.text).join(" ");
  const dateRegex = /(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}|\d{4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s+(?:محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)[^\d]{0,20}\d{2,4})/g;
  const matches = Array.from(text.matchAll(dateRegex)).slice(0, 8);
  if (matches.length === 0) {
    return [
      {
        date: "—",
        event: "لم تُستخرج تواريخ صريحة من الوقائع بعد",
        source: "ملف القضية",
        legalEffect: "يلزم تحديد التواريخ المؤثّرة (العقد/الإخلال/الإنذار/المطالبة)",
      },
    ];
  }
  return matches.map((m) => ({
    date: m[0].trim(),
    event: "حدث مرتبط بالوقائع (يُحرَّر وصفه)",
    source: "من رسالة المستخدم",
    legalEffect: "يُقدَّر أثره (ميعاد/تقادم/استحقاق)",
  }));
}

/** درجة الثقة القانونية — تجمّع عناصر جاهزية المخرج. */
export function buildConfidenceScore(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null,
  sources: GroundedSource[]
): LegalConfidenceScore {
  const factsClarity = Math.min(100, 30 + caseFile.facts.length * 12);
  const docsCompleteness = caseFile.evidence.length ? Math.min(100, 40 + caseFile.evidence.length * 15) : 35;
  const normStrength = sources.length ? Math.min(100, 40 + sources.length * 8) : 25;
  const evidenceStrength = analysis ? Math.round((analysis.caseStrengthScore ?? 50)) : 45;
  const characterizationStability = intent.track !== "UNKNOWN" ? 80 : 40;
  const jurisdictionClarity = intent.track !== "UNKNOWN" ? 85 : 45;
  const proceduralSoundness = intent.proceduralStage !== "UNKNOWN" ? 75 : 50;
  const appealRisk = intent.hasJudgment ? 60 : 70;

  const factors: ConfidenceFactor[] = [
    { element: "وضوح الوقائع", score: factsClarity, note: caseFile.facts.length > 3 ? "وقائع كافية للتصور الأولي" : "تحتاج تفصيلاً أكبر" },
    { element: "اكتمال المستندات", score: docsCompleteness, note: caseFile.evidence.length ? "توجد مستندات" : "لا بيان بالمستندات بعد" },
    { element: "قوة النص النظامي", score: normStrength, note: sources.length ? `${sources.length} مصدر من النواة` : "لم تُسترجع مصادر بعد" },
    { element: "قوة الدليل", score: evidenceStrength, note: "تقدير أولي رهن المناقشة" },
    { element: "استقرار التكييف", score: characterizationStability, note: intent.track !== "UNKNOWN" ? "المسار محدد" : "المسار غير محدد" },
    { element: "وضوح الاختصاص", score: jurisdictionClarity, note: intent.track !== "UNKNOWN" ? "الاختصاص ظاهر" : "يحتاج تحديداً" },
    { element: "سلامة الإجراء", score: proceduralSoundness, note: intent.proceduralStage !== "UNKNOWN" ? "المرحلة محددة" : "المرحلة غير محددة" },
    { element: "مخاطر الاعتراض", score: appealRisk, note: intent.hasJudgment ? "قائمة (صدر حكم)" : "أقل (لا حكم بعد)" },
  ];
  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  const verdict =
    overall >= 75
      ? "جاهزية جيدة — يصلح كأساس للصياغة مع المراجعة البشرية"
      : overall >= 55
        ? "جاهزية متوسطة — يصلح كمسودة أولية لا كصيغة نهائية"
        : "جاهزية منخفضة — يلزم استكمال نواقص مؤثّرة قبل أي مخرج نهائي";
  return { factors, overall, verdict };
}

/** الخطوة التالية الأفضل — توجيه عملي بحسب النواقص والمرحلة. */
export function buildNextBestActions(
  intent: IntentResult,
  caseFile: SimulationCaseFile
): string[] {
  const actions: string[] = [];
  for (const m of caseFile.missingInfo) {
    if (m.key === "role") actions.push("تحديد صفتك في القضية (مدّعٍ/مدّعى عليه/وكيل…)");
    if (m.key === "facts") actions.push("تفصيل الوقائع وتواريخها المؤثّرة");
    if (m.key === "documents") actions.push("إرفاق/بيان المستندات المتاحة (عقد، فواتير، مراسلات)");
    if (m.key === "claims") actions.push("تحديد الطلبات بدقة");
    if (m.key === "arbitration") actions.push("بيان هل يوجد شرط تحكيم في العقد");
    if (m.key === "judgment") actions.push("رفع صورة الحكم وبيان تاريخ التبليغ والمنطوق والأسباب");
  }
  if (intent.hasJudgment) actions.push("فحص فرص الاعتراض وأنسب طريق (استئناف/نقض/التماس)");
  else {
    actions.push("بناء خطة إثبات تربط كل واقعة بدليلها");
    if (intent.track === "COMMERCIAL") actions.push("طلب كشف حساب/فواتير معتمدة لتعزيز المطالبة");
  }
  if (actions.length === 0) actions.push("تأكيد الفهم للمتابعة نحو الصياغة");
  return Array.from(new Set(actions)).slice(0, 6);
}
