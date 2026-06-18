// المُجزّئ المشترك لفهرس BM25: تطبيع عربي + تجذير خفيف.
// يُستعمل من وقت التشغيل (bm25.ts) ومن مولّد الفهرس (build-bm25-index) لضمان تطابق المصطلحات.

const STOPWORDS = new Set(
  ["في","من","الي","علي","عن","مع","هذا","هذه","ذلك","التي","الذي","او","ام","ان","كل","بين","عند","لكن","قد","ما","لا","الا","به","بها","له","لها","هو","هي","كان","يكون","وهو","وهي","ثم","اي","كما","حتي","اذا","كانت","تكون","وقد"]
);
const PREFIXES = ["وال","بال","فال","كال","لل","ال","و"];
const SUFFIXES = ["تهما","هما","كما","هم","هن","كم","كن","نا","تها","ها","ات","ين","ون","يه","ه","ك","ي","ت"];
const MIN_STEM = 3;

export function normalizeArabic(text: string): string {
  if (!text) return "";
  return String(text)
    // أرقام عربية-هندية → لاتينية (U+0660..U+0669)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    // إزالة التشكيل والعلامات والتطويل فقط (لا تمسّ الحروف الأساسية)
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    // توحيد الألف: أ إ آ ٱ → ا
    .replace(/[أإآٱ]/g, "ا")
    // ى → ي ، ة → ه
    .replace(/ى/g, "ي").replace(/ة/g, "ه")
    // ؤ → و ، ئ → ي ، ء → حذف
    .replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "")
    // إبقاء الحروف العربية الأساسية (U+0621..U+064A) والأرقام واللاتينية والمسافات
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lightStem(w: string): string {
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= MIN_STEM) { w = w.slice(p.length); break; }
  }
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= MIN_STEM) { w = w.slice(0, -s.length); break; }
  }
  return w;
}

export function tokenize(text: string): string[] {
  const norm = normalizeArabic(text);
  if (!norm) return [];
  const out: string[] = [];
  for (const t of norm.split(" ")) {
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.push(lightStem(t));
  }
  return out;
}
