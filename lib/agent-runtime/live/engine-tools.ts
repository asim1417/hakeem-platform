// ─────────────────────────────────────────────────────────────────────────────
// أدوات المحرّك الحيّة — تنفيذ العقود التي صرّحت بها المهارات (engineTools) فوق النواة.
// كلّها للقراءة فقط، مقيّدةٌ بالنطاق حيث ينطبق، وبسقوطٍ آمن (نتيجة فارغة + note عند أي خطأ).
// ─────────────────────────────────────────────────────────────────────────────
import { resolveEnforcement } from "@/lib/modules/agents/substrate/enforcement";

const normalizeSystem = (s: string): string => s.replace(/-/g, " ").trim();
const scopeWhere = (scope: string[]) => {
  const systems = Array.from(new Set(scope.map(normalizeSystem).filter(Boolean)));
  return { systems, OR: systems.map((s) => ({ lawName: { contains: s, mode: "insensitive" as const } })) };
};
const tokens = (q: string) =>
  Array.from(new Set(q.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2))).slice(0, 8);
const enf = (status: string | null | undefined) => resolveEnforcement(status).state;

export interface ArticleRow { system: string; article: number; title: string; enforcement: string; }
export interface ArticleFull extends ArticleRow { content: string; royalDecree: string | null; }

/** المسح الشامل — كل مواد النطاق بلا top-k (سقف مرتفع للحماية فقط). */
export async function exhaustiveScan(scope: string[], limit = 500): Promise<{ articles: ArticleRow[]; note?: string }> {
  const { OR } = scopeWhere(scope);
  if (!OR.length) return { articles: [], note: "نطاقٌ فارغ." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.legalArticle.findMany({
      where: { OR },
      select: { lawName: true, articleNumber: true, title: true, status: true },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: Math.min(Math.max(limit, 1), 2000),
    });
    return {
      articles: rows.map((r) => ({ system: r.lawName, article: r.articleNumber, title: r.title, enforcement: enf(r.status) })),
    };
  } catch {
    return { articles: [], note: "تعذّر المسح." };
  }
}

/** قراءة مادّة في سياقها — المادّة وجيرانها (±١) ضمن نظامها. */
export async function readArticleInContext(scope: string[], articleNumber: number): Promise<{ articles: ArticleFull[]; note?: string }> {
  const { OR } = scopeWhere(scope);
  if (!OR.length || !Number.isFinite(articleNumber)) return { articles: [], note: "مدخلٌ غير صالح." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.legalArticle.findMany({
      where: { OR, articleNumber: { in: [articleNumber - 1, articleNumber, articleNumber + 1] } },
      select: { lawName: true, articleNumber: true, title: true, content: true, status: true, royalDecree: true },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: 12,
    });
    return {
      articles: rows.map((r) => ({ system: r.lawName, article: r.articleNumber, title: r.title, content: r.content, enforcement: enf(r.status), royalDecree: r.royalDecree })),
    };
  } catch {
    return { articles: [], note: "تعذّرت القراءة." };
  }
}

/** قراءة فصل — مواد النطاق التي يطابق فصلها المصطلح. */
export async function readChapter(scope: string[], chapter: string): Promise<{ articles: ArticleFull[]; note?: string }> {
  const { OR } = scopeWhere(scope);
  if (!OR.length || !chapter.trim()) return { articles: [], note: "مدخلٌ غير صالح." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.legalArticle.findMany({
      where: { AND: [{ OR }, { chapter: { contains: chapter.trim(), mode: "insensitive" } }] },
      select: { lawName: true, articleNumber: true, title: true, content: true, status: true, royalDecree: true },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: 200,
    });
    return {
      articles: rows.map((r) => ({ system: r.lawName, article: r.articleNumber, title: r.title, content: r.content, enforcement: enf(r.status), royalDecree: r.royalDecree })),
    };
  } catch {
    return { articles: [], note: "تعذّرت القراءة." };
  }
}

export interface AmendmentRow { version: number; changeType: string; decreeRef: string | null; hijriDate: string | null; summary: string | null; }
/** تتبّع التعديلات — سلسلة التعديل التاريخية لمادّةٍ ضمن النطاق. */
export async function traceAmendments(scope: string[], articleNumber: number): Promise<{ system: string; article: number; enforcement: string; amendments: AmendmentRow[] } | { note: string }> {
  const { OR } = scopeWhere(scope);
  if (!OR.length || !Number.isFinite(articleNumber)) return { note: "مدخلٌ غير صالح." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.legalArticle.findFirst({
      where: { AND: [{ OR }, { articleNumber }] },
      select: { lawName: true, articleNumber: true, status: true, amendments: { orderBy: { version: "asc" }, select: { version: true, changeType: true, decreeRef: true, hijriDate: true, summary: true } } },
    });
    if (!row) return { note: "لم تُوجد المادّة ضمن النطاق." };
    return { system: row.lawName, article: row.articleNumber, enforcement: enf(row.status), amendments: row.amendments };
  } catch {
    return { note: "تعذّر التتبّع." };
  }
}

/** بناء استناد رسميّ لمادّة — «المادة (N) من {النظام}» + المرسوم + حالة النفاذ. */
export async function buildCitation(scope: string[], articleNumber: number): Promise<{ citation: string; enforcement: string } | { note: string }> {
  const { OR } = scopeWhere(scope);
  if (!OR.length || !Number.isFinite(articleNumber)) return { note: "مدخلٌ غير صالح." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.legalArticle.findFirst({
      where: { AND: [{ OR }, { articleNumber }] },
      select: { lawName: true, articleNumber: true, status: true, royalDecree: true },
    });
    if (!row) return { note: "لم تُوجد المادّة ضمن النطاق." };
    const decree = row.royalDecree ? ` الصادر بـ${row.royalDecree}` : "";
    return { citation: `المادة (${row.articleNumber}) من ${row.lawName}${decree}`, enforcement: enf(row.status) };
  } catch {
    return { note: "تعذّر بناء الاستناد." };
  }
}

export interface PrincipleRow { title: string; principle: string; court: string | null; topic: string | null; }
/** تخريج حكم — مبادئ قضائية مطابقة للاستعلام (للقراءة، غير مقيّد بنظام). */
export async function takhrijHukm(query: string, limit = 20): Promise<{ principles: PrincipleRow[]; note?: string }> {
  const qs = tokens(query);
  if (!qs.length) return { principles: [], note: "استعلامٌ فارغ." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.judicialPrinciple.findMany({
      where: { OR: qs.flatMap((t) => [
        { title: { contains: t, mode: "insensitive" as const } },
        { principleText: { contains: t, mode: "insensitive" as const } },
        { topic: { contains: t, mode: "insensitive" as const } },
      ]) },
      select: { title: true, principleText: true, court: true, topic: true },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return { principles: rows.map((r) => ({ title: r.title, principle: r.principleText.slice(0, 600), court: r.court, topic: r.topic })) };
  } catch {
    return { principles: [], note: "تعذّر التخريج." };
  }
}
