// ─────────────────────────────────────────────────────────────────────────────
// §15 — مُصنّف المهمّة القضائيّة (Judicial Task Characterizer)
//
// تصنيفٌ حتميّ (بلا نموذج) يشتقّ الدور والمسار والمرحلة ووظيفة المستند من إشارات
// المدخل. PR1 يقدّم الهيكل + اشتقاقًا أوّليًّا بالكلمات الدالّة؛ تُرقّيه PR4/PR5 بإشارات
// ملفّ القضية الفعليّة. لا يُصدر حكمًا — يهيّئ المسار فقط.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CourtTrack,
  DocumentFunction,
  JudicialRole,
  JudicialTaskCharacterization,
  JudicialVoiceProfile,
  LitigationStage,
} from "./contracts";

export interface CharacterizationInput {
  role?: JudicialRole;
  courtTrack?: CourtTrack;
  litigationStage?: LitigationStage;
  documentFunction?: DocumentFunction;
  /** نصّ الطلب/المهمّة — تُشتقّ منه الإشارات حين لا تُمرّر صراحةً. */
  text?: string;
}

const TRACK_HINTS: Array<[CourtTrack, RegExp]> = [
  ["COMMERCIAL", /تجاري|شركة|إفلاس|أوراق تجارية|منازعة تجارية/],
  ["LABOR", /عمالي|عامل|صاحب عمل|أجور|فصل تعسفي|مكتب العمل/],
  ["PERSONAL_STATUS", /أحوال شخصية|طلاق|نفقة|حضانة|نكاح|ميراث|خلع/],
  ["CRIMINAL", /جزائي|جنائي|عقوبة|تعزير|نيابة|جريمة/],
  ["EXECUTION", /تنفيذ|سند تنفيذي|منازعة تنفيذ|حجز/],
  ["ARBITRATION", /تحكيم|هيئة التحكيم|حكم التحكيم|شرط التحكيم/],
  ["ADMINISTRATIVE", /إداري|ديوان المظالم|قرار إداري|إلغاء قرار/],
];

const STAGE_HINTS: Array<[LitigationStage, RegExp]> = [
  ["APPEAL", /استئناف|لائحة اعتراض/],
  ["CASSATION", /نقض|المحكمة العليا/],
  ["RECONSIDERATION", /التماس إعادة النظر|التماس/],
  ["EXECUTION", /تنفيذ|سند تنفيذي/],
  ["EVIDENCE", /إثبات|بينة|شهود|خبرة|يمين/],
  ["JUDGMENT", /الحكم|المنطوق|التسبيب|مشروع حكم/],
  ["PLEADING", /مذكرة|جواب|دفوع|رد/],
  ["FILING", /صحيفة دعوى|رفع دعوى|تحرير الدعوى/],
];

const FUNCTION_HINTS: Array<[DocumentFunction, RegExp]> = [
  ["OBJECTION", /استئناف|نقض|التماس|اعتراض/],
  ["DISPOSITION", /منطوق|حكمت|تقضي/],
  ["REASONING", /تسبيب|أسباب|حيثيات/],
  ["RECORD", /محضر|ضبط|جلسة/],
  ["ANSWER_FORMULATION", /مذكرة جوابية|جواب|رد على الدعوى/],
  ["CLAIM_FORMULATION", /صحيفة دعوى|تحرير الدعوى|لائحة دعوى/],
  ["EVIDENCE_ANALYSIS", /مصفوفة إثبات|تحليل الأدلة|عبء الإثبات/],
  ["ISSUE_MAP", /خريطة مسائل|المسائل/],
];

function firstMatch<T>(text: string, table: Array<[T, RegExp]>): T | undefined {
  for (const [value, re] of table) if (re.test(text)) return value;
  return undefined;
}

/** يشتقّ توصيفًا أوّليًّا للمهمّة؛ القيم غير المُشتقّة تأخذ افتراضًا محافظًا آمنًا. */
export function characterizeJudicialTask(input: CharacterizationInput): JudicialTaskCharacterization {
  const text = input.text ?? "";
  const role: JudicialRole = input.role ?? "RESEARCHER";
  const courtTrack: CourtTrack = input.courtTrack ?? firstMatch(text, TRACK_HINTS) ?? "GENERAL";
  const litigationStage: LitigationStage = input.litigationStage ?? firstMatch(text, STAGE_HINTS) ?? "PLEADING";
  const documentFunction: DocumentFunction = input.documentFunction ?? firstMatch(text, FUNCTION_HINTS) ?? "EVIDENCE_ANALYSIS";

  return {
    role,
    courtTrack,
    litigationStage,
    documentFunction,
    // مواقف محافظة: لا نفترض اكتمال الأدلّة ولا جاهزيّة الموضوع قبل الفحص (§15).
    evidencePosture: "NO_EVIDENCE",
    proceduralPosture: "INSUFFICIENT_FACTS",
    riskLevel: riskForFunction(documentFunction, role),
  };
}

/** §14 — صوت الدور المطلوب من الدور ووظيفة المستند. */
export function voiceProfileFor(role: JudicialRole, _fn: DocumentFunction): JudicialVoiceProfile {
  if (role === "JUDGE" || role === "JUDICIAL_ASSISTANT") return "JUDICIAL_BENCH_RESTRICTED";
  if (role === "LAWYER" || role === "PARTY") return "JUDICIAL_PARTY";
  return "JUDICIAL_RESEARCH_AND_TRAINING";
}

function riskForFunction(fn: DocumentFunction, role: JudicialRole): JudicialTaskCharacterization["riskLevel"] {
  // مخرجات المنطوق/التسبيب/المحضر بصوت المحكمة أعلى خطرًا (§15/§14).
  const highRisk: DocumentFunction[] = ["DISPOSITION", "REASONING", "RECORD", "PROCEDURAL_DECISION"];
  if (role === "JUDGE" && highRisk.includes(fn)) return "RESTRICTED";
  if (highRisk.includes(fn)) return "HIGH";
  return "MEDIUM";
}
