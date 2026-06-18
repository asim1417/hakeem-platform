/**
 * build-bm25-index.ts — يولّد فهرس BM25 من مصدر النواة القانونية الرسمي
 * (data/legal_articles_export.json — مواد القاعدة الفعلية 1981)، فيتطابق الفهرس
 * مع المواد الموجودة فعلاً (كل نتيجة تقابلها مادة حقيقية). يستخدم المُجزّئ المشترك
 * نفسه المستعمل وقت التشغيل لضمان تطابق المصطلحات.
 *
 * التشغيل: npm run build:bm25   → يكتب data/legal-bm25-index.json.gz
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { tokenize } from "@/lib/modules/legal-core/bm25-tokenizer";

type RawArticle = { article_number: number | string; law_name: string; title?: string; content?: string; keywords?: string[] | null };

const K1 = 1.5;
const B = 0.75;

function main() {
  const src = path.join(process.cwd(), "data", "legal_articles_export.json");
  const out = path.join(process.cwd(), "data", "legal-bm25-index.json.gz");
  const articles = JSON.parse(fs.readFileSync(src, "utf8")) as RawArticle[];
  console.log(`📚 مصدر: ${articles.length.toLocaleString("ar-SA")} مادة`);

  const doc_len: Record<string, number> = {};
  const df: Record<string, number> = {};
  const postings: Record<string, Record<string, number>> = {};
  const meta: Record<string, { code: string; citation: string; law_id: string | number; article_number: number; law_name: string; snippet: string }> = {};

  let totalLen = 0;
  articles.forEach((a, i) => {
    const code = `a${i}`;
    const text = [a.title, a.content, Array.isArray(a.keywords) ? a.keywords.join(" ") : ""].filter(Boolean).join(" ");
    const tokens = tokenize(text);
    doc_len[code] = tokens.length;
    totalLen += tokens.length;

    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
    for (const term in tf) {
      (postings[term] ??= {})[code] = tf[term];
      df[term] = (df[term] ?? 0) + 1;
    }

    const num = Number(a.article_number);
    meta[code] = {
      code,
      citation: `${a.law_name} — المادة (${a.article_number})`,
      law_id: a.law_name,
      article_number: Number.isFinite(num) ? num : 0,
      law_name: a.law_name,
      snippet: (a.content ?? a.title ?? "").slice(0, 320),
    };
  });

  const N = articles.length;
  const avgdl = N ? totalLen / N : 0;
  const index = { params: { k1: K1, b: B, N, avgdl }, doc_len, df, postings, meta };

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(index), "utf8"));
  fs.writeFileSync(out, gz);
  console.log(`✅ كُتب الفهرس: ${out}`);
  console.log(`   مستندات=${N} · مصطلحات=${Object.keys(postings).length} · متوسط الطول=${avgdl.toFixed(1)} · الحجم=${(gz.length / 1024).toFixed(0)}KB`);
}

main();
