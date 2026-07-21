// ─────────────────────────────────────────────────────────────────────────────
// البحث الفوريّ داخل مستندات القضية — يعيد استخدام محرّك «منصّة الوثائق» (BM25 الاشتقاقيّ)
// نفسه فوق نصوص مرفقات القضية. فبدل حقن مقتطفٍ مبتور، يُسترجَع أكثر المقاطع صلةً بسؤال
// القاضي، فيبحث الموجّه والخدمات داخل المستندات فورًا. لا محرّكَ جديد — إعادة استخدام.
// ─────────────────────────────────────────────────────────────────────────────
import { normStr, parseQuery, buildBm25Index, queryStems, bm25Score } from "@/lib/modules/document-inspection/search";
import type { JudicialCase } from "./types";

export interface CasePassage {
  attId: string;
  attName: string;
  text: string;
  score: number;
}

/** يقسّم نصّ مرفقٍ إلى مقاطعَ متقاربة الحجم (فقرات، مع تنويمٍ للطويل). */
function chunkText(text: string, target = 700): string[] {
  const paras = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && (buf.length + p.length + 1) > target) { chunks.push(buf); buf = p; }
    else buf = buf ? `${buf}\n${p}` : p;
    while (buf.length > target * 1.7) { chunks.push(buf.slice(0, target)); buf = buf.slice(target); }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

/**
 * يبحث في مستندات القضية (مرفقاتها) عن أكثر المقاطع صلةً بالاستعلام — بمحرّك BM25 الاشتقاقيّ.
 * فشلٌ/استعلامٌ فارغ ⇒ [] فلا يتعطّل المستدعي.
 */
export function searchCaseDocuments(kase: JudicialCase, query: string, topK = 6): CasePassage[] {
  try {
    const passages: Array<{ attId: string; attName: string; text: string }> = [];
    for (const a of kase.attachments) {
      for (const c of chunkText(a.text)) passages.push({ attId: a.id, attName: a.name, text: c });
    }
    if (!passages.length) return [];

    const P = parseQuery(query);
    const stems = queryStems(P);
    if (!stems.length) return [];

    const idx = buildBm25Index(passages.map((p) => normStr(p.text)));
    const scored = passages.map((p, i) => ({ ...p, score: bm25Score(idx, i, stems) }));
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
  } catch {
    return [];
  }
}

/**
 * نصُّ مستندات القضية لحقنه في prompt الخدمة: أكثر المقاطع صلةً بالاستعلام (بحثٌ فوريّ)
 * محدودًا بسقفٍ إجماليّ، ومع سقوطٍ آمنٍ إلى مقتطفٍ مبتور عند غياب تطابق.
 */
export function buildRelevantDocs(kase: JudicialCase, query: string, budget = 10_000, topK = 8): string {
  const passages = searchCaseDocuments(kase, query, topK);
  if (passages.length) {
    const parts: string[] = [];
    let used = 0;
    for (const p of passages) {
      if (used + p.text.length > budget && parts.length) break;
      used += p.text.length;
      parts.push(`— «${p.attName}»:\n${p.text}`);
    }
    if (parts.length) return parts.join("\n\n");
  }
  let b = budget;
  return kase.attachments
    .map((a) => { const s = a.text.slice(0, Math.max(0, b)); b -= s.length; return s ? `— «${a.name}»:\n${s}` : ""; })
    .filter(Boolean)
    .join("\n\n");
}
