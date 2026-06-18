import { prisma } from "@/lib/prisma";
import { embedText, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { resolveEntity, type EntityType } from "@/lib/modules/knowledge-graph/relations";
import type { LegalEntityType, RawResult, SearchProvider, SearchQuery } from "./search-provider";

// مزوّد البحث الدلالي (pgvector). يعتمد على متجهات مخزّنة في جدول embeddings
// ودالة تضمين للسؤال. غير متاح إن لم يُفعّل التضمين أو لم تُخزَّن متجهات.
export const vectorProvider: SearchProvider = {
  name: "vector",

  async isAvailable() {
    if (!semanticSearchEnabled()) return false;
    try {
      const count = await prisma.embedding.count();
      return count > 0;
    } catch {
      return false; // جدول embeddings أو امتداد vector غير مُفعّل بعد
    }
  },

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    try {
      const vec = await embedText(q.trim());
      if (!vec || vec.length === 0) return [];
      const literal = `[${vec.map((x) => Number(x)).join(",")}]`;
      const take = Math.min(limit, 20);

      const rows = await prisma.$queryRawUnsafe<Array<{ owner_type: string; owner_id: string; score: number }>>(
        `SELECT owner_type, owner_id, (1 - (embedding <=> '${literal}'::vector)) AS score
         FROM embeddings
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> '${literal}'::vector
         LIMIT ${take}`
      );

      const results: RawResult[] = [];
      for (const row of rows) {
        const type = row.owner_type as EntityType;
        if (type !== "article" && type !== "ruling" && type !== "principle") continue;
        const entity = await resolveEntity(type, row.owner_id);
        if (!entity.exists) continue;
        const score = Math.max(0, Math.min(1, Number(row.score)));
        results.push({
          type: type as LegalEntityType,
          id: row.owner_id,
          title: entity.label,
          score,
          source: "vector",
          reason: `تشابه دلالي (${(score * 100).toFixed(0)}%)`,
        });
      }
      return results;
    } catch {
      return []; // أي تعذّر (امتداد/تضمين) لا يكسر البحث
    }
  },
};
