import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

/** وسم تخزين النواة القانونية — لإبطال الكاش عند تحديث البيانات. */
export const LEGAL_CORE_CACHE_TAG = "legal-core";
const CACHE_TTL = 600; // ثوانٍ (محتوى نظامي شبه ثابت)

/** إبطال كاش النواة القانونية (يُستدعى بعد استيراد/تحديث المواد من مسار خادمي). */
export function revalidateLegalCoreCache() {
  revalidateTag(LEGAL_CORE_CACHE_TAG);
}

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

export const getLibraryStats = unstable_cache(_getLibraryStats, ["library:stats"], {
  revalidate: CACHE_TTL,
  tags: [LEGAL_CORE_CACHE_TAG]
});

async function _getLibraryStats() {
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

// ── طبقة وصول موحّدة للأنظمة/المواد (DAL) — تُخرج prisma من الصفحات ──

export interface SystemRow {
  lawName: string;
  classification: string | null;
  count: number;
}

export interface SystemsQuery {
  q?: string;
  classification?: string;
  page?: number;
  pageSize?: number;
}

export interface SystemsResult {
  items: SystemRow[];
  total: number;
  page: number;
  pageSize: number;
  classifications: string[];
}

/** قائمة الأنظمة مع بحث + تصفية بالتصنيف + ترقيم (لصفحة الأنظمة). */
export async function listSystems(opts: SystemsQuery = {}): Promise<SystemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(60, Math.max(6, opts.pageSize ?? 24));
  const q = opts.q?.trim();
  const classification = opts.classification?.trim();
  const skip = (page - 1) * pageSize;

  const systemCount = await prisma.legalSystem.count().catch(() => 0);

  if (systemCount > 0) {
    const where: Record<string, unknown> = {};
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (classification) where.classification = classification;
    const [rows, total, classRows] = await Promise.all([
      prisma.legalSystem.findMany({
        where,
        orderBy: [{ articleCount: "desc" }, { name: "asc" }],
        skip,
        take: pageSize
      }),
      prisma.legalSystem.count({ where }),
      prisma.legalSystem.findMany({
        where: { classification: { not: null } },
        select: { classification: true },
        distinct: ["classification"],
        orderBy: { classification: "asc" }
      })
    ]);
    return {
      items: rows.map((s) => ({ lawName: s.name, classification: s.classification, count: s.articleCount })),
      total,
      page,
      pageSize,
      classifications: classRows.map((c) => c.classification).filter((c): c is string => !!c)
    };
  }

  // سقوط آمن: جدول legal_systems فارغ → اشتقاق من المواد (بلا تصنيف)
  const grouped = await prisma.legalArticle
    .groupBy({ by: ["lawName"], _count: { _all: true } })
    .catch(() => [] as { lawName: string; _count: { _all: number } }[]);
  let laws: SystemRow[] = grouped.map((g) => ({ lawName: g.lawName, classification: null, count: g._count._all }));
  if (q) laws = laws.filter((l) => l.lawName.includes(q));
  laws.sort((a, b) => b.count - a.count || a.lawName.localeCompare(b.lawName, "ar"));
  return { items: laws.slice(skip, skip + pageSize), total: laws.length, page, pageSize, classifications: [] };
}

/** قائمة مبسّطة للأنظمة (للمرشّحات والقوائم المنسدلة). */
export const listAllSystems = unstable_cache(
  () =>
    prisma.legalSystem
      .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, classification: true } })
      .catch(() => [] as { id: string; name: string; classification: string | null }[]),
  ["library:all-systems"],
  { revalidate: CACHE_TTL, tags: [LEGAL_CORE_CACHE_TAG] }
);

/** عدد التصنيفات المميّزة غير الفارغة (لإحصاء اللوحة). */
export const getClassificationCount = unstable_cache(
  async (): Promise<number> => {
    const rows = await prisma.legalArticle
      .groupBy({ by: ["classification"], _count: { _all: true } })
      .catch(() => [] as { classification: string | null }[]);
    return rows.filter((r) => r.classification).length;
  },
  ["library:classification-count"],
  { revalidate: CACHE_TTL, tags: [LEGAL_CORE_CACHE_TAG] }
);

/** عدد المواد التي تحتاج إثراء/مراجعة (تصنيف/باب/كلمات مفتاحية ناقصة). */
export const countArticlesNeedingReview = unstable_cache(
  (): Promise<number> =>
    prisma.legalArticle
      .count({ where: { OR: [{ classification: null }, { chapter: null }, { keywords: { isEmpty: true } }] } })
      .catch(() => 0),
  ["library:needs-review-count"],
  { revalidate: CACHE_TTL, tags: [LEGAL_CORE_CACHE_TAG] }
);

/** عدد الأحكام القضائية. */
export const countJudicialCases = unstable_cache(() => prisma.judicialCase.count().catch(() => 0), ["library:judicial-count"], {
  revalidate: CACHE_TTL,
  tags: [LEGAL_CORE_CACHE_TAG]
});

/** تفاصيل المادة مع روابط الأحكام (لصفحة المادة). */
export function getArticleDetail(id: string) {
  return prisma.legalArticle
    .findUnique({
      where: { id },
      include: {
        caseLinks: {
          include: {
            judicialCase: {
              select: {
                id: true,
                judgmentTitle: true,
                caseNo: true,
                decisionNo: true,
                court: true,
                cityName: true,
                decisionDateText: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 8
        }
      }
    })
    .catch(() => null);
}

/** يحلّ معرّفات المواد (cuid) من أزواج (lawName, articleNumber) — لربط الواجهة بصفحة المادة. */
export async function resolveArticleIds(
  pairs: { lawName: string; articleNumber: number }[]
): Promise<Map<string, string>> {
  if (!pairs.length) return new Map();
  const rows = await prisma.legalArticle
    .findMany({ where: { OR: pairs }, select: { id: true, lawName: true, articleNumber: true } })
    .catch(() => [] as { id: string; lawName: string; articleNumber: number }[]);
  return new Map(rows.map((r) => [`${r.lawName}|${r.articleNumber}`, r.id]));
}

/** المواد ذات الصلة (نفس النظام أو التصنيف). */
export function getRelatedArticles(article: { id: string; lawName: string; classification: string | null }) {
  return prisma.legalArticle
    .findMany({
      where: {
        id: { not: article.id },
        OR: [{ lawName: article.lawName }, article.classification ? { classification: article.classification } : { lawName: article.lawName }]
      },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: 6,
      select: { id: true, lawName: true, articleNumber: true, title: true }
    })
    .catch(() => []);
}
