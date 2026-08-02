// منطق تقليم النسخ — دوالّ نقيّة بلا اعتماد (قابلة للاختبار وحدها).

/**
 * من قائمةٍ مرتّبة «الأحدث أوّلًا»، يعيد المعرّفات التي تتجاوز حدّ الاحتفاظ (الأقدم)
 * لتُحذف. حدٌّ غير موجب يعني «احذف الكلّ». يُبقي دائمًا آخر `keep` عناصر.
 */
export function retainRecentCount<T>(newestFirst: T[], keep: number): T[] {
  if (keep <= 0) return [...newestFirst];
  return newestFirst.slice(keep);
}

/**
 * تقليمٌ بحدّين معًا (عددٍ وميزانيّةِ بايت) — يحمي من تضخّم التخزين حين تكون اللقطات
 * كبيرة. من قائمةٍ «الأحدث أوّلًا»، يُبقي عنصرًا ما دام ضمن `keepCount` **و** ما دام
 * مجموع البايتات التراكميّ ضمن `maxBytes`؛ ويعيد الباقي (الأقدم) للحذف. يُبقي دائمًا
 * العنصر الأحدث ولو تجاوز الميزانيّة وحده (كي لا نفقد آخر نسخة). حدٌّ غير موجب = بلا حدّ.
 */
export function retainWithinBudget<T extends { bytes: number }>(
  newestFirst: T[],
  keepCount: number,
  maxBytes: number
): T[] {
  const drop: T[] = [];
  let cum = 0;
  for (let i = 0; i < newestFirst.length; i += 1) {
    const item = newestFirst[i];
    const size = Math.max(0, item.bytes || 0);
    const overCount = keepCount > 0 && i >= keepCount;
    const overBytes = maxBytes > 0 && i > 0 && cum + size > maxBytes;
    if (overCount || overBytes) {
      drop.push(item);
    } else {
      cum += size;
    }
  }
  return drop;
}
