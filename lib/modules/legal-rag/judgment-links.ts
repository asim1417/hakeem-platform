/**
 * judgment-links — ربط المواد بالأحكام عبر جدول `legal_article_case_links` (قراءة فقط).
 *
 * يستخرج الأحكام المرتبطة مباشرةً بالمواد الحاضرة في السياق، ضمن سقوف محافِظة:
 *  - حدّ أعلى من الأحكام لكل مادة (افتراضي 3)
 *  - حدّ أعلى إجمالي للأحكام في السياق (افتراضي 8)
 * إن لم توجد روابط، يتدهور بأمان إلى لا شيء (سياق المواد فقط).
 *
 * دالة الربط النقيّة (mapLinkedJudgments) قابلة للاختبار بلا قاعدة بيانات.
 * لا تُكتب أي بيانات — SELECT فقط عبر fetchLinkedJudgments.
 */
import type { PrismaClient } from "@prisma/client";
import type { RagRuling } from "./context-builder";

/** صفّ رابط مادة↔حكم كما يُجلب من القاعدة (الحقول المطلوبة فقط). */
export interface ArticleCaseLinkRow {
  articleId: string;
  caseId: string;
  relationType: string | null;
  excerpt: string | null;
  confidence: number | null;
  judicialCase: {
    id: string;
    judgmentTitle: string | null;
    judgmentText: string | null;
    caseNo: string | null;
    decisionNo: string | null;
    court: string | null;
    cityName: string | null;
    decisionDate: Date | null;
  } | null;
}

export interface LinkCaps {
  perArticle: number; // أقصى عدد أحكام لكل مادة
  total: number; // أقصى عدد أحكام إجمالاً في السياق
}

export const DEFAULT_LINK_CAPS: LinkCaps = { perArticle: 3, total: 8 };

/**
 * يحوّل صفوف الروابط إلى أحكام سياق (RagRuling) مع تطبيق السقوف.
 * نقيّة تماماً (بلا قاعدة) — تُختبر عبر صفوف وهمية.
 */
export function mapLinkedJudgments(rows: ArticleCaseLinkRow[], caps: LinkCaps = DEFAULT_LINK_CAPS): RagRuling[] {
  const perArticleCount = new Map<string, number>();
  const seenCaseIds = new Set<string>();
  const out: RagRuling[] = [];

  // الأقوى ثقةً أولاً كي تبقى ضمن السقوف الأحكامُ الأوثق ارتباطاً.
  const sorted = [...rows].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  for (const row of sorted) {
    if (out.length >= caps.total) break;
    const jc = row.judicialCase;
    if (!jc || !jc.id) continue;

    const usedForArticle = perArticleCount.get(row.articleId) ?? 0;
    if (usedForArticle >= caps.perArticle) continue; // سقف لكل مادة
    if (seenCaseIds.has(jc.id)) {
      // الحكم مذكور بالفعل (ربما عبر مادة أخرى) — لا نكرّره لكن نحتسبه للمادة.
      perArticleCount.set(row.articleId, usedForArticle + 1);
      continue;
    }

    const number = jc.decisionNo ?? jc.caseNo ?? jc.id;
    const score = typeof row.confidence === "number" ? Math.max(0, Math.min(1, row.confidence)) : 0.5;
    out.push({
      id: jc.id,
      title: `حكم ${number}${jc.court ? ` — ${jc.court}` : ""}`,
      text: (row.excerpt && row.excerpt.trim()) || jc.judgmentText || jc.judgmentTitle || "",
      caseNo: jc.caseNo,
      decisionNo: jc.decisionNo,
      court: jc.court,
      score,
      reason: `حكم مرتبط بالمادة عبر روابط القاعدة${row.relationType ? ` (${row.relationType})` : ""}`,
    });
    seenCaseIds.add(jc.id);
    perArticleCount.set(row.articleId, usedForArticle + 1);
  }

  return out;
}

/**
 * يجلب الأحكام المرتبطة بمجموعة مواد (قراءة فقط) ثم يطبّق السقوف.
 * سقوط آمن: أي تعذّر في القاعدة يعيد [] (يتدهور إلى سياق المواد فقط).
 */
export async function fetchLinkedJudgments(
  db: Pick<PrismaClient, "legalArticleCaseLink">,
  articleIds: string[],
  caps: LinkCaps = DEFAULT_LINK_CAPS
): Promise<RagRuling[]> {
  if (!articleIds.length) return [];
  try {
    // نجلب سقفاً معقولاً من الروابط (مرتّبة بالثقة) ثم نطبّق السقوف الدقيقة في الذاكرة.
    const fetchCap = Math.max(caps.total * 4, caps.perArticle * articleIds.length, 40);
    const rows = (await db.legalArticleCaseLink.findMany({
      where: { articleId: { in: articleIds } },
      select: {
        articleId: true,
        caseId: true,
        relationType: true,
        excerpt: true,
        confidence: true,
        judicialCase: {
          select: {
            id: true,
            judgmentTitle: true,
            judgmentText: true,
            caseNo: true,
            decisionNo: true,
            court: true,
            cityName: true,
            decisionDate: true,
          },
        },
      },
      orderBy: { confidence: "desc" },
      take: Math.min(fetchCap, 200),
    })) as ArticleCaseLinkRow[];

    return mapLinkedJudgments(rows, caps);
  } catch {
    return [];
  }
}
