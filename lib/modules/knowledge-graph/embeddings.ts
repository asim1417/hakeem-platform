import { prisma } from "@/lib/prisma";

// ملاحظة: عمود embedding من نوع vector(1536) غير قابل للقراءة/الكتابة عبر عميل
// Prisma (Unsupported)؛ يُدار عبر SQL خام لاحقاً. هنا نكتفي بإحصاءات التغطية.

export interface EmbeddingStatus {
  totalEmbeddings: number;
  byOwnerType: Record<string, number>;
  corpus: { articles: number; rulings: number; principles: number };
  coverage: { articles: number; rulings: number; principles: number }; // نسبة مئوية
}

export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const [total, grouped, articles, rulings, principles] = await Promise.all([
    prisma.embedding.count(),
    prisma.embedding.groupBy({ by: ["ownerType"], _count: { _all: true } }),
    prisma.legalArticle.count(),
    prisma.judicialCase.count(),
    prisma.judicialPrinciple.count(),
  ]);

  const byOwnerType: Record<string, number> = {};
  for (const g of grouped) byOwnerType[g.ownerType] = g._count._all;

  const pct = (have: number, all: number) => (all > 0 ? Math.round((have / all) * 1000) / 10 : 0);

  return {
    totalEmbeddings: total,
    byOwnerType,
    corpus: { articles, rulings, principles },
    coverage: {
      articles: pct(byOwnerType["article"] ?? 0, articles),
      rulings: pct(byOwnerType["ruling"] ?? 0, rulings),
      principles: pct(byOwnerType["principle"] ?? 0, principles),
    },
  };
}
