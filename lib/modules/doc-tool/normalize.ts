// تنظيف وتطبيع عربي — منقول من tools/arabic-doc-tool/tool_app.py
// يعمل في المتصفح والخادم معاً (لا اعتماد على أي API خاص ببيئة).

/** علامات الاتجاه والمحارف الخفية (LRM/RLM/عزل ثنائي الاتجاه/BOM…) */
const STRIP = /[​-‏‪-‮⁦-⁩﻿]/g;

/** حروف فارسية/أردية شبيهة → مقابلها العربي */
const LOOKALIKES: Record<string, string> = {
  "ھ": "ه",
  "ہ": "ه",
  "ۀ": "ه",
  "ۃ": "ة",
  "ی": "ي",
  "ۍ": "ي",
  "ک": "ك"
};

/** ينظّف النص المخزَّن: يزيل المحارف الخفية ويوحّد الشبيهات ويحوّل الأرقام الفارسية */
export function cleanText(text: string): string {
  if (!text) return text ?? "";
  let t = text.replace(STRIP, "");
  t = t.replace(/[ھہۀۃیۍک]/g, (c) => LOOKALIKES[c] ?? c);
  return t.replace(/[۰-۹]/g, (c) =>
    String.fromCharCode(0x0660 + (c.charCodeAt(0) - 0x06f0))
  );
}

const UNIFY: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي"
};

/** تشكيل/تطويل/ألف خنجرية — تُسقَط عند التطبيع */
function isSkippable(code: number): boolean {
  return (code >= 0x064b && code <= 0x0652) || code === 0x0640 || code === 0x0670;
}

export interface NormMap {
  /** النص المطبَّع */
  n: string;
  /** map[i] = موضع الحرف في النص الأصلي الذي أنتج الحرف i في المطبَّع */
  map: number[];
}

/** تطبيع مع خريطة مواضع — تلزم للتظليل الدقيق فوق النص الأصلي */
export function normMap(s: string): NormMap {
  const src = s ?? "";
  let n = "";
  const map: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (isSkippable(src.charCodeAt(i))) continue;
    n += UNIFY[ch] ?? ch.toLowerCase();
    map.push(i);
  }
  return { n, map };
}

/** تطبيع بلا خريطة (للفهرسة والمقارنة) */
export function norm(s: string): string {
  return normMap(s).n;
}

/** يقسم استعلام البحث إلى وحدات مطبَّعة (يتجاهل ما دون حرفين) */
export function queryTokens(q: string): string[] {
  return norm(q)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** مدى تظليل [بداية، نهاية) بمواضع النص الأصلي */
export type HighlightRange = [number, number];

/** كل مواضع مطابقات الوحدات داخل نص (عبر خريطته المطبَّعة)، مرتّبةً */
export function findRanges(nm: NormMap, tokens: string[]): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  for (const t of tokens) {
    let p = 0;
    while ((p = nm.n.indexOf(t, p)) >= 0) {
      ranges.push([nm.map[p], nm.map[p + t.length - 1] + 1]);
      p += t.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}
