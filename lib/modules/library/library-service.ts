import { prisma } from "@/lib/prisma";

export async function searchLegalArticles(query: string, limit = 8) {
  const normalized = query.trim();
  if (!normalized) {
    return prisma.legalArticle.findMany({
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: limit
    });
  }

  return prisma.legalArticle.findMany({
    where: {
      OR: [
        { content: { contains: normalized, mode: "insensitive" } },
        { title: { contains: normalized, mode: "insensitive" } },
        { lawName: { contains: normalized, mode: "insensitive" } },
        { keywords: { has: normalized } }
      ]
    },
    take: limit,
    orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }]
  });
}

export async function getLibraryStats() {
  const [total, laws] = await Promise.all([
    prisma.legalArticle.count(),
    prisma.legalArticle.groupBy({
      by: ["lawName"],
      _count: { _all: true },
      orderBy: { lawName: "asc" }
    })
  ]);

  return { total, laws };
}
