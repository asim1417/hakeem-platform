/**
 * reference-parser.ts — محلّل الإشارات الصريحة «المادة (كذا) من النظام» داخل نصوص اللوائح/الضوابط/الأدلة.
 * منقول من حزمة hakeem-bylaw-linking (bylaw_link_parser.py) إلى TS، مع الحفاظ على السلوك المُختبَر.
 * مُدقِّق لا محرّك: يحوّل الإشارة النصّية إلى رقم مادة نظام مُشار إليه صراحةً (ثقة 0.98).
 */

// ── تطبيع النص العربي (توحيد الهمزات/الألف المقصورة، حذف التطويل والتشكيل) ──
const HARAKAT = /[ؗ-ًؚ-ْـ]/g;
export function normalize(s: string): string {
  return (s || "")
    .replace(HARAKAT, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim();
}

// ── قاموس الأعداد الترتيبية المؤنّثة (جمعي: نجزّئ ونجمع) ──
const ORDINAL_RAW: Record<string, number> = {
  اولي: 1, حادية: 1, واحدة: 1, ثانية: 2, ثالثة: 3, رابعة: 4, خامسة: 5,
  سادسة: 6, سابعة: 7, ثامنة: 8, تاسعة: 9, عاشرة: 10, عشرة: 10, عشر: 10,
  عشرون: 20, عشرين: 20, ثلاثون: 30, ثلاثين: 30, اربعون: 40, اربعين: 40,
  خمسون: 50, خمسين: 50, ستون: 60, ستين: 60, سبعون: 70, سبعين: 70,
  ثمانون: 80, ثمانين: 80, تسعون: 90, تسعين: 90,
  مائة: 100, مئة: 100, مائتان: 200, مئتان: 200, مائتين: 200, مئتين: 200,
  ثلاثمائة: 300, ثلاثمئة: 300, اربعمائة: 400, اربعمئة: 400,
  خمسمائة: 500, خمسمئة: 500, ستمائة: 600, سبعمائة: 700, ثمانمائة: 800, تسعمائة: 900,
};
// نطبّع المفاتيح بنفس الدالة (مثال: «مائة» → «ماية»).
const ORDINAL: Record<string, number> = Object.fromEntries(
  Object.entries(ORDINAL_RAW).map(([k, v]) => [normalize(k), v])
);
const SKIP = new Set(["و", "بعد", "من", "ال", "المادة", "الماده", ""]);
const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const toWesternDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => AR_DIGITS[d]);

/** يحوّل عبارة ترتيبية عربية أو رقماً إلى عدد صحيح، أو null. */
export function parseOrdinal(phrase: string): number | null {
  const p = toWesternDigits(normalize(phrase));
  // رقم مكتوب رقماً: (6) أو (٦) — بشرط ألا تبقى حروف عربية بعد إزالة الأرقام.
  const m = p.match(/\d+/);
  if (m && !/[؀-ۿ]/.test(p.replace(/\d/g, ""))) return parseInt(m[0], 10);
  let total = 0;
  let found = false;
  for (let tok of p.split(/[\sـ]+/)) {
    tok = tok.replace(/^و?ال/, "").replace(/^و/, "");
    if (SKIP.has(tok)) continue;
    if (tok in ORDINAL) { total += ORDINAL[tok]; found = true; }
  }
  return found && total > 0 ? total : null;
}

// إشارة صريحة: «المادة/المادتين (ترتيبية) [و(ترتيبية)] من (هذا) النظام»
const REF = /الماد(?:ة|ه|تين|تي)\s*\(?\s*([^)\n]{2,45}?)\s*\)?(?:\s*و\s*\(?\s*([^)\n]{2,45}?)\s*\)?)?\s*من\s+(?:هذا\s+)?النظام/gu;

/** يرجّع أرقام مواد النظام المُشار إليها صراحةً داخل نصّ، مع الدليل النصّي، بلا تكرار وبالترتيب. */
export function extractSystemRefs(text: string): Array<{ number: number; evidence: string }> {
  const out: Array<{ number: number; evidence: string }> = [];
  const seen = new Set<number>();
  for (const match of (text || "").matchAll(REF)) {
    for (const g of [match[1], match[2]]) {
      if (!g) continue;
      const n = parseOrdinal(g);
      if (n && !seen.has(n)) { seen.add(n); out.push({ number: n, evidence: g.trim() }); }
    }
  }
  return out;
}
