/**
 * authority.ts — عدّ استشهادات المادة للعرض (نظير «Citing References» في Westlaw/KeyCite).
 *
 * المصدر: legal_article_case_links (روابط المادة↔الحكم). عدد الأحكام المستشهِدة بمادة =
 * مؤشّر مرجعية موضوعي مبنيّ من بيانات حقيقية (29,705 رابطاً · 1,231 مادة مُستشهَد بها).
 *
 * قرار مقيس: جُرِّب هذا العدّ **كإشارة ترتيب** (حافز على relevanceScore) فتراجعت جودة
 * الترتيب على المجموعة الذهبية (MRR 0.980→0.967، وخارج الخريطة 0.975→0.942) — فرُفض.
 * السبب البنيوي: مجموعتنا الذهبية على مستوى النظام، فلا تقيس فائدة إعادة ترتيب المواد.
 * لذا نستعمله **للعرض فقط**: نُظهر «مُستشهَد بها في N حكماً» ويحكم المحامي على السلطة بنفسه —
 * أصدق من ترجيح خفيّ، وبلا مخاطرة ترتيب. لا يُغيّر relevanceScore إطلاقاً.
 *
 * التحميل: خريطة articleId → عدد الاستشهادات، مُخزَّنة في الذاكرة مرّة لكل عملية. سقوط آمن
 * إلى خريطة فارغة عند أي خطأ (لا عدّ ⇒ لا شارة، والبحث يعمل كما هو).
 */
import { prisma } from "@/lib/prisma";

let _cache: Map<string, number> | null = null;
let _loading: Promise<Map<string, number>> | null = null;

/** خريطة العدّ: articleId → عدد الأحكام المستشهِدة. مُذكّرة (memoized) لكل عملية. */
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

/** للاختبار فقط: إعادة ضبط الذاكرة المؤقّتة. */
export function _resetAuthorityCacheForTest() {
  _cache = null;
  _loading = null;
}
