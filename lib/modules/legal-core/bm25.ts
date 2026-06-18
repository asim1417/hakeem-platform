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
import { tokenize } from "./bm25-tokenizer";

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
