// إعادة ربط الأسطر المكسورة — نواة نقيّة محايدة البيئة (متصفح + خادم).
//
// المدوّنات والأحكام المرقّمة سطراً-سطراً تُخرِج نصّاً مقطّعاً: الجملة الواحدة موزّعة
// على أسطرٍ قصيرة (لفٌّ بصريّ لا فاصلٌ معنوي). هذا يدمج أسطر التكملة في فقرةٍ متدفّقة.
//
// الأمان: لا نمسّ إلا الوثائق «المكسورة» فعلاً (حارسٌ يكتشفها)؛ والنصّ المنسّق أصلاً
// (فقرات كاملة تنتهي بعلامات) يبقى كما هو. ونحافظ على الفواصل الحقيقية: نهاية الجملة،
// السطر الفارغ، علامة [صفحة N]، العناوين وبدايات القوائم (أولاً/ثانياً/«1)»/«-»).

// نهاية جملةٍ صريحة: نقطة/سؤال/تعجّب/فاصلة منقوطة/نقطتان — قد يتبعها إغلاق قوس/قوسة.
const TERMINAL = /[.؟!؛:][)»"'\]]?$/;

// سطرٌ يبدأ كتلةً جديدة — لا يُدمج في سابقه.
const NEW_BLOCK =
  /^(\[صفحة \d+\]|[-•*–—]\s|\(?[0-9٠-٩]{1,3}[)\-.]\s|(?:أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)ً?\s*[:/-]|بسم الله|الحمد لله|الأنموذج|الفصل|الباب|المادة\s+[0-9٠-٩])/;

const isPageMark = (l: string) => /^\[صفحة \d+\]$/.test(l.trim());

/** هل يبدو النصّ مكسوراً (أسطرٌ قصيرة كثيرة لا تنتهي بعلامة جملة)؟ */
function looksWrapped(lines: string[]): boolean {
  const content = lines.map((l) => l.trim()).filter((l) => l && !isPageMark(l));
  if (content.length < 4) return false;
  let contLike = 0;
  for (const l of content) {
    if (!TERMINAL.test(l) && !NEW_BLOCK.test(l) && Array.from(l).length < 70) contLike += 1;
  }
  return contLike / content.length > 0.4;
}

/**
 * يعيد ربط الأسطر المكسورة إلى فقراتٍ متدفّقة. يعمل فقط على النصّ الذي يبدو مكسوراً
 * (وإلا يعيده كما هو). يحترم السطور الفارغة وعلامات الصفحات والعناوين وبدايات القوائم.
 */
export function reflowWrappedLines(text: string): string {
  if (!text) return text ?? "";
  const lines = text.split("\n");
  if (!looksWrapped(lines)) return text;

  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      out.push(""); // سطرٌ فارغ = فاصل فقرة
      continue;
    }
    const prev = out.length ? out[out.length - 1] : null;
    const prevTrim = prev === null ? "" : prev.trim();
    const mergeable =
      prev !== null &&
      prevTrim !== "" &&
      !isPageMark(prevTrim) &&
      !isPageMark(line.trim()) &&
      !TERMINAL.test(prevTrim) && // السطر السابق لم ينهِ جملة
      !NEW_BLOCK.test(line.trim()); // والسطر الحالي ليس بداية كتلة
    if (mergeable) {
      out[out.length - 1] = prev + " " + line.trim();
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
