// المرحلة الإجرائية والقبول الشكلي: منطق حتمي للاختصاص والقبول والقرارات الإجرائية
// بحسب المرحلة (ابتدائي/استئناف/تمييز)، دون اختلاق مصادر.
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import type { JudicialSimulationInput, LitigationStage } from "./types";

// تخمين جهة الاختصاص من نوع القضية (تقدير أولي لا يُلزم).
const COURT_RULES: { keys: string[]; court: string }[] = [
  { keys: ["تجاري", "تجارية", "شركة", "شركات"], court: "المحكمة التجارية" },
  { keys: ["عمالي", "عمل", "أجور", "راتب", "فصل تعسفي"], court: "المحكمة العمالية" },
  { keys: ["تنفيذ", "تنفيذي", "سند تنفيذي"], court: "محكمة/قاضي التنفيذ" },
  { keys: ["أحوال", "أسرة", "زواج", "طلاق", "حضانة", "نفقة"], court: "محكمة الأحوال الشخصية" },
  { keys: ["جزائي", "جنائي", "عقوبة"], court: "المحكمة الجزائية" },
  { keys: ["إداري", "إدارية", "ديوان المظالم"], court: "المحكمة الإدارية (ديوان المظالم)" },
  { keys: ["عقار", "عقاري", "ملكية", "إيجار"], court: "المحكمة العامة (الدائرة المختصة)" },
];

/** يقدّر جهة الاختصاص المحتملة من المدخلات (مع تفضيل ما أدخله المستخدم). */
export function guessJurisdiction(input: JudicialSimulationInput): string {
  if (input.jurisdiction?.trim()) return `${input.jurisdiction.trim()} (وفق ما أُدخل)`;
  const hay = `${input.caseType ?? ""} ${input.caseFacts ?? ""} ${input.claims ?? ""}`;
  for (const rule of COURT_RULES) {
    if (rule.keys.some((k) => hay.includes(k))) return `${rule.court} (تقدير أولي)`;
    }
  return "تتحدّد جهة الاختصاص بعد التكييف النهائي للنزاع (تقدير أولي).";
}

export interface ProceduralView {
  jurisdiction: string;
  admissibilityNotes: string[];
  defensesHeardFirst: string[];
  proceduralDecisions: string[];
  clarificationsNeeded: string[];
}

const STAGE_DECISIONS: Record<LitigationStage, string[]> = {
  FIRST_INSTANCE: [
    "التحقق من اكتمال أركان صحيفة الدعوى وصحة التبليغ.",
    "تكليف المدّعي بإثبات دعواه وتقديم بيّناته.",
    "تمكين المدّعى عليه من الجواب وتقديم مستنداته.",
    "النظر في طلبات الإحالة إلى خبير عند الحاجة.",
  ],
  APPEAL: [
    "التحقق من قبول الاستئناف شكلاً (الميعاد والصفة).",
    "حصر أسباب الاعتراض ومدى تعلّقها بالوقائع والتطبيق.",
    "إعادة فحص ما طُعن فيه دون غيره.",
  ],
  CASSATION: [
    "التحقق من قبول طلب التمييز شكلاً.",
    "قصر النظر على مخالفة النظام أو الخطأ في تطبيقه أو الإخلال بالإجراءات.",
    "عدم إعادة تقدير الوقائع المحسومة موضوعاً.",
  ],
};

/** يبني القبول الشكلي والقرارات الإجرائية بحسب المرحلة (حتمي، بلا اختلاق سند). */
export function buildProceduralView(input: JudicialSimulationInput, analysis: CaseAnalysisResult): ProceduralView {
  const stage: LitigationStage = input.litigationStage ?? "FIRST_INSTANCE";
  const jurisdiction = guessJurisdiction(input);

  const admissibilityNotes: string[] = [
    "التحقق من الصفة والمصلحة في الدعوى.",
    "التحقق من الاختصاص النوعي والمكاني.",
    "التحقق من المواعيد وعدم سقوط الحق بالتقادم.",
  ];
  if (stage === "APPEAL") admissibilityNotes.push("التحقق من إيداع الاعتراض ضمن ميعاد الاستئناف.");
  if (stage === "CASSATION") admissibilityNotes.push("التحقق من توافر أسباب التمييز النظامية دون الموضوع.");

  // الدفوع الشكلية/الإجرائية تُنظر أولاً، ثم الموضوعية.
  const order = (c: string) => (c === "PROCEDURAL" ? 0 : c === "FORMAL" ? 1 : 2);
  const fromAnalysis = [...analysis.potentialDefenses]
    .sort((a, b) => order(a.category) - order(b.category))
    .filter((d) => d.category === "PROCEDURAL" || d.category === "FORMAL")
    .map((d) => d.text);
  const defensesHeardFirst = fromAnalysis.length
    ? fromAnalysis
    : [
        "التحقق من الاختصاص قبل الموضوع.",
        "التحقق من شروط قبول الدعوى (الصفة/المصلحة/الميعاد).",
      ];

  const proceduralDecisions = [...STAGE_DECISIONS[stage]];

  const clarificationsNeeded: string[] = ["استيضاح سند العلاقة محل النزاع وتاريخ نشوئها."];
  if (!input.evidenceSummary?.trim()) clarificationsNeeded.push("تقديم ملخّص بيّنات واضح ومرتّب.");
  if (!input.documents?.length) clarificationsNeeded.push("إرفاق المستندات والمحرّرات المؤيِّدة.");
  analysis.weaknesses.slice(0, 2).forEach((w) => clarificationsNeeded.push(`استيضاح بشأن: ${w}`));

  return { jurisdiction, admissibilityNotes, defensesHeardFirst, proceduralDecisions, clarificationsNeeded };
}
