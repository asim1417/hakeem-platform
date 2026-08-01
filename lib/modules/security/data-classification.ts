// تصنيف البيانات الأمنيّ — المخطط السيادي §21.
// نواة نقيّة (بلا Prisma/شبكة): تُطبِّع التصنيف وتقارن مستويات الحساسية.
// السياسة الأوّليّة «وسمٌ لا حجب»: تُحسب المستويات وتُسجَّل، دون تعطيل أي تدفّق.

import type { DataClass } from "@prisma/client";

/** الترتيب التصاعديّ للحساسية — يُستعمل في المقارنة والتصعيد. */
export const DATA_CLASS_ORDER: DataClass[] = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
];

/** غياب التصنيف (null) يُعامَل INTERNAL — الوضع الآمن الافتراضيّ (§21). */
export const DEFAULT_DATA_CLASS: DataClass = "INTERNAL";

export const DATA_CLASS_LABELS_AR: Record<DataClass, string> = {
  PUBLIC: "عامّ",
  INTERNAL: "داخليّ",
  CONFIDENTIAL: "سرّيّ",
  RESTRICTED: "مقيَّد",
};

/** يطبّع قيمة قد تكون null إلى تصنيف فعليّ. */
export function classify(value: DataClass | null | undefined): DataClass {
  return value ?? DEFAULT_DATA_CLASS;
}

export function rank(value: DataClass | null | undefined): number {
  return DATA_CLASS_ORDER.indexOf(classify(value));
}

/** هل تصنيف المُطّلِع يكفي للوصول إلى تصنيف المورد؟ (للتفعيل المستقبليّ). */
export function clearanceSatisfies(
  clearance: DataClass | null | undefined,
  resource: DataClass | null | undefined
): boolean {
  return rank(clearance) >= rank(resource);
}

export function labelAr(value: DataClass | null | undefined): string {
  return DATA_CLASS_LABELS_AR[classify(value)];
}

/** حمولة تدقيق موحّدة للتصنيف — تُضاف إلى metadata حدث التدقيق. */
export function classificationAudit(value: DataClass | null | undefined) {
  const cls = classify(value);
  return { dataClass: cls, dataClassRank: rank(cls), explicit: value != null };
}
