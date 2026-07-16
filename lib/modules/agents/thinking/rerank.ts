// ─────────────────────────────────────────────────────────────────────────────
// إعادة ترتيب خفيفة (بلا نموذج) لمرشّحي التحليل — الصلة أساس، مع ترجيح **السلطة**
// (عدد الأحكام المستشهِدة) و**الحالة السارية** (المنسوخة تُؤخَّر). فتصل أفضل المواد للتحليل
// ضمن سقف الـ٤٠، لا مجرّد ترتيب الاسترجاع. لا تلمس نواة البحث ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { articleStatusBadge } from "@/lib/modules/legal-core/article-status";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

/** ترجيح الحالة: الساري يُقدَّم، المنسوخ يُؤخَّر (دون إقصاء). */
function statusBonus(status: string | null | undefined): number {
  const b = articleStatusBadge(status);
  if (!b) return 0;
  if (b.label === "سارية") return 0.1;
  if (b.label === "منسوخة") return -0.15;
  if (b.label === "موقوفة") return -0.05;
  return 0; // معدّلة
}

/**
 * يعيد ترتيب المواد بدرجة مركّبة: الصلة المُطبَّعة + سلطة (log استشهادات) + حالة.
 * حتمي وخفيف — يرفع دقّة ما يصل للتحليل دون نموذج إعادة ترتيب.
 */
export function rerankArticles(articles: LegalCoreResult[]): LegalCoreResult[] {
  const maxRel = articles.reduce((m, a) => Math.max(m, a.relevanceScore ?? 0), 0) || 1;
  return articles
    .map((a) => ({
      a,
      score: (a.relevanceScore ?? 0) / maxRel + Math.log1p(a.citationCount ?? 0) * 0.05 + statusBonus(a.status),
    }))
    .sort((x, y) => y.score - x.score)
    .map((s) => s.a);
}
