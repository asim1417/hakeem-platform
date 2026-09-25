import { prisma } from "@/lib/prisma";
import type { LegalCoreResult } from "./legal-retrieval";
import { noLegalArticleMessage } from "./legal-retrieval";
import { parseArticleNumberCandidates } from "./judgment-citation-extractor";
import { resolveLaw } from "./resolve-law";

export const CITATION_NOT_VERIFIED = "CITATION_NOT_VERIFIED";
const REPEALED_STATUS = "ملغاة";

export type CitationGuardResult =
  | {
      ok: true;
      articleId: string;
      systemName: string;
      articleNumber: number;
      citationLabel: string;
      status: string;
      repealed: boolean;
    }
  | { ok: false; message: string; code?: string };

/**
 * حارس الاستشهاد (1.1): يحلّ اسم النظام بثبات عبر resolveLaw ثمّ يتحقق من وجود المادة.
 * يعيد repealed=true إن كانت المادة ملغاة (لا يُعتدّ بها نافذة). عند تعذّر التحقّق يعيد
 * code=CITATION_NOT_VERIFIED كي لا يُعرض الاستشهاد حقيقةً.
 */
export async function validateLegalCitation(input: { articleId?: string; systemName?: string; articleNumber?: number }): Promise<CitationGuardResult> {
  let article = input.articleId
    ? await prisma.legalArticle.findUnique({ where: { id: input.articleId } }).catch(() => null)
    : null;

  if (!article && input.systemName && input.articleNumber) {
    // حلّ اسم النظام بثبات (تطبيع، مطابقة تامّة ثمّ أطول بادئة، استبعاد اللوائح، تفضيل الأصل).
    const resolved = await resolveLaw(input.systemName);
    if (!resolved) {
      return { ok: false, code: CITATION_NOT_VERIFIED, message: `${CITATION_NOT_VERIFIED}: لا نظام يطابق «${input.systemName}».` };
    }
    article = await prisma.legalArticle
      .findFirst({
        where: {
          OR: [{ legalSystemId: resolved.system.id }, { lawName: resolved.system.name }],
          articleNumber: input.articleNumber,
        },
      })
      .catch(() => null);
  }

  if (!article) return { ok: false, code: CITATION_NOT_VERIFIED, message: noLegalArticleMessage };
  const status = String(article.status ?? "").trim();
  const repealed = status === REPEALED_STATUS;
  return {
    ok: true,
    articleId: article.id,
    systemName: article.lawName,
    articleNumber: article.articleNumber,
    citationLabel: `${article.lawName}، المادة ${article.articleNumber}${repealed ? " (ملغاة)" : ""}`,
    status: status || "سارية",
    repealed,
  };
}

export function filterAllowedCitations<T extends { articleId?: string; systemName?: string; lawName?: string; articleNumber?: number }>(items: T[], allowedArticles: LegalCoreResult[]) {
  const allowedIds = new Set(allowedArticles.map((article) => article.articleId));
  const allowedLabels = new Set(allowedArticles.map((article) => `${article.systemName}-${article.articleNumber}`));
  return items.filter((item) => {
    if (item.articleId && allowedIds.has(item.articleId)) return true;
    const systemName = item.systemName ?? item.lawName;
    return Boolean(systemName && item.articleNumber && allowedLabels.has(`${systemName}-${item.articleNumber}`));
  });
}

export function assertHasLegalArticles(articles: LegalCoreResult[]) {
  if (articles.length === 0) {
    return { ok: false as const, message: noLegalArticleMessage };
  }
  return { ok: true as const };
}

export function guardOutputAgainstUnknownArticleNumbers(output: string, allowedArticles: LegalCoreResult[]) {
  const allowedNumbers = new Set(allowedArticles.map((article) => article.articleNumber));
  // إشارة «س/ص» قد يكون أيّ طرفيها رقم المادة (الترتيب غير ثابت في النصوص):
  // لا نمنعها إلا إذا لم يكن أيٌّ من مرشّحيها مادةً مسموحة.
  const forbidden: number[] = [];
  for (const match of output.matchAll(/(?:المادة|مادة)\s*\(?\s*([0-9٠-٩]+(?:\s*\/\s*[0-9٠-٩]+)*)\s*\)?/g)) {
    const candidates = parseArticleNumberCandidates(match[1]).filter((n) => n > 0);
    if (candidates.length && !candidates.some((n) => allowedNumbers.has(n))) forbidden.push(candidates[0]);
  }
  if (forbidden.length > 0) {
    return {
      ok: false as const,
      message: `تم منع مخرج يتضمن أرقام مواد غير موجودة في السياق المسترجع: ${forbidden.join(", ")}.`
    };
  }
  return { ok: true as const };
}
