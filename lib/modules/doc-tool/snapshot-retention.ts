// منطق تقليم النسخ — دالّةٌ نقيّة بلا اعتماد (قابلة للاختبار وحدها).

/**
 * من قائمةٍ مرتّبة «الأحدث أوّلًا»، يعيد المعرّفات التي تتجاوز حدّ الاحتفاظ (الأقدم)
 * لتُحذف. حدٌّ غير موجب يعني «احذف الكلّ». يُبقي دائمًا آخر `keep` عناصر.
 */
export function retainRecentCount<T>(newestFirst: T[], keep: number): T[] {
  if (keep <= 0) return [...newestFirst];
  return newestFirst.slice(keep);
}
