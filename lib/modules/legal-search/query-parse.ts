// ─────────────────────────────────────────────────────────────────────────────
// query-parse — تحليل استعلامات البحث القانوني (نقيّ، بلا قاعدة). مشترك بين
// المنسّق الهجين ومزوّد OpenSearch لتفادي الاستيراد الدائري.
// ─────────────────────────────────────────────────────────────────────────────

// يقبل الأرقام اللاتينية والعربية-الهندية (٠-٩) معًا — يُحوَّل الملتقَط لاحقًا.
const ARTICLE_NUM_RE = /(?:الماد[ةه]|ماد[ةه]|م)\s*\/?\s*\(?\s*([\d٠-٩]{1,4})\s*\)?/;

/** تطبيع عربي بسيط: الهمزات→ا، ة→ه، ى→ي، الأرقام الشرقية→لاتينية. */
export function normalizeArabicQuery(raw: string): string {
  return (raw || "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * يفصل «المادة {رقم} {اسم النظام}» إلى رقم المادة وتلميح اسم النظام. نقيّة.
 * يعيد null إن لم يكن الاستعلام بهذا النمط أو لم يبقَ اسم نظام مميّز.
 */
export function parseArticleQuery(q: string): { articleNumber: number; systemHint: string } | null {
  const m = q.match(ARTICLE_NUM_RE);
  if (!m) return null;
  // [إصلاح SEARCH-001] تحويل الرقم الملتقَط (قد يكون بأرقام عربية ٥) إلى لاتيني قبل التحويل العددي.
  const n = Number(normalizeArabicQuery(m[1]));
  if (!Number.isInteger(n) || n <= 0) return null;
  const hint = q.replace(ARTICLE_NUM_RE, " ").replace(/\bنظام\b|\bمن\b|\bفي\b|\bال\b/g, " ").replace(/\s+/g, " ").trim();
  if (hint.length < 3) return null;
  return { articleNumber: n, systemHint: hint };
}
