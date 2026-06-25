// ─────────────────────────────────────────────────────────────────────────────
// Compare Strategies + Explain My Answer.
// مقارنة استراتيجيات (دفاع شكلي/موضوعي/صلح/خبرة/اعتراض/تحكيم) مع مزايا ومخاطر،
// وبطاقة شرح تفصّل الوقائع والمصادر والافتراضات وأسباب الترجيح وما قد يغيّر النتيجة.
// ─────────────────────────────────────────────────────────────────────────────
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import type { ExplainView, GroundedSource, IntentResult, SimulationCaseFile, StrategyRow } from "./types";

/** يبني مقارنة استراتيجيات ملائمة لموقف المستخدم. */
export function buildStrategyComparison(intent: IntentResult): StrategyRow[] {
  const defendant = intent.userRole === "DEFENDANT" || intent.userRole === "DEFENDANT_LAWYER";
  const rows: StrategyRow[] = [];

  rows.push({
    strategy: "الدفاع الشكلي (الاختصاص/القبول)",
    advantages: "قد يُنهي الدعوى دون الدخول في الموضوع",
    risks: "إن رُدّ الدفع تستمر الدعوى وقد يُضعف الموقف",
    requirements: "سند نظامي للدفع (اختصاص/ميعاد/صفة)",
    assessment: intent.track === "UNKNOWN" ? "مجدٍ مبدئياً لعدم استقرار التكييف" : "أقل جدوى مع وضوح المسار",
  });
  rows.push({
    strategy: "الدفاع الموضوعي",
    advantages: "يعالج أصل النزاع ويحسم الموقف",
    risks: "يتطلب بيّنة قوية ومناقشة دقيقة",
    requirements: "بيّنة مرتبطة بالوقائع المنتِجة",
    assessment: "الأساس في أغلب القضايا",
  });
  rows.push({
    strategy: "الصلح والتسوية",
    advantages: "سرعة وتوفير كلفة ومخاطر التقاضي",
    risks: "تنازل جزئي عن الطلبات",
    requirements: "استعداد الطرف الآخر وحدود تفاوض واضحة",
    assessment: intent.claimValue ? "مناسب عند تقارب المراكز" : "يُدرس بحسب قوة البيّنة",
  });
  rows.push({
    strategy: "طلب الخبرة",
    advantages: "حسم المسائل الفنية/المحاسبية",
    risks: "تأخير وكلفة، والنتيجة غير مضمونة",
    requirements: "مسألة فنية تستدعي الخبرة",
    assessment: intent.track === "COMMERCIAL" ? "مفيد في النزاع المحاسبي" : "بحسب طبيعة النزاع",
  });
  if (intent.hasJudgment || defendant) {
    rows.push({
      strategy: "الاعتراض على الحكم",
      advantages: "فرصة لتصحيح خطأ نظامي/إجرائي",
      risks: "رهن توافر أسباب الاعتراض والميعاد",
      requirements: "بيان مواضع الخطأ وربطها بالنظام",
      assessment: intent.hasJudgment ? "متاح بحسب طريق الاعتراض" : "غير مطروح قبل صدور حكم",
    });
  }
  if (intent.hasArbitrationClause || intent.track === "ARBITRATION") {
    rows.push({
      strategy: "اللجوء للتحكيم",
      advantages: "خصوصية وسرعة وخبرة متخصصة",
      risks: "كلفة وقيود الطعن في حكم التحكيم",
      requirements: "اتفاق تحكيم صحيح ونافذ",
      assessment: "ملائم عند وجود شرط تحكيم صحيح",
    });
  }
  return rows;
}

/** يبني بطاقة «اشرح لماذا وصلت لهذه النتيجة». */
export function buildExplain(
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  analysis: CaseAnalysisResult | null,
  sources: GroundedSource[]
): ExplainView {
  const facts = (analysis?.materialFacts?.length ? analysis.materialFacts : caseFile.facts.map((f) => f.text)).slice(0, 5);
  const assumptions: string[] = [];
  if (caseFile.userRole === "UNKNOWN") assumptions.push("الصفة غير مؤكدة — افتُرضت من سياق الرسالة");
  if (caseFile.track === "UNKNOWN") assumptions.push("المسار غير مؤكد — افتُرض من أقرب دلالة");
  if (intent.hasArbitrationClause === null) assumptions.push("افتُرض عدم وجود شرط تحكيم لعدم وروده");
  if (caseFile.evidence.length === 0) assumptions.push("لم تُجرد البيّنات بعد");

  const reasons: string[] = [
    "بُدئ بفحص الصفة والمصلحة والاختصاص قبل الموضوع",
    sources.length ? "استُند إلى نصوص متحقَّقة من النواة القانونية" : "لم تُسترجع نصوص كافية فاعتُمد التحفّظ",
    analysis ? `قُدّرت قوة القضية بـ ${analysis.caseStrengthScore}/100 من اكتمال البيّنة والإسناد` : "قُدّر الموقف من المعطيات المتاحة",
  ];

  const whatWouldChange: string[] = [
    "إبراز مستندات مؤيِّدة (عقد/فواتير/مراسلات/محضر استلام)",
    "تحديد المرحلة الإجرائية والاختصاص بدقة",
  ];
  if (intent.hasArbitrationClause === null) whatWouldChange.push("تأكيد وجود/عدم وجود شرط تحكيم");
  if (intent.hasJudgment) whatWouldChange.push("بيانات الحكم الكاملة (المنطوق/الأسباب/التبليغ)");

  return {
    facts,
    sources: sources.slice(0, 6).map((s) => `${s.reference}${s.explicit ? "" : " (يحتاج تحققاً)"}`),
    assumptions: assumptions.length ? assumptions : ["لا افتراضات مؤثّرة — بُني على المعطيات الصريحة"],
    reasons,
    confidence: intent.confidence,
    whatWouldChange,
  };
}
