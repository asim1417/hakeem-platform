/**
 * أنواع الكيان / المهنة في الملف المهني والتسجيل.
 * مخزّنة كنص في users.entityType — القيم الجديدة متوافقة مع الصفوف القديمة (INDIVIDUAL).
 */
export const ENTITY_TYPE_VALUES = [
  "LAWYER",
  "TRAINEE_LAWYER",
  "LEGAL_PRACTITIONER",
  "LAW_FIRM",
  "OTHER",
  /** قديم — يُقبل للقراءة والحفظ حتى يحدّث المستخدم ملفه */
  "INDIVIDUAL",
] as const;

export type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];

/** خيارات ظاهرة في النماذج — بلا دمج محامٍ ومتدرب */
export const ENTITY_TYPE_OPTIONS: ReadonlyArray<{ value: EntityTypeValue; label: string }> = [
  { value: "LAWYER", label: "محامٍ مرخّص" },
  { value: "TRAINEE_LAWYER", label: "محامٍ متدرب" },
  { value: "LEGAL_PRACTITIONER", label: "ممارس / مستشار قانوني" },
  { value: "LAW_FIRM", label: "مكتب محاماة" },
  { value: "OTHER", label: "أخرى" },
];

/** القيمة الافتراضية للنماذج الجديدة */
export const DEFAULT_ENTITY_TYPE: EntityTypeValue = "LAWYER";

/** إن وُجدت قيمة قديمة غير ظاهرة في القائمة، نضيفها مؤقتًا حتى لا تُفقد عند الحفظ */
export function entityOptionsForValue(
  current: string | null | undefined
): ReadonlyArray<{ value: string; label: string }> {
  const cur = (current || "").trim();
  if (!cur || ENTITY_TYPE_OPTIONS.some((o) => o.value === cur)) return ENTITY_TYPE_OPTIONS;
  const legacyLabel = cur === "INDIVIDUAL" ? "محامٍ فرد (سابق)" : cur;
  return [...ENTITY_TYPE_OPTIONS, { value: cur, label: legacyLabel }];
}
