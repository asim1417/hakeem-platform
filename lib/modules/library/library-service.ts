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
          id: system.id as string | null,
          lawName: system.name,
          classification: system.classification,
          count: system.articleCount
        }))
      : groupedLaws.map((law) => ({
          id: null as string | null,
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

export type SystemTreeChapter = {
  chapter: string;
  articles: Array<{ id: string; articleNumber: number; title: string }>;
};

/**
 * تفاصيل نظام واحد مع مواده مرتّبة ومجمّعة بالفصول (شجرة) للعرض الهرمي.
 * يقبل معرّف النظام (id) أو اسمه (name) لمرونة الربط.
 */
export async function getSystemDetail(idOrName: string) {
  const key = idOrName.trim();
  const system =
    (await prisma.legalSystem.findUnique({ where: { id: key } }).catch(() => null)) ??
    (await prisma.legalSystem.findFirst({ where: { name: key } }).catch(() => null));

  const lawName = system?.name ?? key;
  const articles = await prisma.legalArticle.findMany({
    where: { lawName },
    orderBy: { articleNumber: "asc" },
    select: { id: true, articleNumber: true, title: true, chapter: true }
  });

  // تجميع بالفصول مع الحفاظ على ترتيب الظهور.
  const order: string[] = [];
  const byChapter = new Map<string, SystemTreeChapter["articles"]>();
  for (const a of articles) {
    const ch = (a.chapter ?? "").trim() || "مواد النظام";
    if (!byChapter.has(ch)) {
      byChapter.set(ch, []);
      order.push(ch);
    }
    byChapter.get(ch)!.push({ id: a.id, articleNumber: a.articleNumber, title: a.title });
  }
  const chapters: SystemTreeChapter[] = order.map((chapter) => ({ chapter, articles: byChapter.get(chapter)! }));

  return {
    lawName,
    classification: system?.classification ?? null,
    articleCount: articles.length,
    chapterCount: chapters.length,
    chapters
  };
}
