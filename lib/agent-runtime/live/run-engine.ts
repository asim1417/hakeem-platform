// ─────────────────────────────────────────────────────────────────────────────
// runEngine الحيّ — الوصلة الوحيدة للنواة القانونية (legal_articles) لطبقة التشغيل.
// يقرأ فقط، مقيّدٌ بالنطاق (defaultSystems)، ويطبّع اسم النظام إلى مدخل النطاق المطابق
// كي يمرّ حارس النطاق (scopeGuard) دون تسريب. سقوطٌ آمن → نتيجة فارغة عند أي خطأ.
// ─────────────────────────────────────────────────────────────────────────────
import type { EngineResult, Enforcement, RetrievedArticle } from "../types";
import { resolveEnforcement } from "@/lib/modules/agents/substrate/enforcement";

/** يحوّل «نظام-الإفلاس» (المخطط) إلى «نظام الإفلاس» (اسم القاعدة). */
const normalizeSystem = (s: string): string => s.replace(/-/g, " ").trim();

/** حالة النفاذ الموحّدة → نوع الحرّاس (ساري/لاغٍ/معدّل)؛ الموقوف يُعامَل لاغيًا (لا يُقدَّم قائمًا). */
function toEnforcement(status: string | null | undefined): Enforcement {
  const state = resolveEnforcement(status).state;
  if (state === "لاغٍ" || state === "موقوف") return "لاغٍ";
  if (state === "معدّل") return "معدّل";
  return "ساري";
}

const tokens = (q: string): string[] =>
  Array.from(new Set(q.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2))).slice(0, 8);

export interface RunEngineOptions { limit?: number; }

/**
 * يبني runEngine مقيّدًا بالنطاق. النطاق المُمرَّر هو المصدر الوحيد للأنظمة المسموح بها؛
 * كل مادّة تُنسَب إلى مدخل النطاق الذي طابق اسمها فتبقى داخل المجموعة المسموح بها.
 */
export function createRunEngine(opts: RunEngineOptions = {}) {
  const take = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  return async function runEngine(normalizedQuery: string, scope: string[]): Promise<EngineResult> {
    const scopeSystems = Array.from(new Set(scope.map(normalizeSystem).filter(Boolean)));
    if (!scopeSystems.length) return { articles: [], scopeSystems: [] };
    try {
      const { prisma } = await import("@/lib/prisma");
      const qTokens = tokens(normalizedQuery);
      const rows = await prisma.legalArticle.findMany({
        where: {
          AND: [
            { OR: scopeSystems.map((s) => ({ lawName: { contains: s, mode: "insensitive" as const } })) },
            qTokens.length
              ? { OR: qTokens.flatMap((t) => [
                  { content: { contains: t, mode: "insensitive" as const } },
                  { title: { contains: t, mode: "insensitive" as const } },
                ]) }
              : {},
          ],
        },
        select: { id: true, lawName: true, articleNumber: true, title: true, content: true, status: true },
        orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
        take,
      });

      const scored: Array<{ a: RetrievedArticle; score: number }> = [];
      for (const r of rows) {
        // انسب المادّة إلى مدخل النطاق الذي طابق اسمها (لا الاسم الخام) — منعًا لتسريب النطاق.
        const matched = scopeSystems.find((s) => (r.lawName ?? "").includes(s));
        if (!matched) continue;
        const hay = `${r.title ?? ""} ${r.content ?? ""}`;
        // ترتيبٌ بالصلة: عدد كلمات الاستعلام المتمايزة الواردة فعلًا (بدل الترتيب الأبجديّ) —
        // فتتصدّر المادّة الأوثق صلةً بالسؤال، وترتقي جودة تأصيل الوكيل.
        const score = qTokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
        scored.push({
          a: {
            system: matched,
            article: String(r.articleNumber),
            text: r.content ?? r.title ?? "",
            enforcement: toEnforcement(r.status),
          },
          score,
        });
      }
      scored.sort((x, y) => y.score - x.score);
      return { articles: scored.map((s) => s.a), scopeSystems };
    } catch {
      return { articles: [], scopeSystems };
    }
  };
}
