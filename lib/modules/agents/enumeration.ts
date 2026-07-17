// ─────────────────────────────────────────────────────────────────────────────
// الحصر الكامل للنظام (المسار الاستقصائي) — للأسئلة الحصريّة عن نظام مُسمّى
// («ما هي كل المدد في نظام المعاملات المدنية؟»). حتمي بالكامل: يمسح مواد النظام
// ويستخرج العناصر (المدد) بأنماط لغوية — فيضمن **التغطية الكاملة** لا عيّنة الاسترجاع.
// لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────

// كلمات الشمول الصريحة فقط (طلب «كل/جميع» العناصر) — المسح الكامل للنظام إجراءٌ قويّ لا يُطلَق
// إلا بشمولٍ صريح. أُزيلت فواتح الأسئلة («ما هي/ماهي») و«اذكر/عدد/أي مدة» لأنها تسبق مسائل
// محدّدة كثيرًا («ما هي مدة الاستئناف»)، فكانت تُغرِق الجواب المباشر بجدول شامل بلا داعٍ.
const ENUM_WORDS = ["كل", "جميع", "كافة", "سائر", "قائمة", "حصر", "استقصاء"];
/** كلمات تدلّ على أن المطلوب «المدد». */
const DURATION_TOPIC = ["مدة", "مدد", "المدة", "المدد", "مهلة", "مهل", "أجل", "آجال", "ميعاد", "مواعيد"];

/** أرقام عربية/هندية + منطوقة شائعة. */
const NUM = "(?:[0-9]+|[٠-٩]+|إحدى|اثنت?ا?|ثلاث|أربع|خمس|ست|سبع|ثماني?|تسع|عشر|عشرة|ثلاثين|أربعين|خمسين|ستين|سبعين|ثمانين|تسعين|مئة|مائة|مئتي|نصف)";
/** وحدات زمنية (بصيغها الشائعة). */
const UNIT = "(?:يومًا|يوماً|أيام|يوم|شهرًا|شهراً|أشهر|شهر|سنةً|سنة|سنوات|سنين|عامًا|عاماً|أعوام|عام|ساعةً|ساعة|ساعات|أسبوعًا|أسبوع|أسابيع|دقيقة|دقائق)";

// عبارة مدّة: رقم + وحدة، أو سياق (مدة/خلال/أجل/ميعاد/مهلة) قريب من وحدة.
const DURATION_RE = new RegExp(`(?:${NUM}\\s*${UNIT})|(?:(?:مدة|مدته|خلال|أجل|ميعاد|مهلة|مهلته)\\s+(?:\\S+\\s+){0,3}?${UNIT})`, "g");

/** يزيل «نظام/لائحة» ويقتصّ اسم النظام بعد كلمة «نظام». */
export function detectDurationEnumeration(query: string): { systemName: string } | null {
  const q = (query || "").trim();
  const isEnum = ENUM_WORDS.some((w) => q.includes(w));
  const isDuration = DURATION_TOPIC.some((w) => q.includes(w));
  if (!isEnum || !isDuration) return null;
  // اسم النظام بعد «نظام» (حتى نهاية العبارة أو علامة).
  const m = q.match(/نظام\s+([^؟\n.,]+)/);
  const systemName = m?.[1]?.trim();
  if (!systemName || systemName.length < 3) return null;
  return { systemName: systemName.replace(/\s+/g, " ") };
}

/** يستخرج عبارات المدّة من نصّ مادة (مميّزة، مقلَّمة). */
export function extractDurations(text: string): string[] {
  const out = new Set<string>();
  for (const m of (text || "").matchAll(DURATION_RE)) {
    const phrase = m[0].replace(/\s+/g, " ").trim();
    if (phrase && phrase.length <= 60) out.add(phrase);
  }
  return [...out];
}

export interface DurationRow {
  articleNumber: number;
  title: string;
  durations: string[];
}

/** يبني جدول Markdown شاملًا بكل المواد ذات المدد (RTL، ترقيم عربي). */
export function formatDurationTable(systemName: string, rows: DurationRow[]): string {
  if (!rows.length) return `لم أعثر على مواد تذكر مدداً صريحة في «${systemName}» ضمن ما هو محمّل في النواة.`;
  const head = `## حصر المدد في ${systemName}\n\nوجدتُ **${rows.length.toLocaleString("ar-SA")}** مادة تذكر مدداً صريحة:\n\n| المادة | الموضوع | المدد المذكورة |\n|---|---|---|`;
  const body = rows
    .map((r) => `| م ${r.articleNumber.toLocaleString("ar-SA")} | ${(r.title || "").slice(0, 60)} | ${r.durations.join(" · ")} |`)
    .join("\n");
  const note = `\n\n> حصرٌ استقرائيّ حتميّ من مواد النظام المحمّلة في النواة — كل مادة قائمة فعلاً. قد توجد مدد مصوغة لفظًا دون رقم لم تُلتقَط.`;
  return `${head}\n${body}${note}`;
}
