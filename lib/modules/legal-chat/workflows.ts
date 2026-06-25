// ─────────────────────────────────────────────────────────────────────────────
// LegalWorkflowEngine + LegalPlaybookEngine.
// مسارات عمل قانونية قابلة لإعادة الاستخدام: مدخلات مطلوبة → أسئلة → تحقق من النواقص
// → استرجاع → تحليل → مخرج أولي → مراجعة → مخرج نهائي. وplaybooks لمعالجة أنواع القضايا.
// ─────────────────────────────────────────────────────────────────────────────
import type { IntentResult, RequestedOutput, SimulationCaseFile, WorkflowRunView, WorkflowStep } from "./types";

export interface WorkflowDef {
  id: string;
  name: string;
  purpose: string;
  /** المخرج الذي يقود إليه هذا المسار. */
  outputType: RequestedOutput;
  requiredInputs: { key: string; label: string }[];
  steps: string[];
  checklist: string[];
  reviewRequired: boolean;
}

export const WORKFLOWS: WorkflowDef[] = [
  {
    id: "answer-memo-commercial",
    name: "إعداد مذكرة جوابية تجارية",
    purpose: "بناء مذكرة جوابية للمدعى عليه في نزاع تجاري.",
    outputType: "ANSWER_MEMO",
    requiredInputs: [
      { key: "role", label: "صفة المستخدم" },
      { key: "facts", label: "وقائع الدعوى" },
      { key: "documents", label: "بيان المستندات" },
    ],
    steps: ["استلام الدعوى وتحرير ملخصها", "حصر الدفوع الشكلية", "حصر الدفوع الموضوعية", "مناقشة مستندات الخصم", "الرد على الطلبات", "صياغة الطلبات الختامية"],
    checklist: ["فُصلت الدفوع الشكلية عن الموضوعية", "نوقشت مستندات الخصم", "رُبط كل دفع بسنده", "حُدّدت الطلبات الختامية"],
    reviewRequired: true,
  },
  {
    id: "analyze-judgment-appeal",
    name: "تحليل حكم لغرض الاستئناف",
    purpose: "استخراج مواضع الخطأ في الحكم وبناء أسباب الاعتراض.",
    outputType: "APPEAL_MEMO",
    requiredInputs: [
      { key: "judgment", label: "بيانات الحكم (المنطوق/الأسباب/التاريخ)" },
      { key: "facts", label: "موجز الوقائع" },
    ],
    steps: ["استخراج بيانات الحكم والمنطوق", "استخراج أسباب الحكم", "تحديد مواضع الخطأ", "تصنيف الخطأ (نظامي/إجرائي/إثباتي)", "ربط الخطأ بالنظام", "صياغة أسباب الاعتراض والطلبات"],
    checklist: ["حُدِّد المنطوق والأسباب", "صُنّفت مواضع الخطأ", "رُبط كل سبب بالنظام", "حُدّدت الطلبات"],
    reviewRequired: true,
  },
  {
    id: "evidence-plan",
    name: "إعداد خطة إثبات",
    purpose: "ربط كل واقعة بدليلها وعبء إثباتها والنقص والإجراء.",
    outputType: "EVIDENCE_PLAN",
    requiredInputs: [
      { key: "facts", label: "الوقائع محل الإثبات" },
      { key: "documents", label: "البيّنات المتاحة" },
    ],
    steps: ["تحديد الوقائع المنتِجة", "تحديد عبء الإثبات لكل واقعة", "جرد الأدلة المتاحة", "تقدير قوة كل دليل", "تحديد النقص والإجراء المقترح"],
    checklist: ["حُدّدت الوقائع المنتِجة", "وُزّع عبء الإثبات", "قُدّرت قوة الأدلة", "حُدّد النقص والإجراء"],
    reviewRequired: false,
  },
  {
    id: "arbitration-clause-check",
    name: "فحص شرط التحكيم",
    purpose: "تقدير أثر شرط التحكيم على اختصاص القضاء.",
    outputType: "ARBITRATION_CLAUSE_CHECK",
    requiredInputs: [{ key: "documents", label: "نص العقد وبند التحكيم" }],
    steps: ["إبراز نص بند التحكيم", "فحص صحة الشرط وكتابته", "تحديد نطاق الشرط", "تقدير الاختصاص (تحكيم/قضاء)", "بيان الأثر الإجرائي"],
    checklist: ["أُبرز نص الشرط", "فُحصت صحته", "حُدّد نطاقه", "بُيّن أثره على الاختصاص"],
    reviewRequired: true,
  },
  {
    id: "contract-review",
    name: "مراجعة عقد مقاولة/توريد",
    purpose: "استخراج البنود والمخاطر والتوصيات قبل التعاقد أو النزاع.",
    outputType: "CONTRACT_REVIEW",
    requiredInputs: [{ key: "documents", label: "نص العقد" }],
    steps: ["تلخيص العقد", "استخراج الأطراف والالتزامات", "استخراج المدة والمقابل", "فحص الشرط الجزائي وشرط التحكيم والفسخ", "جدول المخاطر والتوصيات"],
    checklist: ["لُخّص العقد", "استُخرجت الالتزامات", "فُحصت البنود الحرجة", "أُنتج جدول المخاطر"],
    reviewRequired: true,
  },
  {
    id: "pre-filing-check",
    name: "فحص ملف دعوى قبل القيد",
    purpose: "التحقق من جاهزية الملف قبل رفع الدعوى.",
    outputType: "CASE_STRENGTH",
    requiredInputs: [
      { key: "role", label: "الصفة" },
      { key: "facts", label: "الوقائع" },
      { key: "claims", label: "الطلبات" },
    ],
    steps: ["فحص الصفة والمصلحة", "فحص الاختصاص", "فحص شروط القبول", "تقدير قوة البيّنة", "تحديد النواقص قبل القيد"],
    checklist: ["تأكدت الصفة والمصلحة", "تحدّد الاختصاص", "اكتملت شروط القبول", "قُدّرت قوة البيّنة"],
    reviewRequired: false,
  },
];

export interface PlaybookDef {
  id: string;
  name: string;
  disputeKeyword: string; // كلمة تدلّ على نوع النزاع
  steps: string[];
  warnings: string[];
}

export const PLAYBOOKS: PlaybookDef[] = [
  {
    id: "commercial-claim",
    name: "Playbook: مطالبة مالية تجارية",
    disputeKeyword: "مطالبة مالية",
    steps: [
      "فحص الصفة",
      "فحص الاختصاص التجاري",
      "فحص العلاقة العقدية",
      "فحص الفواتير",
      "فحص التسليم",
      "فحص الاعتراضات",
      "فحص السداد",
      "فحص الإخلال",
      "فحص عبء الإثبات",
      "توليد مذكرة أو رد",
    ],
    warnings: ["تحقّق من شرط التحكيم قبل الدعوى", "لا تُختلق أرقام فواتير أو مبالغ"],
  },
  {
    id: "judgment-objection",
    name: "Playbook: اعتراض على حكم",
    disputeKeyword: "اعتراض",
    steps: [
      "استخراج بيانات الحكم",
      "استخراج المنطوق",
      "استخراج الأسباب",
      "تحديد مواضع الخطأ",
      "تصنيف الخطأ",
      "ربط الخطأ بالنظام أو الإثبات",
      "صياغة سبب الاعتراض",
      "صياغة الطلبات",
    ],
    warnings: ["تأكّد من ميعاد الاعتراض", "ميّز الاعتراض على التسبيب عن الاعتراض على الإجراء"],
  },
];

/** يطابق مسار العمل المناسب بحسب نوع المخرج المطلوب. */
export function matchWorkflow(intent: IntentResult): WorkflowDef | null {
  return (
    WORKFLOWS.find((w) => w.outputType === intent.requestedOutput) ??
    (intent.requestedOutput === "REPLY_MEMO" ? WORKFLOWS.find((w) => w.id === "answer-memo-commercial") ?? null : null)
  );
}

/** يطابق Playbook بحسب نوع النزاع/المخرج. */
export function matchPlaybook(intent: IntentResult): PlaybookDef | null {
  if (intent.hasJudgment || intent.requestedOutput === "OBJECTION" || intent.requestedOutput === "APPEAL_MEMO")
    return PLAYBOOKS.find((p) => p.id === "judgment-objection") ?? null;
  if (intent.disputeType.includes("مالية") || intent.track === "COMMERCIAL")
    return PLAYBOOKS.find((p) => p.id === "commercial-claim") ?? null;
  return null;
}

/** يشغّل مسار العمل على ملف القضية: يحدّد المُنجَز والناقص والخطوة التالية. */
export function runWorkflow(def: WorkflowDef, caseFile: SimulationCaseFile, intent: IntentResult): WorkflowRunView {
  const has = {
    role: caseFile.userRole !== "UNKNOWN",
    facts: caseFile.facts.length >= 2,
    documents: caseFile.evidence.length > 0,
    claims: !!caseFile.claims,
    judgment: intent.hasJudgment,
  };
  const missingInputs = def.requiredInputs
    .filter((inp) => has[inp.key as keyof typeof has] === false)
    .map((inp) => inp.label);

  // الخطوات الأولى تُعدّ منجزة إذا توفّرت مدخلاتها الأساسية.
  const baseDone = Math.max(1, def.steps.length - missingInputs.length - 2);
  const steps: WorkflowStep[] = def.steps.map((title, i) => ({
    title,
    done: i < baseDone && missingInputs.length === 0,
    detail: i < baseDone ? "أُنجزت على ضوء المعطيات المتاحة" : "بانتظار استكمال المدخلات",
  }));

  const checklist = def.checklist.map((item, i) => ({ item, ok: i < baseDone && missingInputs.length === 0 }));
  const nextStep = missingInputs.length
    ? `استكمل: ${missingInputs[0]}`
    : steps.find((s) => !s.done)?.title ?? "جاهز للمراجعة البشرية ثم المخرج النهائي";

  return {
    name: def.name,
    purpose: def.purpose,
    steps,
    checklist,
    missingInputs,
    nextStep,
    reviewRequired: def.reviewRequired,
  };
}
