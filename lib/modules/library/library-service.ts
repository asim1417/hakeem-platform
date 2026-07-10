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

// ── طبقة وصول موحّدة للأنظمة/المواد (DAL) — تُخرج prisma من الصفحات ──

export interface SystemRow {
  id?: string | null;
  lawName: string;
  classification: string | null;
  code?: string | null;
  domain?: string | null;
  domainTitle?: string | null;
  sortOrder?: number;
  count: number;
}

export interface SystemsQuery {
  q?: string;
  classification?: string;
  domain?: string;
  page?: number;
  pageSize?: number;
  /** يستبعد الأنظمة بلا مواد (articleCount=0) — للواجهات العامة. */
  withArticlesOnly?: boolean;
}

export interface DomainRow {
  domain: string;
  domainTitle: string;
}

export interface SystemsResult {
  items: SystemRow[];
  total: number;
  page: number;
  pageSize: number;
  classifications: string[];
  domains: DomainRow[];
}

/** قائمة الأنظمة مع بحث + تصفية (تصنيف/مجال) + ترقيم، مرتّبة بـ sortOrder (لصفحة الأنظمة). */
export async function listSystems(opts: SystemsQuery = {}): Promise<SystemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  // احترام pageSize الوارد (١–٦٠)؛ الافتراضي ٢٤. (كان يُقسر إلى ٦ كحدّ أدنى.)
  const pageSize = Math.min(60, Math.max(1, opts.pageSize ?? 24));
  const q = opts.q?.trim();
  const classification = opts.classification?.trim();
  const domain = opts.domain?.trim();
  const skip = (page - 1) * pageSize;

  const systemCount = await prisma.legalSystem.count().catch(() => 0);

  if (systemCount > 0) {
    const where: Record<string, unknown> = {};
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (classification) where.classification = classification;
    if (domain) where.domain = domain;
    if (opts.withArticlesOnly) where.articleCount = { gt: 0 };
    const [rows, total, classRows, domainRows] = await Promise.all([
      prisma.legalSystem.findMany({
        where,
        // الترتيب المعتمد: sortOrder ثم عدد المواد ثم الاسم (يجمع أنظمة المجال معًا).
        orderBy: [{ sortOrder: "asc" }, { articleCount: "desc" }, { name: "asc" }],
        skip,
        take: pageSize
      }),
      prisma.legalSystem.count({ where }),
      prisma.legalSystem.findMany({
        where: { classification: { not: null } },
        select: { classification: true },
        distinct: ["classification"],
        orderBy: { classification: "asc" }
      }),
      prisma.legalSystem
        .findMany({ where: { domain: { not: null } }, select: { domain: true, domainTitle: true }, distinct: ["domain"], orderBy: { sortOrder: "asc" } })
        .catch(() => [] as { domain: string | null; domainTitle: string | null }[])
    ]);
    return {
      items: rows.map((s) => ({
        id: s.id,
        lawName: s.name,
        classification: s.classification,
        code: s.code,
        domain: s.domain,
        domainTitle: s.domainTitle,
        sortOrder: s.sortOrder,
        count: s.articleCount
      })),
      total,
      page,
      pageSize,
      classifications: classRows.map((c) => c.classification).filter((c): c is string => !!c),
      domains: domainRows
        .filter((d): d is { domain: string; domainTitle: string } => !!d.domain && !!d.domainTitle)
        .map((d) => ({ domain: d.domain, domainTitle: d.domainTitle }))
    };
  }

  // سقوط آمن: جدول legal_systems فارغ → اشتقاق من المواد (بلا تصنيف)
  const grouped = await prisma.legalArticle
    .groupBy({ by: ["lawName"], _count: { _all: true } })
    .catch(() => [] as { lawName: string; _count: { _all: number } }[]);
  let laws: SystemRow[] = grouped.map((g) => ({ lawName: g.lawName, classification: null, count: g._count._all }));
  if (q) laws = laws.filter((l) => l.lawName.includes(q));
  laws.sort((a, b) => b.count - a.count || a.lawName.localeCompare(b.lawName, "ar"));
  return { items: laws.slice(skip, skip + pageSize), total: laws.length, page, pageSize, classifications: [], domains: [] };
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
        legalSystem: { select: { id: true, name: true, code: true, eliSlug: true } },
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
