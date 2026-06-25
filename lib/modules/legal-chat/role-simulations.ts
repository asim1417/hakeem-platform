// ─────────────────────────────────────────────────────────────────────────────
// محاكاة الأدوار: الخصم الافتراضي، القاضي الافتراضي، المحكّم.
// منطق حقيقي مبني على ملف القضية + تحليل النواة (case-analysis) + خريطة الإجراء،
// دون اختلاق مصادر. كل المخرجات تدريبية.
// ─────────────────────────────────────────────────────────────────────────────
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import type {
  ArbitrationView,
  GroundedSource,
  IntentResult,
  JudgeView,
  OpponentRow,
  SimulationCaseFile,
} from "./types";
import { buildProcedureMap } from "./judicial-procedure-engine";
import { TRAINING_DISCLAIMER } from "./drafting-style-engine";

/**
 * الخصم الافتراضي: يتوقّع أقوى دفوع الطرف الآخر ونقاط ضعف المستخدم، ويقترح ردوداً.
 * يستفيد من الدفوع المحتملة في تحليل النواة، ويضيف دفوعاً نمطية بحسب المسار والمرحلة.
 */
export function buildOpponentSimulation(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null
): OpponentRow[] {
  const rows: OpponentRow[] = [];
  const userIsPlaintiff = intent.userRole === "PLAINTIFF" || intent.userRole === "PLAINTIFF_LAWYER";

  // دفوع شكلية متوقعة دائماً.
  rows.push({
    expectedDefense: "الدفع بعدم الاختصاص (نوعي/مكاني/ولائي)",
    strength: intent.track === "UNKNOWN" ? "MEDIUM" : "WEAK",
    reason: intent.track === "UNKNOWN" ? "التكييف غير مستقر بعد" : "المسار ظاهر مما يضعف الدفع",
    suggestedResponse: "إثبات انعقاد الاختصاص بالنص والوقائع قبل الموضوع",
    requiredDocument: "ما يثبت محل العلاقة وموطن المدعى عليه",
  });
  rows.push({
    expectedDefense: "الدفع بعدم قبول الدعوى (انتفاء الصفة/المصلحة/فوات الميعاد)",
    strength: caseFile.parties.length === 0 ? "MEDIUM" : "WEAK",
    reason: caseFile.parties.length === 0 ? "بيانات الصفة غير مكتملة" : "الصفة مبيّنة",
    suggestedResponse: "تقديم سند الصفة/الوكالة وبيان قيام المصلحة والميعاد",
    requiredDocument: "الوكالة/سند الصفة وما يثبت الميعاد",
  });

  if (intent.hasArbitrationClause || intent.track === "ARBITRATION") {
    rows.push({
      expectedDefense: "الدفع بوجود شرط تحكيم يحجب اختصاص القضاء",
      strength: "STRONG",
      reason: "وجود شرط تحكيم صحيح يوجب إحالة النزاع للتحكيم",
      suggestedResponse: "بحث صحة الشرط ونطاقه ومدى شموله للنزاع، أو التمسك بالتنازل عنه",
      requiredDocument: "نص العقد وبند التحكيم",
    });
  }

  // دفوع موضوعية من تحليل النواة (إن توفّر).
  const substantive = analysis?.potentialDefenses?.filter((d) => d.category === "SUBSTANTIVE") ?? [];
  for (const d of substantive.slice(0, 3)) {
    rows.push({
      expectedDefense: d.text,
      strength: d.basis ? "MEDIUM" : "WEAK",
      reason: d.basis ? "له سند يحتاج فحصاً" : "دفع نمطي يحتاج إسناداً",
      suggestedResponse: "تفنيد الدفع بالبيّنة وربطه بالواقعة محل الإثبات",
      requiredDocument: "البيّنة المؤيِّدة للواقعة محل الدفع",
    });
  }

  // دفع موضوعي نمطي بحسب نوع النزاع.
  rows.push({
    expectedDefense: userIsPlaintiff
      ? "إنكار الواقعة أو الدفع بالوفاء/البراءة"
      : "التمسك بثبوت الحق وكفاية البيّنة",
    strength: (analysis?.caseStrengthScore ?? 50) >= 60 ? "WEAK" : "MEDIUM",
    reason: "يتوقّف على اكتمال البيّنة ومناقشتها",
    suggestedResponse: userIsPlaintiff
      ? "تعزيز البيّنة وربطها بالواقعة ونفي الوفاء المدّعى"
      : "تفنيد بيّنة الخصم وإبراز نقص الإسناد",
    requiredDocument: "كشف حساب/مراسلات/محرر يثبت الواقعة أو ينفيها",
  });

  return rows;
}

/**
 * القاضي الافتراضي (تدريبي): يحرّر محل النزاع، يحدّد الوقائع المنتِجة وعبء الإثبات،
 * يطرح أسئلة الجلسة، يقدّر صلاحية الحكم، ويصوغ أسباباً ومنطوقاً افتراضيين غير ملزمين.
 */
export function buildJudgeSimulation(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null,
  sources: GroundedSource[]
): JudgeView {
  const proc = buildProcedureMap(intent);
  const materialFacts = analysis?.materialFacts?.length
    ? analysis.materialFacts
    : caseFile.facts.map((f) => f.text).slice(0, 5);

  const criticalMissing = caseFile.missingInfo.filter((m) => m.critical);
  const hasEvidence = caseFile.evidence.length > 0;
  const readyForJudgment = criticalMissing.length === 0 && hasEvidence && materialFacts.length > 0;

  const questions = [
    "ما سند العلاقة محل النزاع وتاريخ نشوئها؟",
    "هل تتوافر شروط قبول الدعوى (الصفة/المصلحة/الميعاد)؟",
    "ما الدليل المباشر على الواقعة محل الإثبات؟",
    "هل جرى الوفاء كلياً أو جزئياً، ومتى؟",
  ];
  if (sources[0]) questions.push(`ما مدى انطباق ${sources[0].reference} على الواقعة محل النظر؟`);

  const gaps: string[] = [...criticalMissing.map((m) => m.label)];
  if (!hasEvidence) gaps.push("لم تُجرد البيّنات بعد لمناقشتها");
  if (gaps.length === 0) gaps.push("لا نواقص مؤثّرة ظاهرة — تُراجع البيّنة قبل القفل");

  const score = analysis?.caseStrengthScore ?? 50;
  const draftReasoning = [
    "بحث توافر شروط قبول الدعوى والاختصاص قبل الموضوع",
    "تقدير ثبوت العلاقة محل النزاع بحسب المستندات",
    "بحث قيام الواقعة محل الإثبات ونسبتها للمدّعى عليه",
  ];
  if (sources[0]) draftReasoning.push(`تطبيق ${sources[0].reference} على الواقعة الثابتة`);
  draftReasoning.push("تقدير الطلبات ومقدارها في ضوء البيّنة المقبولة");

  const draftRuling =
    score >= 65
      ? "منطوق محتمل (غير ملزم): إجابة المدّعي إلى بعض طلباته بقدر ما يثبت بالبيّنة"
      : score <= 40
        ? "منطوق محتمل (غير ملزم): عدم ثبوت الدعوى وردّها مع بقاء الحق عند توافر البيّنة"
        : "منطوق محتمل (غير ملزم): الفصل بحسب ما يترجّح بعد تقديم البيّنات وتمكين الأطراف";

  return {
    disputeSubject: `محل النزاع ينحصر في: ${intent.disputeType}${intent.claims ? ` — الطلب: ${intent.claims}` : ""}.`,
    materialFacts,
    burdenOfProof: analysis?.burdenOfProof ?? "البيّنة على من ادّعى واليمين على من أنكر.",
    judgeQuestions: proc.defensesHeardFirst.length ? [...questions] : questions,
    readyForJudgment,
    readinessReason: readyForJudgment
      ? "اكتملت العناصر الأولية؛ تُراجع البيّنة قبل القفل"
      : "لا تصلح للحكم بعد لوجود نواقص مؤثّرة قبل قفل باب المرافعة",
    gapsBeforeClosing: gaps,
    draftReasoning,
    draftRuling,
    disclaimer: "هذه محاكاة تعليمية لتفكير القاضي، وليست حكماً قضائياً فعلياً ولا ملزماً.",
  };
}

/**
 * المحكّم: يبدأ من اتفاق التحكيم ونطاقه وتشكيل الهيئة والاختصاص، لا من القضاء العام.
 */
export function buildArbitrationSimulation(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null
): ArbitrationView {
  const hasClause = intent.hasArbitrationClause === true || intent.track === "ARBITRATION";
  const issues = analysis?.materialFacts?.slice(0, 4) ?? caseFile.facts.map((f) => f.text).slice(0, 4);

  return {
    agreementCheck: hasClause
      ? "يُفحص اتفاق التحكيم: كتابته وصحته وأهلية أطرافه ووضوح إرادتهم في التحكيم."
      : "لم يتبيّن وجود اتفاق تحكيم؛ يلزم إبراز بند/اتفاق التحكيم قبل بحث الاختصاص.",
    scope: "يُحدّد نطاق شرط التحكيم: هل يشمل هذا النزاع موضوعاً وأطرافاً؟ وما المسائل المستثناة؟",
    tribunalFormation: "تشكيل الهيئة: عدد المحكّمين وطريقة تعيينهم وقبولهم واستقلالهم وحيادهم.",
    jurisdiction: "تبتّ الهيئة في اختصاصها (مبدأ الاختصاص بالاختصاص)، وتفصل في الدفع بعدم الاختصاص.",
    applicableLaw: "تحديد النظام/القانون الواجب التطبيق على الموضوع والإجراءات بحسب اتفاق الطرفين.",
    procedure: [
      "تبادل بيان الدعوى وبيان الدفاع ضمن المواعيد",
      "تبادل المستندات وتحرير المسائل محل النزاع",
      "جلسات المرافعة وسماع الخبرة عند الحاجة",
      "إقفال باب المرافعة وإصدار الحكم خلال الميعاد النظامي",
    ],
    proceduralOrder: [
      "أمر إجرائي (1): جدول المواعيد وتبادل المذكرات",
      "أمر إجرائي (2): تنظيم تقديم المستندات والخبرة",
      "أمر إجرائي (3): تحديد جلسة المرافعة الختامية",
    ],
    issues: issues.length ? issues : ["تحرير المسائل محل الفصل بعد اكتمال البيانات"],
    draftAwardNote:
      "تُصاغ مسودة حكم التحكيم بعد اكتمال الإجراءات: تتضمّن الاتفاق والاختصاص والإجراءات والطلبات والدفوع والأسباب والمنطوق.",
    disclaimer: TRAINING_DISCLAIMER,
  };
}
