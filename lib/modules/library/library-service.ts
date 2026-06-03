import { prisma } from "@/lib/prisma";

export async function searchLegalArticles(query: string, limit = 8, lawName?: string) {
  const normalized = query.trim();
  const lawFilter = lawName?.trim();
  const lawWhere = lawFilter ? { lawName: lawFilter } : {};

  if (!normalized) {
    return prisma.legalArticle.findMany({
      where: lawWhere,
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: limit
    });
  }

  return prisma.legalArticle.findMany({
    where: {
      AND: [
        lawWhere,
        {
          OR: [
            { content: { contains: normalized, mode: "insensitive" } },
            { title: { contains: normalized, mode: "insensitive" } },
            { lawName: { contains: normalized, mode: "insensitive" } },
            { keywords: { has: normalized } }
          ]
        }
      ]
    },
    take: limit,
    orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }]
  });
}

export async function getLibraryStats() {
  const [total, systems, groupedLaws] = await Promise.all([
    prisma.legalArticle.count(),
    prisma.legalSystem.findMany({
      orderBy: { name: "asc" }
    }),
    prisma.legalArticle.groupBy({
      by: ["lawName"],
      _count: { _all: true },
      orderBy: { lawName: "asc" }
    })
  ]);

  const laws =
    systems.length > 0
      ? systems.map((system) => ({
          lawName: system.name,
          classification: system.classification,
          count: system.articleCount
        }))
      : groupedLaws.map((law) => ({
          lawName: law.lawName,
          classification: null,
          count: law._count._all
        }));

  return {
    total,
    systemCount: laws.length,
    laws
  };
}
