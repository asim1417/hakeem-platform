import "server-only";
import { prisma } from "@/lib/prisma";

export interface SearchSuggestion {
  value: string;
  kind: "system" | "popular";
  hint?: string;
}

/**
 * اقتراحات بحث فورية من مصدرين حقيقيين في القاعدة:
 *   1) أسماء الأنظمة المطابقة للمدخل (LegalSystem).
 *   2) عبارات البحث الشائعة سابقًا (SearchLog) — مجهّلة، تجميعية فقط.
 * آمنة: أي خطأ أو غياب جدول يُعيد قائمة فارغة دون كسر الواجهة.
 */
export async function getSearchSuggestions(qRaw: string, limit = 8): Promise<SearchSuggestion[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const half = Math.max(2, Math.ceil(limit / 2));

  const [systems, popular] = await Promise.all([
    prisma.legalSystem
      .findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { name: true, articleCount: true },
        orderBy: { articleCount: "desc" },
        take: limit,
      })
      .catch(() => [] as Array<{ name: string; articleCount: number }>),
    prisma.searchLog
      .groupBy({
        by: ["query"],
        where: { query: { contains: q, mode: "insensitive" } },
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: limit,
      })
      .catch(() => [] as Array<{ query: string; _count: { query: number } }>),
  ]);

  const seen = new Set<string>();
  const out: SearchSuggestion[] = [];

  for (const s of systems.slice(0, limit)) {
    const key = s.name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: key, kind: "system", hint: s.articleCount ? `${s.articleCount} مادة` : "نظام" });
    if (out.length >= half) break;
  }

  for (const p of popular) {
    const key = p.query.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: key, kind: "popular", hint: "بحث شائع" });
    if (out.length >= limit) break;
  }

  // أكمل من الأنظمة المتبقّية إن بقي متّسع.
  for (const s of systems) {
    if (out.length >= limit) break;
    const key = s.name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: key, kind: "system", hint: s.articleCount ? `${s.articleCount} مادة` : "نظام" });
  }

  return out.slice(0, limit);
}

/**
 * اقتراحات «هل تقصد؟» عند صفر نتائج — تصحيح إملائي عبر word_similarity (pg_trgm)
 * على مفردات مختصرة موثوقة: أسماء الأنظمة + مصطلحات المعجم. يُشغَّل فقط على الاستعلامات
 * التي لم تُرجِع نتائج (نادر)، فمسح الجدولين الصغيرين مقبول. آمن: أي خطأ يُعيد [].
 */
export async function getDidYouMeanSuggestions(qRaw: string, limit = 4): Promise<string[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const take = Math.max(1, Math.min(limit, 8));
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ candidate: string; sim: number }>>(
      `SELECT candidate, MAX(sim) AS sim FROM (
         SELECT "name" AS candidate, word_similarity($1, "name") AS sim FROM "legal_systems"
         UNION ALL
         SELECT "term" AS candidate, word_similarity($1, "term") AS sim FROM "glossary_terms"
       ) t
       WHERE sim > 0.35 AND lower(candidate) <> lower($1)
       GROUP BY candidate
       ORDER BY sim DESC
       LIMIT ${take}`,
      q
    );
    return rows.map((r) => r.candidate).filter((v) => typeof v === "string" && v.trim().length > 0);
  } catch {
    return []; // pg_trgm غير مفعّل أو جدول مفقود — سقوط آمن
  }
}
