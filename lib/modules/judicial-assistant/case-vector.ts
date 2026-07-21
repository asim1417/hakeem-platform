// ─────────────────────────────────────────────────────────────────────────────
// البحث الدلاليّ في مستندات القضية (كمشاريع Claude/ChatGPT): يُضمّن مقاطع المرفقات
// (embeddings) ويرتّبها بالمعنى لا بالحروف. فهرسةٌ **كسولة**: عند أوّل بحثٍ للقضية تُضمَّن
// مقاطعها وتُخزَّن (judicial_doc_chunks)، فتُعاد الاستفادة لاحقًا. يعيد استخدام خدمة تضمين
// النواة (ai/embeddings) — لا محرّكَ جديد. سقوطٌ آمن تامّ إلى البحث المعجميّ (BM25) عند غياب
// مفتاح التضمين أو أيّ فشل، فلا يتعطّل شيء.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { embedText, embedBatch, cosineSimilarity, parseStoredEmbedding, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { ensureJudicialSchema } from "./schema-ensure";
import { searchCaseDocuments, chunkText, formatPassages, type CasePassage } from "./case-search";
import type { JudicialCase } from "./types";

interface ChunkRow { att_id: string; ord: number; text: string; embedding: unknown }

/** يبني/يُكمّل فهرس متجهات مستندات القضية (كسولًا) ثمّ يرتّب المقاطع بالتشابه الدلاليّ. */
async function semanticPassages(kase: JudicialCase, query: string, topK: number): Promise<CasePassage[] | null> {
  if (!semanticSearchEnabled() || !kase.attachments.length) return null;
  const qvec = await embedText(query);
  if (!qvec) return null;
  if (!(await ensureJudicialSchema())) return null;

  // المقاطع المرغوبة من المرفقات الحاليّة (ترتيبٌ حتميّ ⇒ ord ثابت).
  const desired: Array<{ attId: string; ord: number; text: string; name: string }> = [];
  for (const a of kase.attachments) chunkText(a.text).forEach((t, ord) => desired.push({ attId: a.id, ord, text: t, name: a.name }));
  if (!desired.length) return [];

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT att_id, ord, text, embedding FROM "judicial_doc_chunks" WHERE case_id = $1::uuid`, kase.id,
  ).catch(() => [])) as ChunkRow[];
  const have = new Map<string, ChunkRow>(existing.map((r) => [`${r.att_id}:${r.ord}`, r]));

  // تنظيف مقاطع المرفقات المحذوفة (أفضل جهد).
  const currentAtt = new Set(kase.attachments.map((a) => a.id));
  const stale = existing.filter((r) => !currentAtt.has(r.att_id)).map((r) => r.att_id);
  if (stale.length) await prisma.$executeRawUnsafe(`DELETE FROM "judicial_doc_chunks" WHERE case_id = $1::uuid AND att_id = ANY($2::text[])`, kase.id, stale).catch(() => undefined);

  // تضمين المقاطع الناقصة وتخزينها.
  const missing = desired.filter((d) => !have.has(`${d.attId}:${d.ord}`));
  if (missing.length) {
    const vecs = await embedBatch(missing.map((m) => m.text));
    for (let i = 0; i < missing.length; i += 1) {
      const m = missing[i];
      const v = vecs[i];
      await prisma.$executeRawUnsafe(
        `INSERT INTO "judicial_doc_chunks" (case_id, att_id, ord, text, embedding) VALUES ($1::uuid,$2,$3,$4,$5::jsonb)
         ON CONFLICT (case_id, att_id, ord) DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding`,
        kase.id, m.attId, m.ord, m.text, v ? JSON.stringify(v) : null,
      ).catch(() => undefined);
      if (v) have.set(`${m.attId}:${m.ord}`, { att_id: m.attId, ord: m.ord, text: m.text, embedding: v });
    }
  }

  // ترتيبٌ بالتشابه الدلاليّ.
  const scored = desired.map((d) => {
    const row = have.get(`${d.attId}:${d.ord}`);
    const emb = row ? parseStoredEmbedding(row.embedding) : null;
    return { attId: d.attId, attName: d.name, text: d.text, score: emb ? cosineSimilarity(qvec, emb) : -1 };
  });
  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
  return ranked.length ? ranked : null;
}

/** يسترجع أكثر مقاطع مستندات القضية صلةً: دلاليًّا إن أمكن، وإلا معجميًّا (BM25). */
export async function retrieveCasePassages(kase: JudicialCase, query: string, topK = 6): Promise<CasePassage[]> {
  try {
    const sem = await semanticPassages(kase, query, topK);
    if (sem && sem.length) return sem;
  } catch {
    /* سقوطٌ آمن */
  }
  return searchCaseDocuments(kase, query, topK);
}

/** نصُّ مستندات القضية لحقنه في prompt الخدمة — دلاليّ إن أمكن، ثمّ معجميّ، ثمّ مقتطف. */
export async function buildRelevantDocsAsync(kase: JudicialCase, query: string, budget = 10_000, topK = 8): Promise<string> {
  return formatPassages(kase, await retrieveCasePassages(kase, query, topK), budget);
}

/** يحذف فهرس متجهات قضيةٍ (عند حذف القضية) — أفضل جهد. */
export async function dropCaseVectors(caseId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM "judicial_doc_chunks" WHERE case_id = $1::uuid`, caseId).catch(() => undefined);
}
