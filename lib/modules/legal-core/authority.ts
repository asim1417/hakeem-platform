/**
 * authority.ts — إشارة السلطة في الترتيب (نظير «الأكثر استشهاداً» في Westlaw/KeyCite).
 *
 * المصدر: legal_article_case_links (روابط المادة↔الحكم). عدد الأحكام المستشهِدة بمادة =
 * مؤشّر مرجعية موضوعي: المادة الأكثر استشهاداً أكثر مركزيةً/سلطةً. مبنيّ من بيانات حقيقية
 * (29,705 رابطاً · 1,231 مادة). حافز مُدرَّج لوغاريتمياً ومقصوص كي يرجّح لا يهيمن.
 *
 * التحميل: خريطة articleId → عدد الاستشهادات، مُخزَّنة في الذاكرة مرّة لكل عملية (تُحدَّث
 * ببدء عملية جديدة). سقوط آمن إلى خريطة فارغة عند أي خطأ (لا سلطة ⇒ لا تغيير ترتيب).
 */
import { prisma } from "@/lib/prisma";

let _cache: Map<string, number> | null = null;
let _loading: Promise<Map<string, number>> | null = null;

/** خريطة السلطة: articleId → عدد الأحكام المستشهِدة. مُذكّرة (memoized) لكل عملية. */
export async function getArticleAuthorityMap(): Promise<Map<string, number>> {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = (async () => {
    try {
      const rows = await prisma.legalArticleCaseLink.groupBy({
        by: ["articleId"],
        _count: { articleId: true }
      });
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.articleId, r._count.articleId);
      _cache = map;
      return map;
    } catch {
      _cache = new Map<string, number>();
      return _cache;
    } finally {
      _loading = null;
    }
  })();
  return _loading;
}

/** معامل مقياس حافز السلطة (مقصوص). ~55 كحدّ أعلى للأكثر استشهاداً — يرجّح دون أن يهيمن. */
export const AUTHORITY_SCALE = 15;

/** حافز السلطة من عدد الاستشهادات: مُدرَّج لوغاريتمياً (يخفّف تطرّف الأعداد الكبيرة). */
export function authorityBonus(citationCount: number | undefined): number {
  if (!citationCount || citationCount <= 0) return 0;
  return Math.round(AUTHORITY_SCALE * Math.log10(1 + citationCount));
}

/** للاختبار فقط: إعادة ضبط الذاكرة المؤقّتة. */
export function _resetAuthorityCacheForTest() {
  _cache = null;
  _loading = null;
}
