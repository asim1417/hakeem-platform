// مصنّف الدفوع: شكلية (FORMAL) / موضوعية (SUBSTANTIVE) / إجرائية (PROCEDURAL).
// تصنيف حتمي بالكلمات الدالّة، يُستعمل كاحتياط عند غياب تصنيف المزوّد أو خطئه.

export type DefenseCategory = "FORMAL" | "SUBSTANTIVE" | "PROCEDURAL";

export const DEFENSE_CATEGORY_LABELS: Record<DefenseCategory, string> = {
  FORMAL: "شكلية",
  SUBSTANTIVE: "موضوعية",
  PROCEDURAL: "إجرائية",
};

// دفوع إجرائية: تتعلّق بسير الخصومة وشروط قبولها.
const PROCEDURAL_HINTS = [
  "اختصاص",
  "الميعاد",
  "ميعاد",
  "تقادم",
  "سقوط الحق",
  "عدم القبول",
  "عدم قبول",
  "الصفة",
  "المصلحة",
  "رفع الدعوى",
  "شطب",
  "انعقاد الخصومة",
  "الإحالة",
  "وقف الدعوى",
];

// دفوع شكلية: تتعلّق بشكل الصحيفة/المذكرة وبياناتها والتبليغ.
const FORMAL_HINTS = [
  "بطلان الصحيفة",
  "بطلان صحيفة",
  "بطلان المذكرة",
  "نقص البيانات",
  "نقص بيانات",
  "عدم بيان",
  "البيانات الإلزامية",
  "بطلان التبليغ",
  "التبليغ",
  "شكل المذكرة",
];

/** يصنّف نصّ دفع إلى فئته. الافتراض موضوعي ما لم تظهر قرينة إجرائية/شكلية. */
export function classifyDefense(text: string): DefenseCategory {
  const t = (text ?? "").trim();
  if (!t) return "SUBSTANTIVE";
  if (FORMAL_HINTS.some((k) => t.includes(k))) return "FORMAL";
  if (PROCEDURAL_HINTS.some((k) => t.includes(k))) return "PROCEDURAL";
  return "SUBSTANTIVE";
}
