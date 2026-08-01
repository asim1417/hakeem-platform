// ─────────────────────────────────────────────────────────────────────────────
// §13 — النواة اللغويّة القضائيّة السعوديّة (Saudi Judicial Language Kernel)
//
// تفصل ألفاظ الأدوار وتربط كلّ مصطلحٍ بالمقام الذي يجوز فيه والمقام الذي يمنع فيه،
// وتضبط مستوى الجزم. المصدر: نصّ الأمر الحاكم HKM-JDS-002 §13 (مزوّد من المستخدم)،
// لا استخراجٌ من مرجعٍ خارجيّ — فلا اختلاق. تستهلكها بوّابتا JG13/JG14 وحارس الصياغة.
// ─────────────────────────────────────────────────────────────────────────────
import type { AssertionLevel, JudicialVoiceProfile } from "./contracts";

export interface JudicialLexeme {
  term: string;
  meaningAr: string;
  /** المقام الذي يجوز فيه استعمال اللفظ. */
  allowedWhenAr: string;
  /** الأدوار التي يجوز لها استعماله. */
  voices: JudicialVoiceProfile[];
}

// §13.1 — لغة المحكمة (صوت الحسم المحايد المسبّب). بعضها مقيّد بالنسخة المصرّح بها فقط.
export const BENCH_LEXICON: readonly JudicialLexeme[] = [
  { term: "المحكمة ترى", meaningAr: "تقرير رأي المحكمة", allowedWhenAr: "في التسبيب", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "الثابت من", meaningAr: "إسناد واقعة ثابتة", allowedWhenAr: "بعد ثبوت الدليل", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "لما كان", meaningAr: "افتتاح تعليل", allowedWhenAr: "في التسبيب", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "وحيث إن", meaningAr: "ربط سببيّ", allowedWhenAr: "في التسبيب", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "وبما أن", meaningAr: "ربط سببيّ", allowedWhenAr: "في التسبيب", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "ولما تقدم", meaningAr: "خلاصة تمهّد للنتيجة", allowedWhenAr: "قبل المنطوق", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "يترتب على ذلك", meaningAr: "استنتاج نتيجة", allowedWhenAr: "في التسبيب", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "تقضي الدائرة", meaningAr: "إصدار قرار الدائرة", allowedWhenAr: "في المنطوق", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "حكمت الدائرة", meaningAr: "منطوق حكم", allowedWhenAr: "في النسخة المصرّح بها فقط", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "يصرف النظر", meaningAr: "صرف النظر عن الدعوى", allowedWhenAr: "عند انطباقه نظامًا", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "عدم القبول", meaningAr: "قضاء شكليّ", allowedWhenAr: "عند تحقّق سببه", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "الرفض", meaningAr: "قضاء موضوعيّ بعدم الاستحقاق", allowedWhenAr: "بعد نظر الموضوع", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "الإلزام", meaningAr: "إلزام الطرف", allowedWhenAr: "في المنطوق", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "التأييد", meaningAr: "تأييد حكم", allowedWhenAr: "في مرحلة الاعتراض", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "التعديل", meaningAr: "تعديل حكم", allowedWhenAr: "في مرحلة الاعتراض", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "النقض", meaningAr: "نقض حكم", allowedWhenAr: "في مسار النقض", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "الإلغاء", meaningAr: "إلغاء حكم/قرار", allowedWhenAr: "عند تحقّق سببه", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
  { term: "الإعادة", meaningAr: "إعادة القضية", allowedWhenAr: "بعد النقض/الإلغاء", voices: ["JUDICIAL_BENCH_RESTRICTED"] },
];

// §13.2 — لغة المحامي أو الطرف (دفوع وطلبات، لا حسم بصوت المحكمة).
export const PARTY_LEXICON: readonly JudicialLexeme[] = [
  { term: "يتمسك موكلي", meaningAr: "تمسّك بدفع/حقّ", allowedWhenAr: "في المذكرات", voices: ["JUDICIAL_PARTY"] },
  { term: "يدفع", meaningAr: "إبداء دفع", allowedWhenAr: "في المذكرات", voices: ["JUDICIAL_PARTY"] },
  { term: "نطلب", meaningAr: "طلب أصليّ", allowedWhenAr: "في الطلبات", voices: ["JUDICIAL_PARTY"] },
  { term: "نلتمس", meaningAr: "التماس", allowedWhenAr: "في الطلبات/الالتماس", voices: ["JUDICIAL_PARTY"] },
  { term: "مؤدى ذلك", meaningAr: "خلاصة حجّة", allowedWhenAr: "في الاستدلال", voices: ["JUDICIAL_PARTY"] },
  { term: "يترجح", meaningAr: "ترجيح غير جازم", allowedWhenAr: "في الاستدلال", voices: ["JUDICIAL_PARTY", "JUDICIAL_RESEARCH_AND_TRAINING"] },
  { term: "الثابت من المستند", meaningAr: "إحالة إلى دليل", allowedWhenAr: "بعد إبراز المستند", voices: ["JUDICIAL_PARTY"] },
  { term: "لم يقدم الخصم ما يثبت", meaningAr: "بيان عجز الخصم", allowedWhenAr: "في الدفوع", voices: ["JUDICIAL_PARTY"] },
  { term: "أغفل الحكم", meaningAr: "نعيٌ على الحكم", allowedWhenAr: "في الاعتراض", voices: ["JUDICIAL_PARTY"] },
  { term: "أخطأ الحكم في", meaningAr: "نعيٌ على الحكم", allowedWhenAr: "في الاعتراض", voices: ["JUDICIAL_PARTY"] },
  { term: "شاب الحكم", meaningAr: "نعيٌ على الحكم", allowedWhenAr: "في الاعتراض", voices: ["JUDICIAL_PARTY"] },
  { term: "الطلب الأصلي", meaningAr: "طلب أصليّ", allowedWhenAr: "في الطلبات", voices: ["JUDICIAL_PARTY"] },
  { term: "الطلب الاحتياطي", meaningAr: "طلب احتياطيّ", allowedWhenAr: "في الطلبات", voices: ["JUDICIAL_PARTY"] },
];

// §13.3 — معجم حالة الواقعة (يربط موقع الواقعة بلفظها المناسب).
export interface FactStatusLexeme {
  status: string;
  allowedVerbsAr: string[];
}
export const FACT_STATUS_LEXICON: readonly FactStatusLexeme[] = [
  { status: "رواية المدعي", allowedVerbsAr: ["يدعي", "يذكر", "يتمسك"] },
  { status: "رواية المدعى عليه", allowedVerbsAr: ["يجيب", "يدفع", "يقرر"] },
  { status: "إقرار", allowedVerbsAr: ["أقر", "صادق"] },
  { status: "إنكار", allowedVerbsAr: ["أنكر", "نازع"] },
  { status: "مستند", allowedVerbsAr: ["يثبت من", "يتبين من"] },
  { status: "واقعة متنازع عليها", allowedVerbsAr: ["محل نزاع", "ينازع فيها"] },
  { status: "استنتاج", allowedVerbsAr: ["يستفاد", "يظهر", "يترجح"] },
  { status: "نقص", allowedVerbsAr: ["لا تتوافر عناصر كافية للجزم"] },
  { status: "نتيجة", allowedVerbsAr: ["يترتب", "ومن ثم", "وبناء عليه"] },
];

// §13.4 — مستوى الجزم: ألفاظٌ مسموحة ومحظورة لكلّ مستوى (يمنع «ثبت» عند مجرّد الادعاء).
export interface AssertionLevelPolicy {
  level: AssertionLevel;
  meaningAr: string;
  allowedTermsAr: string[];
  prohibitedTermsAr: string[];
}
export const ASSERTION_LEVEL_POLICY: readonly AssertionLevelPolicy[] = [
  { level: "ASSERTED", meaningAr: "ادّعاء مجرّد", allowedTermsAr: ["يدعي", "يذكر", "يزعم"], prohibitedTermsAr: ["ثبت", "الثابت", "المؤكد"] },
  { level: "SUPPORTED", meaningAr: "مدعوم بقرينة", allowedTermsAr: ["يستأنس بـ", "تعزّزه القرينة"], prohibitedTermsAr: ["ثبت يقينًا"] },
  { level: "ESTABLISHED", meaningAr: "ثابت", allowedTermsAr: ["ثبت", "الثابت من", "استقر"], prohibitedTermsAr: ["يُزعم"] },
  { level: "DISPUTED", meaningAr: "متنازع فيه", allowedTermsAr: ["محل نزاع", "متنازع عليه"], prohibitedTermsAr: ["ثبت", "المسلّم به"] },
  { level: "INFERRED", meaningAr: "استنتاج معلن", allowedTermsAr: ["يستفاد", "يظهر", "يترجح"], prohibitedTermsAr: ["قطعًا", "بلا شك"] },
  { level: "UNSUPPORTED", meaningAr: "بلا سند", allowedTermsAr: ["لم يقدَّم ما يثبت"], prohibitedTermsAr: ["ثبت", "الثابت", "يحكم بموجبه"] },
];

/** ألفاظ الحسم الحصريّة بصوت المحكمة — يمنع ورودها في مذكّرة طرفٍ أو بحثٍ (JG13). */
export const BENCH_ONLY_DECISIVE_TERMS: readonly string[] = [
  "حكمت الدائرة",
  "تقضي الدائرة",
  "يصرف النظر",
  "عدم القبول",
];

/** يعيد ألفاظ الدور المسموحة لصوتٍ معيّن. */
export function lexiconForVoice(voice: JudicialVoiceProfile): JudicialLexeme[] {
  return [...BENCH_LEXICON, ...PARTY_LEXICON].filter((l) => l.voices.includes(voice));
}

/** يتحقّق من أنّ نصًّا لا يستعمل لفظًا محظورًا في مستوى الجزم المعطى (JG13 مساعِد). */
export function assertionViolations(text: string, level: AssertionLevel): string[] {
  const policy = ASSERTION_LEVEL_POLICY.find((p) => p.level === level);
  if (!policy) return [];
  return policy.prohibitedTermsAr.filter((t) => text.includes(t));
}
