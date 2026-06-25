import { prisma } from "@/lib/prisma";

/**
 * article-versions.ts — استرجاع «نصّ المادة كما كان نافذًا في تاريخ معيّن».
 *
 * النسخة تُمثّل حالة النصّ في مدى زمني [effectiveFrom, effectiveTo):
 *  - effectiveFrom = null ⇒ نافذة منذ الأزل (لا حدّ بدائي).
 *  - effectiveTo   = null ⇒ النسخة النافذة حاليًا (لا نهاية).
 * النصّ النافذ بتاريخ at = أحدث نسخة بدأت قبله (أو بلا بداية) ولم تنتهِ عنده.
 */

export interface ArticleVersionLike {
  versionText: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}

/** يختار النسخة النافذة عند التاريخ at من قائمة نسخ مادة واحدة. نقيّة وقابلة للاختبار. */
export function selectVersionAt<T extends ArticleVersionLike>(versions: T[], at: Date): T | null {
  const t = at.getTime();
  const eligible = versions.filter((v) => {
    const fromOk = v.effectiveFrom === null || v.effectiveFrom.getTime() <= t;
    const toOk = v.effectiveTo === null || v.effectiveTo.getTime() > t;
    return fromOk && toOk;
  });
  if (!eligible.length) return null;
  // عند التداخل (لا يُفترض حدوثه) نُرجّح الأحدث بداية، فالأحدث إنشاءً ضمنيًّا بترتيب القائمة.
  eligible.sort((a, b) => (b.effectiveFrom?.getTime() ?? -Infinity) - (a.effectiveFrom?.getTime() ?? -Infinity));
  return eligible[0];
}

/** يجلب نسخ مادة ويُرجع النصّ النافذ بتاريخ at (أو الحالية إن لم يُمرَّر تاريخ). */
export async function getArticleVersionAt(articleId: string, at: Date = new Date()) {
  const versions = await prisma.articleVersion
    .findMany({
      where: { articleId },
      select: { id: true, versionText: true, effectiveFrom: true, effectiveTo: true, royalDecree: true, hijriDate: true },
      orderBy: { effectiveFrom: "desc" }
    })
    .catch(() => [] as Array<{ id: string; versionText: string; effectiveFrom: Date | null; effectiveTo: Date | null; royalDecree: string | null; hijriDate: string | null }>);
  return selectVersionAt(versions, at);
}
