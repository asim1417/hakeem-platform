import { prisma } from "@/lib/prisma";
import type { LegalCoreResult } from "./legal-retrieval";
import { noLegalArticleMessage } from "./legal-retrieval";

export type CitationGuardResult =
  | { ok: true; articleId: string; systemName: string; articleNumber: number; citationLabel: string }
  | { ok: false; message: string };

export async function validateLegalCitation(input: { articleId?: string; systemName?: string; articleNumber?: number }): Promise<CitationGuardResult> {
  const article = input.articleId
    ? await prisma.legalArticle.findUnique({ where: { id: input.articleId } })
    : input.systemName && input.articleNumber
      ? await prisma.legalArticle.findFirst({
          where: {
            lawName: input.systemName,
            articleNumber: input.articleNumber
          }
        })
      : null;

  if (!article) return { ok: false, message: noLegalArticleMessage };
  return {
    ok: true,
    articleId: article.id,
    systemName: article.lawName,
    articleNumber: article.articleNumber,
    citationLabel: `${article.lawName}، المادة ${article.articleNumber}`
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
  const referencedNumbers = [...output.matchAll(/(?:المادة|مادة)\s*\(?(\d+)\)?/g)].map((match) => Number(match[1]));
  const forbidden = referencedNumbers.filter((number) => !allowedNumbers.has(number));
  if (forbidden.length > 0) {
    return {
      ok: false as const,
      message: `تم منع مخرج يتضمن أرقام مواد غير موجودة في السياق المسترجع: ${forbidden.join(", ")}.`
    };
  }
  return { ok: true as const };
}
