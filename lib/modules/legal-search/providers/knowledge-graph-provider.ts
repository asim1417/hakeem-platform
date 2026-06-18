import { prisma } from "@/lib/prisma";
import {
  getRelationsForEntity,
  resolveEntity,
  type EntityType,
} from "@/lib/modules/knowledge-graph/relations";
import type { LegalEntityType, RawResult, SearchProvider, SearchQuery } from "./search-provider";

// مزوّد اجتياز الرسم المعرفي: يجد مواد مطابقة للسؤال ثم يتوسّع عبر العلاقات
// ليُرجع الأحكام/المبادئ المرتبطة بها. غير كاسر إن كان الرسم فارغاً.
export const knowledgeGraphProvider: SearchProvider = {
  name: "knowledge_graph",

  async isAvailable() {
    try {
      await prisma.legalRelation.count();
      return true; // الجدول قابل للاستعلام (قد يكون فارغاً)
    } catch {
      return false;
    }
  },

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    try {
      // ١. بذور: مواد مطابقة نصياً
      const seeds = await prisma.legalArticle.findMany({
        where: { OR: [{ title: { contains: term, mode: "insensitive" } }, { content: { contains: term, mode: "insensitive" } }] },
        select: { id: true, lawName: true, articleNumber: true, title: true },
        take: 5,
      });
      if (seeds.length === 0) return [];

      const seen = new Set<string>();
      const results: RawResult[] = [];

      for (const seed of seeds) {
        const seedLabel = `${seed.lawName} م/${seed.articleNumber}`;
        const relations = await getRelationsForEntity("article", seed.id);
        for (const rel of relations) {
          // الطرف الآخر من العلاقة
          const otherType = (rel.sourceId === seed.id ? rel.targetType : rel.sourceType) as EntityType;
          const otherId = rel.sourceId === seed.id ? rel.targetId : rel.sourceId;
          if (otherType !== "article" && otherType !== "ruling" && otherType !== "principle") continue;
          const key = `${otherType}:${otherId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const entity = await resolveEntity(otherType, otherId);
          if (!entity.exists) continue;
          results.push({
            type: otherType as LegalEntityType,
            id: otherId,
            title: entity.label,
            score: Math.max(0.3, Math.min(1, rel.strength * 0.75)),
            source: "knowledge_graph",
            reason: `مرتبط بـ«${seedLabel}» عبر علاقة ${rel.relation}`,
            meta: { relationId: rel.id, relation: rel.relation, viaArticleId: seed.id },
          });
          if (results.length >= limit) return results;
        }
      }
      return results;
    } catch {
      return [];
    }
  },
};
