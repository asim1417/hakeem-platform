// ─────────────────────────────────────────────────────────────────────────────
// قواميس الكشف العربية (Taxonomy) لمحرك فهم النيّة.
// كلها بيانات حتمية قابلة للتكرار — تعمل دون اتصال بمزوّد ذكاء، وتفهم العامية
// والأخطاء الإملائية الشائعة. لا تختلق مصادر؛ تكتفي بتصنيف لغة المستخدم.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  LegalTrack,
  ProceduralStage,
  RequestedOutput,
  SimulationMode,
  UserLegalRole,
} from "./types";

/** يُطبّع النص العربي: يحذف التشكيل، ويوحّد الألف والهاء/التاء واللام. */
export function normalizeArabic(text: string): string {
  return (text || "")
    .replace(/[ً-ْـ]/g, "") // تشكيل + تطويل
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/** يفحص وجود أيٍّ من الكلمات (بعد التطبيع) داخل النص المُطبّع. */
export function hasAny(normalizedHaystack: string, keywords: string[]): boolean {
  return keywords.some((k) => matchWord(normalizedHaystack, normalizeArabic(k)));
}

const _boundaryCache = new Map<string, RegExp>();
const AR = "\\u0621-\\u064A"; // حروف عربية

/**
 * مطابقة على حدود الكلمة (تسمح ببادئات: و/ف/ب/ك/ل/ال…) لمنع المطابقة الجزئية الخاطئة.
 * مثال: «معقدة» لا تطابق «عقد»، و«مدينة» لا تطابق «دين» — بينما «العقد» يطابق «عقد».
 */
export function matchWord(haystack: string, keyword: string): boolean {
  if (!keyword) return false;
  // العبارات متعددة الكلمات تُطابَق كما هي (مع حدّ بصري في الطرفين).
  let re = _boundaryCache.get(keyword);
  if (!re) {
    const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<![${AR}])(?:بال|وال|فال|كال|لل|ال|و|ف|ب|ك|ل)?${esc}(?![${AR}])`);
    _boundaryCache.set(keyword, re);
  }
  return re.test(haystack);
}

export interface KeywordRule<T> {
  value: T;
  keywords: string[];
  weight?: number; // وزن ترجيح عند التعارض (الأعلى يفوز)
}

// ── صفة المستخدم ──
export const ROLE_RULES: KeywordRule<UserLegalRole>[] = [
  { value: "PLAINTIFF_LAWYER", keywords: ["محامي المدعي", "وكيل المدعي", "انا محامي عن المدعي"], weight: 3 },
  { value: "DEFENDANT_LAWYER", keywords: ["محامي المدعى عليه", "وكيل المدعى عليه", "انا محامي عن المدعى عليه"], weight: 3 },
  { value: "ARBITRATOR", keywords: ["انا محكم", "محكم", "هيئة التحكيم", "بصفتي محكم", "وش اقرر في الجلسة"], weight: 2 },
  { value: "JUDGE_TRAINEE", keywords: ["انا قاضي", "بصفتي قاضي", "قاضي افتراضي", "كقاضي"], weight: 2 },
  { value: "DEFENDANT", keywords: ["ابغى ارد على دعوى", "اريد الرد على دعوى", "جاني تبليغ", "رفعوا علي", "رفع علي", "مرفوع علي", "مدعى علي", "انا المدعى عليه", "صدر ضدي", "خصمي يطالبني"], weight: 1 },
  { value: "PLAINTIFF", keywords: ["ابغى ارفع دعوى", "اريد رفع دعوى", "ابي اقاضي", "انا المدعي", "اطالب", "حقي عند", "ابغى اطالب"], weight: 1 },
  { value: "CONSULTANT", keywords: ["استشارة", "مستشار", "ابغى رايك", "ما رايك القانوني"], weight: 1 },
  { value: "SETTLEMENT_SEEKER", keywords: ["ابغى صلح", "نتصالح", "تسويه", "تسوية ودية", "صلح"], weight: 1 },
  { value: "PRE_LITIGATION", keywords: ["قبل ما ارفع", "قبل التقاضي", "احلل موقفي", "تحليل موقفي", "هل لي حق"], weight: 1 },
  { value: "RESEARCHER", keywords: ["باحث", "بحث قانوني", "للدراسة", "اكاديمي"], weight: 1 },
];

// ── المسار القضائي ──
export const TRACK_RULES: KeywordRule<LegalTrack>[] = [
  { value: "ARBITRATION", keywords: ["تحكيم", "شرط تحكيم", "اتفاق تحكيم", "هيئة التحكيم", "حكم تحكيمي"], weight: 3 },
  { value: "CRIMINAL", keywords: ["جزائي", "جنائي", "جريمه", "تهمه", "متهم", "نيابه", "ادعاء عام", "توقيف", "قبض", "تفتيش", "بلاغ", "عقوبه", "حق عام", "حق خاص"], weight: 3 },
  { value: "LABOR", keywords: ["عمالي", "عمل", "راتب", "اجور", "مكافاه نهايه الخدمه", "فصل تعسفي", "صاحب العمل", "عامل", "موظف"], weight: 2 },
  { value: "COMMERCIAL", keywords: ["تجاري", "تجاريه", "شركه", "شركات", "مقاوله", "توريد", "وكاله تجاريه", "امتياز تجاري", "سجل تجاري", "فاتوره", "كشف حساب", "بضاعه", "عقد تجاري"], weight: 2 },
  { value: "ADMINISTRATIVE", keywords: ["اداري", "اداريه", "ديوان المظالم", "جهه حكوميه", "قرار اداري", "الغاء قرار"], weight: 2 },
  { value: "PERSONAL_STATUS", keywords: ["احوال شخصيه", "اسره", "زواج", "طلاق", "حضانه", "نفقه", "خلع", "ميراث", "وصيه"], weight: 2 },
  { value: "EXECUTION", keywords: ["تنفيذ", "سند تنفيذي", "محكمه التنفيذ", "قاضي التنفيذ", "حجز", "ايقاف خدمات"], weight: 2 },
  { value: "CIVIL", keywords: ["مدني", "مدنيه", "عقد", "عقدي", "عقديه", "عقود", "التزام", "ضرر", "تعويض", "بيع", "ايجار", "عقار", "ملكيه", "دين", "قرض"], weight: 1 },
];

// ── المرحلة الإجرائية ──
export const STAGE_RULES: KeywordRule<ProceduralStage>[] = [
  { value: "RECONSIDERATION", keywords: ["التماس اعاده النظر", "التماس", "اعاده نظر"], weight: 4 },
  { value: "CASSATION", keywords: ["نقض", "تمييز", "المحكمه العليا", "طلب نقض"], weight: 4 },
  { value: "APPEAL", keywords: ["استئناف", "محكمه الاستئناف", "لائحه اعتراضيه", "اعتراض على الحكم"], weight: 4 },
  { value: "JUDGMENT_ISSUED", keywords: ["صدر الحكم", "صدر حكم", "حكم علي", "حكم ضدي", "ضدي حكم", "صدر ضدي", "صدر بحقي", "تسلمت الحكم", "نطق بالحكم"], weight: 3 },
  { value: "EXECUTION", keywords: ["تنفيذ الحكم", "محكمه التنفيذ", "سند تنفيذي"], weight: 3 },
  { value: "PLEADING_CLOSED", keywords: ["قفل باب المرافعه", "حجزت للحكم", "حجزت القضيه للحكم"], weight: 3 },
  { value: "EVIDENCE", keywords: ["مرحله الاثبات", "تقديم البينات", "ندب خبير", "شهود"], weight: 2 },
  { value: "FILING", keywords: ["قيد الدعوى", "ابغى ارفع", "اريد رفع دعوى", "تسجيل الدعوى"], weight: 2 },
  { value: "FIRST_INSTANCE", keywords: ["تحت النظر", "الجلسه القادمه", "عندي جلسه", "الدعوى منظوره", "ابتدائي"], weight: 1 },
  { value: "PRE_LITIGATION", keywords: ["قبل رفع الدعوى", "قبل التقاضي", "ما رفعت بعد", "قبل ما ارفع"], weight: 1 },
];

// ── نوع المخرج المطلوب ──
export const OUTPUT_RULES: KeywordRule<RequestedOutput>[] = [
  { value: "CLAIM_SHEET", keywords: ["صحيفه دعوى", "لائحه دعوى", "ابغى ارفع دعوى", "اعداد دعوى", "صياغه دعوى"], weight: 2 },
  { value: "ANSWER_MEMO", keywords: ["مذكره جوابيه", "ابغى ارد على دعوى", "رد على الدعوى", "جواب على الدعوى", "مذكره جواب"], weight: 2 },
  { value: "REPLY_MEMO", keywords: ["مذكره رد", "الرد على مذكره", "تعقيب"], weight: 2 },
  { value: "OPPONENT_DEFENSES", keywords: ["دفوع الخصم", "وش بيقول الطرف الثاني", "توقع دفوع", "ماذا سيدفع الخصم"], weight: 2 },
  { value: "CASE_STRENGTH", keywords: ["قوه القضيه", "تقييم القضيه", "هل قضيتي قويه", "فرص النجاح", "حظوظي"], weight: 2 },
  { value: "HEARING_SIMULATION", keywords: ["محاكاه جلسه", "حاكي الجلسه", "تمثيل جلسه", "محاكاه القضيه"], weight: 2 },
  { value: "PROCEDURAL_DECISION", keywords: ["قرار اجرائي", "وش اقرر", "قرار الجلسه"], weight: 2 },
  { value: "DRAFT_JUDGMENT", keywords: ["حكم افتراضي", "مسوده حكم", "صغ حكم", "اكتب حكم", "كيف سيحكم القاضي"], weight: 2 },
  { value: "APPEAL_MEMO", keywords: ["لائحه استئنافيه", "مذكره استئناف", "ابغى استانف"], weight: 3 },
  { value: "CASSATION_MEMO", keywords: ["طلب نقض", "مذكره نقض", "تمييز الحكم"], weight: 3 },
  { value: "RECONSIDERATION_MEMO", keywords: ["التماس اعاده نظر"], weight: 3 },
  { value: "OBJECTION", keywords: ["اعتراض على حكم", "ابغى اعترض", "الطعن في الحكم"], weight: 2 },
  { value: "ARBITRATION_AWARD", keywords: ["حكم تحكيم", "صغ حكم تحكيمي"], weight: 3 },
  { value: "ARBITRATION_ORDER", keywords: ["امر اجرائي تحكيمي", "امر اجرائي"], weight: 3 },
  { value: "ARBITRATION_CLAUSE_CHECK", keywords: ["فحص شرط تحكيم", "هل شرط التحكيم", "صحه شرط التحكيم"], weight: 3 },
  { value: "EVIDENCE_PLAN", keywords: ["خطه اثبات", "كيف اثبت", "ادله الاثبات", "خطه الادله"], weight: 2 },
  { value: "DOCUMENTS_PLAN", keywords: ["خطه مستندات", "وش المستندات المطلوبه"], weight: 2 },
  { value: "SETTLEMENT_PLAN", keywords: ["خطه صلح", "مسوده صلح", "تسويه وديه"], weight: 2 },
  { value: "CRIMINAL_DEFENSE", keywords: ["مذكره دفاع", "دفاع جزائي", "دفاع جنائي"], weight: 2 },
  { value: "CONTRACT_REVIEW", keywords: ["مراجعه عقد", "افحص العقد", "حلل العقد", "مراجعه العقد"], weight: 2 },
  { value: "LEGAL_ANALYSIS", keywords: ["تحليل قانوني", "حلل القضيه", "تحليل الموقف", "تحليل"], weight: 1 },
];

// ── إشارات وجود حكم (تحوّل المنطق إلى مسار اعتراض) ──
export const JUDGMENT_SIGNALS = [
  "صدر الحكم", "صدر حكم", "حكم علي", "حكم ضدي", "ضدي حكم", "صدر ضدي", "صدر بحقي", "صدر علي حكم",
  "تسلمت الحكم", "نطق بالحكم", "الحكم الابتدائي", "منطوق الحكم", "حيثيات الحكم", "بلغت بالحكم",
];

// ── إشارات شرط التحكيم ──
export const ARBITRATION_CLAUSE_SIGNALS = ["شرط تحكيم", "بند تحكيم", "اتفاق تحكيم", "شرط التحكيم"];

// ── إشارات طلب الاستعجال (مسودة أولية رغم النقص) ──
export const RUSH_SIGNALS = ["بسرعه", "اي شي بسرعه", "مستعجل", "الحين", "بسرعة", "ضروري الحين"];

// ── تسميات عربية للعرض ──
export const ROLE_LABELS: Record<UserLegalRole, string> = {
  PLAINTIFF: "مدّعٍ",
  DEFENDANT: "مدّعى عليه",
  PLAINTIFF_LAWYER: "محامي المدعي",
  DEFENDANT_LAWYER: "محامي المدعى عليه",
  CONSULTANT: "مستشار",
  ARBITRATOR: "محكّم",
  JUDGE_TRAINEE: "قاضٍ افتراضي (تدريب)",
  RESEARCHER: "باحث",
  SETTLEMENT_SEEKER: "طرف يطلب الصلح",
  PRE_LITIGATION: "تحليل موقف قبل التقاضي",
  UNKNOWN: "غير محددة",
};

export const TRACK_LABELS: Record<LegalTrack, string> = {
  CIVIL: "مدني",
  COMMERCIAL: "تجاري",
  LABOR: "عمالي",
  CRIMINAL: "جزائي",
  ADMINISTRATIVE: "إداري",
  PERSONAL_STATUS: "أحوال شخصية",
  ARBITRATION: "تحكيم",
  EXECUTION: "تنفيذ",
  UNKNOWN: "غير محدد",
};

export const STAGE_LABELS: Record<ProceduralStage, string> = {
  PRE_LITIGATION: "قبل رفع الدعوى",
  FILING: "قيد الدعوى",
  FIRST_INSTANCE: "ابتدائي (تحت النظر)",
  EVIDENCE: "مرحلة الإثبات",
  PLEADING_CLOSED: "بعد قفل باب المرافعة",
  JUDGMENT_ISSUED: "صدر الحكم",
  APPEAL: "استئناف",
  CASSATION: "نقض / تمييز",
  RECONSIDERATION: "التماس إعادة نظر",
  EXECUTION: "تنفيذ",
  UNKNOWN: "غير محددة",
};

export const OUTPUT_LABELS: Record<RequestedOutput, string> = {
  CLAIM_SHEET: "صحيفة دعوى",
  ANSWER_MEMO: "مذكرة جوابية",
  REPLY_MEMO: "مذكرة رد",
  OPPONENT_DEFENSES: "توقّع دفوع الخصم",
  CASE_STRENGTH: "تقييم قوة القضية",
  HEARING_SIMULATION: "محاكاة جلسة",
  PROCEDURAL_DECISION: "قرار إجرائي",
  DRAFT_JUDGMENT: "مسودة حكم افتراضي",
  OBJECTION: "اعتراض على حكم",
  APPEAL_MEMO: "لائحة استئنافية",
  CASSATION_MEMO: "طلب نقض / تمييز",
  RECONSIDERATION_MEMO: "التماس إعادة نظر",
  ARBITRATION_ORDER: "أمر إجرائي تحكيمي",
  ARBITRATION_AWARD: "حكم تحكيم",
  ARBITRATION_CLAUSE_CHECK: "فحص شرط تحكيم",
  EVIDENCE_PLAN: "خطة إثبات",
  DOCUMENTS_PLAN: "خطة مستندات",
  SETTLEMENT_PLAN: "خطة صلح",
  CRIMINAL_DEFENSE: "مذكرة دفاع جزائية",
  CONTRACT_REVIEW: "مراجعة عقد",
  LEGAL_ANALYSIS: "تحليل قانوني",
  UNKNOWN: "غير محدد",
};

export const MODE_LABELS: Record<SimulationMode, string> = {
  RESEARCHER: "الباحث القانوني",
  PLAINTIFF_LAWYER: "محامي المدعي",
  DEFENDANT_LAWYER: "محامي المدعى عليه",
  OPPONENT: "الخصم الافتراضي",
  JUDGE: "القاضي الافتراضي",
  ARBITRATOR: "المحكّم",
  DRAFTING_REVIEWER: "مراجع الصياغة",
  EVIDENCE_EXAMINER: "فاحص الإثبات",
  JUDGMENT_EXAMINER: "فاحص الحكم",
  CONTRACT_EXAMINER: "فاحص العقد",
};

/** المخرجات عالية المخاطر التي تستلزم بطاقة فهم وموافقة قبل الإنتاج النهائي. */
export const HIGH_RISK_OUTPUTS: RequestedOutput[] = [
  "CLAIM_SHEET",
  "ANSWER_MEMO",
  "REPLY_MEMO",
  "DRAFT_JUDGMENT",
  "OBJECTION",
  "APPEAL_MEMO",
  "CASSATION_MEMO",
  "RECONSIDERATION_MEMO",
  "ARBITRATION_AWARD",
  "ARBITRATION_ORDER",
  "CRIMINAL_DEFENSE",
];
