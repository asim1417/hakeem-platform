/**
 * بحث BM25 على فهرس النواة القانونية المُرمَّز (legal_codifier).
 * يقرأ الفهرس المضغوط مرة واحدة ويُخزّنه في الذاكرة. التطبيع/التجذير مطابقان
 * لمولّد الفهرس (web/search.mjs) لضمان تطابق المصطلحات.
 *
 * الفهرس مُولَّد من ترميز الأنظمة (16,037 مادة) برموز واستشهادات هرمية/مسطّحة.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

type Posting = Record<string, number>;
type Meta = {
  code: string;
  citation: string;
  law_id: string | number;
  article_number: number;
  law_name: string;
  snippet: string;
};
type Bm25Index = {
  params: { k1: number; b: number; N: number; avgdl: number };
  doc_len: Record<string, number>;
  df: Record<string, number>;
  postings: Record<string, Posting>;
  meta: Record<string, Meta>;
};

export type Bm25Hit = { code: string; score: number; meta: Meta };

let _index: Bm25Index | null = null;

export function loadBm25Index(): Bm25Index | null {
  if (_index) return _index;
  try {
    const p = path.join(process.cwd(), "data", "legal-bm25-index.json.gz");
    const buf = zlib.gunzipSync(fs.readFileSync(p));
    _index = JSON.parse(buf.toString("utf8")) as Bm25Index;
    return _index;
  } catch {
    return null; // سقوط آمن: تعذّر تحميل الفهرس
  }
}

const STOPWORDS = new Set(
  ["في","من","الي","علي","عن","مع","هذا","هذه","ذلك","التي","الذي","او","ام","ان","كل","بين","عند","لكن","قد","ما","لا","الا","به","بها","له","لها","هو","هي","كان","يكون","وهو","وهي","ثم","اي","كما","حتي","اذا","كانت","تكون","وقد"]
);
const PREFIXES = ["وال","بال","فال","كال","لل","ال","و"];
const SUFFIXES = ["تهما","هما","كما","هم","هن","كم","كن","نا","تها","ها","ات","ين","ون","يه","ه","ك","ي","ت"];
const MIN_STEM = 3;

function normalizeArabic(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "")
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lightStem(w: string): string {
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= MIN_STEM) { w = w.slice(p.length); break; }
  }
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= MIN_STEM) { w = w.slice(0, -s.length); break; }
  }
  return w;
}

function tokenize(text: string): string[] {
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

export function bm25Search(query: string, topK = 20): Bm25Hit[] {
  const index = loadBm25Index();
  if (!index) return [];
  const { params, doc_len, df, postings, meta } = index;
  const { k1, b, N, avgdl } = params;
  const scores = new Map<string, number>();
  for (const term of tokenize(query)) {
    const post = postings[term];
    if (!post) continue;
    const nq = df[term];
    const idf = Math.log(1 + (N - nq + 0.5) / (nq + 0.5));
    for (const docId in post) {
      const tf = post[docId];
      const dl = doc_len[docId];
      const denom = tf + k1 * (1 - b + (b * dl) / avgdl);
      scores.set(docId, (scores.get(docId) || 0) + (idf * (tf * (k1 + 1))) / denom);
    }
  }
  return [...scores.entries()]
    .sort((a, c) => c[1] - a[1])
    .slice(0, topK)
    .map(([code, score]) => ({ code, score: +score.toFixed(4), meta: meta[code] }));
}
