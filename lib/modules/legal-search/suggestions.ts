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
