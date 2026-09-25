/**
 * normalize.ts — تطبيع نصّ الوحدة للفهرسة فقط (الخام يبقى بلا مساس).
 * يزيل علامات الاتجاه غير المرئية (RLM/LRM وأمثالها) التي تشوّه المطابقة، ويوحّد
 * المسافات. لا يزيل التشكيل هنا (طبقة البحث لها تطبيعها) — الغرض: مطبَّع نظيف مستقرّ.
 */

// علامات الاتجاه والتحكم غير المرئية: RLM/LRM، ALM، الحاويات الاتجاهية، والعزل.
const BIDI_CONTROLS = /[‎‏؜‪-‮⁦-⁩]/g;

/** يزيل علامات الاتجاه غير المرئية فقط (يُطبَّق على المطبَّع لا الخام). */
export function stripBidi(input: string): string {
  return input.replace(BIDI_CONTROLS, "");
}

/** النصّ المطبَّع للفهرسة: بلا علامات اتجاه، ومسافات موحّدة، بلا أطراف. */
export function normalizeForIndex(raw: string): string {
  return stripBidi(raw)
    .replace(/ /g, " ") // مسافة غير فاصلة
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}
