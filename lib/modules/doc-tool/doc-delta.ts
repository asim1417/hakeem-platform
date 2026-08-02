// مُلخِّص فرق قائمة الوثائق — دالّةٌ نقيّة بلا أيّ اعتماد (قابلة للاختبار وحدها،
// بلا سحب وحدات الخادم). تُنتج بياناتٍ وصفيّة للتدقيق: العدد النهائيّ وعدد المُضاف/
// المحذوف وعناوين المُضاف (مقتضبة) — بلا أيّ نصٍّ خام.

interface TitledDoc {
  title?: unknown;
}

export function summarizeDocDelta(
  before: unknown,
  after: unknown
): { docCount: number; added: number; removed: number; addedTitles: string[] } {
  const titlesOf = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .map((d) => (typeof (d as TitledDoc)?.title === "string" ? ((d as TitledDoc).title as string) : ""))
          .filter(Boolean)
      : [];
  const oldTitles = titlesOf(before);
  const newTitles = titlesOf(after);
  const oldSet = new Set(oldTitles);
  const newSet = new Set(newTitles);
  const addedTitles = newTitles.filter((t) => !oldSet.has(t));
  const removed = oldTitles.filter((t) => !newSet.has(t)).length;
  return {
    docCount: newTitles.length,
    added: addedTitles.length,
    removed,
    // عناوين المُضاف فقط (حدّ ٢٠ عنوانًا × ١٢٠ حرفًا) — للتتبّع لا لتخزين المحتوى.
    addedTitles: addedTitles.slice(0, 20).map((t) => t.slice(0, 120))
  };
}
