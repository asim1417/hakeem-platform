/**
 * HKM-061: قراءات خريطة الموقع وقابلية الفهرسة — قراءة فقط، استعلام واحد لكل ملف.
 * تمر بمنفذ SqlClient (Prisma في الإنتاج، pg في الاختبار المحلي)، فلا تعتمد على محرك Prisma.
 *
 * «آخر تغيير للمادة» = أحدث الثلاثة: legal_articles."updatedAt"، وأحدث نسخة في article_versions،
 * وأحدث نسخة نص معدّلة في unit_version. الأعمدة الأولى timestamp بلا منطقة (UTC عند Prisma)،
 * فتُحوَّل بـ AT TIME ZONE 'UTC'؛ وunit_version.created_at timestamptz أصلًا.
 */
import type { SqlClient } from "@/lib/modules/legal-core/sql-port";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";
import { EDGE_SPACE_PATTERN, systemTextChars, type SystemContentSignal } from "@/lib/modules/seo/indexability";
import { ARTICLES_PER_SITEMAP, type ArticleChunkPlan } from "@/lib/modules/seo/sitemap";

/** صفوف المواد المعروضة: رقم > 0 ودرجة «مكرر» بين 0 و99 (كما تقبلها صفحة المادة). */
const ARTICLE_FILTER = `a."articleNumber" > 0 AND a."articleBis" >= 0 AND a."articleBis" < ${NON_ARTICLE_BIS}`;

/** ترتيب ثابت للمواد؛ الفهرس وملف المواد يستعملانه معًا فيتطابق التقسيم. */
const ARTICLE_ORDER = `s.sort_order, a."legalSystemId", a."articleNumber", a."articleBis"`;

const VERSION_CTES = `av AS (SELECT article_id AS id, max(created_at) AT TIME ZONE 'UTC' AS t FROM article_versions GROUP BY article_id),
uv AS (SELECT unit_id AS id, max(created_at) AS t FROM unit_version GROUP BY unit_id)`;

export const SQL_ARTICLE_CHUNK_PLAN = `WITH ${VERSION_CTES},
art AS (
  SELECT row_number() OVER (ORDER BY ${ARTICLE_ORDER}) - 1 AS rn,
         GREATEST(a."updatedAt" AT TIME ZONE 'UTC', av.t, uv.t) AS lastmod
  FROM legal_articles a
  JOIN legal_systems s ON s.id = a."legalSystemId"
  LEFT JOIN av ON av.id = a.id
  LEFT JOIN uv ON uv.id = a.id
  WHERE ${ARTICLE_FILTER}
)
SELECT (rn / $1::int)::int AS chunk, count(*)::int AS urls, max(lastmod) AS "lastModified" FROM art GROUP BY 1
UNION ALL
SELECT -1, count(*)::int,
       GREATEST(max(s."updatedAt") AT TIME ZONE 'UTC', max(s.preamble_updated_at) AT TIME ZONE 'UTC', (SELECT max(c.created_at) FROM law_card c))
FROM legal_systems s
ORDER BY 1`;

export const SQL_ARTICLE_CHUNK = `WITH page AS (
  SELECT a.id, s.name, s.eli_slug, s.sort_order, a."legalSystemId" AS sid, a."articleNumber" AS n, a."articleBis" AS bis,
         a."updatedAt" AT TIME ZONE 'UTC' AS updated
  FROM legal_articles a
  JOIN legal_systems s ON s.id = a."legalSystemId"
  WHERE ${ARTICLE_FILTER}
  ORDER BY ${ARTICLE_ORDER}
  OFFSET $1::int LIMIT $2::int
)
SELECT p.name, p.eli_slug AS "eliSlug", p.n AS "articleNumber", p.bis AS "articleBis",
       GREATEST(p.updated,
                (SELECT max(v.created_at) FROM article_versions v WHERE v.article_id = p.id) AT TIME ZONE 'UTC',
                (SELECT max(u.created_at) FROM unit_version u WHERE u.unit_id = p.id)) AS "lastModified"
FROM page p
ORDER BY p.sort_order, p.sid, p.n, p.bis`;

/**
 * كل الأنظمة مع إشارة المحتوى. textChars يُحسب فقط للنظام بلا مواد (null لغيره)، بمنطق الصفحة:
 * كتل آخر بطاقة law_card إن كانت مصفوفة غير فارغة، وإلا الديباجة؛ والتشذيب بنمط EDGE_SPACE_PATTERN ($1).
 */
export const SQL_SITEMAP_SYSTEMS = `WITH ${VERSION_CTES},
arts AS (
  SELECT a."legalSystemId" AS sid, count(*)::int AS n, max(GREATEST(a."updatedAt" AT TIME ZONE 'UTC', av.t, uv.t)) AS t
  FROM legal_articles a
  LEFT JOIN av ON av.id = a.id
  LEFT JOIN uv ON uv.id = a.id
  WHERE ${ARTICLE_FILTER}
  GROUP BY a."legalSystemId"
)
SELECT s.name, s.eli_slug AS "eliSlug", COALESCE(arts.n, 0) AS "articleCount",
       CASE
         WHEN COALESCE(arts.n, 0) > 0 THEN NULL
         WHEN jsonb_typeof(card.text_blocks) = 'array' AND jsonb_array_length(card.text_blocks) > 0 THEN
           (SELECT COALESCE(sum(char_length(regexp_replace(COALESCE(b->>'text', ''), $1, '', 'g'))), 0)::int
            FROM jsonb_array_elements(card.text_blocks) b)
         ELSE char_length(regexp_replace(COALESCE(s.preamble, ''), $1, '', 'g'))
       END AS "textChars",
       GREATEST(s."updatedAt" AT TIME ZONE 'UTC', s.preamble_updated_at AT TIME ZONE 'UTC', arts.t, card.created_at) AS "lastModified"
FROM legal_systems s
LEFT JOIN arts ON arts.sid = s.id
LEFT JOIN LATERAL (
  SELECT c.text_blocks, c.created_at FROM law_card c WHERE c.system_id = s.id ORDER BY c.created_at DESC, c.id DESC LIMIT 1
) card ON true
ORDER BY s.sort_order, s.id`;

/**
 * إشارة محتوى نظام واحد لصفحته: هل له مادة معروضة (بشرط الصفحة نفسه: المعرّف أو اسم النظام)،
 * وكتل آخر بطاقة إن لم تكن له مواد.
 */
export const SQL_SYSTEM_SIGNAL = `WITH h AS (
  SELECT EXISTS (
    SELECT 1 FROM legal_articles a
    WHERE (a."legalSystemId" = $1 OR a."lawName" = $2) AND a."articleNumber" > 0 AND a."articleBis" < ${NON_ARTICLE_BIS}
  ) AS has
)
SELECT h.has AS "hasArticles",
       CASE WHEN h.has THEN NULL
            ELSE (SELECT c.text_blocks FROM law_card c WHERE c.system_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1)
       END AS "cardBlocks"
FROM h`;

type Ts = Date | string | null;

function toDate(v: Ts): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** خطة ملفات المواد وتاريخ آخر تغيير للأنظمة — استعلام واحد للفهرس. */
export async function loadSitemapPlan(db: SqlClient): Promise<{ articleChunks: ArticleChunkPlan[]; systemsLastModified: Date | null }> {
  const rows = await db.query<{ chunk: number; urls: number; lastModified: Ts }>(SQL_ARTICLE_CHUNK_PLAN, [ARTICLES_PER_SITEMAP]);
  const articleChunks: ArticleChunkPlan[] = [];
  let systemsLastModified: Date | null = null;
  for (const r of rows) {
    const chunk = Number(r.chunk);
    if (chunk < 0) systemsLastModified = toDate(r.lastModified);
    else articleChunks.push({ chunk, urls: Number(r.urls), lastModified: toDate(r.lastModified) });
  }
  return { articleChunks, systemsLastModified };
}

export interface SitemapArticleRow {
  name: string;
  eliSlug: string | null;
  articleNumber: number;
  articleBis: number;
  lastModified: Date | null;
}

/** ملف مواد واحد (chunk يبدأ من 0) — استعلام واحد. */
export async function loadArticleChunk(db: SqlClient, chunk: number): Promise<SitemapArticleRow[]> {
  if (!Number.isInteger(chunk) || chunk < 0) return [];
  const rows = await db.query<{ name: string; eliSlug: string | null; articleNumber: number; articleBis: number; lastModified: Ts }>(
    SQL_ARTICLE_CHUNK,
    [chunk * ARTICLES_PER_SITEMAP, ARTICLES_PER_SITEMAP],
  );
  return rows.map((r) => ({
    name: r.name,
    eliSlug: r.eliSlug,
    articleNumber: Number(r.articleNumber),
    articleBis: Number(r.articleBis),
    lastModified: toDate(r.lastModified),
  }));
}

export interface SitemapSystemRow {
  name: string;
  eliSlug: string | null;
  signal: SystemContentSignal;
  lastModified: Date | null;
}

/** كل الأنظمة بإشارة محتواها — استعلام واحد؛ التصفية بـ isSystemIndexable عند المستدعي. */
export async function loadSitemapSystems(db: SqlClient): Promise<SitemapSystemRow[]> {
  const rows = await db.query<{ name: string; eliSlug: string | null; articleCount: number; textChars: number | null; lastModified: Ts }>(
    SQL_SITEMAP_SYSTEMS,
    [EDGE_SPACE_PATTERN],
  );
  return rows.map((r) => ({
    name: r.name,
    eliSlug: r.eliSlug,
    signal: { articleCount: Number(r.articleCount), textChars: Number(r.textChars ?? 0) },
    lastModified: toDate(r.lastModified),
  }));
}

/**
 * إشارة محتوى صفحة نظام واحد. null عند أي خطأ قراءة، فيبقى الافتراضي «قابل للفهرسة»
 * (systemPageRobots(null) لا يضع noindex).
 */
export async function loadSystemContentSignal(
  db: SqlClient,
  system: { id: string; name: string; preamble: string | null },
): Promise<SystemContentSignal | null> {
  try {
    const [row] = await db.query<{ hasArticles: boolean; cardBlocks: unknown }>(SQL_SYSTEM_SIGNAL, [system.id, system.name]);
    if (!row) return null;
    if (row.hasArticles) return { articleCount: 1, textChars: 0 };
    const blocks = Array.isArray(row.cardBlocks) ? (row.cardBlocks as Array<{ text?: unknown }>) : null;
    return { articleCount: 0, textChars: systemTextChars({ cardBlocks: blocks, preamble: system.preamble }) };
  } catch {
    return null;
  }
}
