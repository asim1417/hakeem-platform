import { prisma } from "@/lib/prisma";
import type { LegalCoreResult } from "./legal-retrieval";
import { noLegalArticleMessage } from "./legal-retrieval";
import { parseArticleNumberCandidates } from "./judgment-citation-extractor";
import { resolveLaw, isNumberingShifted } from "./resolve-law";
import { citationFlagsFromVerification } from "./verified-status";
import { latestVerification, unitVersions } from "./verification-read";

export const CITATION_NOT_VERIFIED = "CITATION_NOT_VERIFIED";

export type CitationGuardResult =
  | {
      ok: true;
      articleId: string;
      systemName: string;
      articleNumber: number;
      citationLabel: string;
      status: string;
      repealed: boolean;
      inForce: boolean; // نافذ فقط عندما status = «سارية» صراحةً (UNKNOWN ليس نافذًا)
    }
  | { ok: false; message: string; code?: string; candidates?: string[] };

/**
 * حارس الاستشهاد (1.1): يحلّ اسم النظام بثبات عبر resolveLaw.
 *   • الاحتواء/التعدّد ليس حاسمًا → CITATION_NOT_VERIFIED مع اقتراح مرشّحين.
 *   • أنظمة إزاحة الترقيم (1.4) → CITATION_NOT_VERIFIED حتى التصحيح الرسميّ.
 *   • النافذ والملغى يُقرأان من آخر سجل تحقق فقط. بلا سجل: ليس نافذًا وليس ملغى.
 */
export async function validateLegalCitation(input: { articleId?: string; systemName?: string; articleNumber?: number }): Promise<CitationGuardResult> {
  let article = input.articleId
    ? await prisma.legalArticle.findUnique({ where: { id: input.articleId } }).catch(() => null)
    : null;

  if (!article && input.systemName && input.articleNumber) {
    const resolved = await resolveLaw(input.systemName);
    // لا اختيار حاسم بالاحتواء/التعدّد.
    if (!resolved.decisive || !resolved.system) {
      return {
        ok: false,
        code: CITATION_NOT_VERIFIED,
        message: `${CITATION_NOT_VERIFIED}: تعذّر حسم النظام «${input.systemName}» (تطابق غير قاطع).`,
        candidates: resolved.candidates,
      };
    }
    // نظام مزاح الترقيم: لا يُعتدّ بأرقام مواده حتى التصحيح الرسميّ.
    if (isNumberingShifted(resolved.system.name)) {
      return {
        ok: false,
        code: CITATION_NOT_VERIFIED,
        message: `${CITATION_NOT_VERIFIED}: ترقيم «${resolved.system.name}» قيد التصحيح الرسميّ؛ لا يُعتدّ برقم المادة الآن.`,
      };
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

  // حتى مع تمرير articleId مباشرةً: احترم إزاحة الترقيم.
  if (isNumberingShifted(article.lawName)) {
    return {
      ok: false,
      code: CITATION_NOT_VERIFIED,
      message: `${CITATION_NOT_VERIFIED}: ترقيم «${article.lawName}» قيد التصحيح الرسميّ؛ لا يُعتدّ برقم المادة الآن.`,
    };
  }

  const verification = await latestVerification("unit", article.id);
  const flags = citationFlagsFromVerification(verification);
  const versions = await unitVersions(article.id);
  const now = Date.now();
  const applicable = [...versions].reverse().find((v) => new Date(v.validFrom).getTime() <= now);
  const versionNote = applicable
    ? ` — النسخة من ${applicable.validFrom.slice(0, 10)}`
    : " — النص الأصلي المحفوظ";
  return {
    ok: true,
    articleId: article.id,
    systemName: article.lawName,
    articleNumber: article.articleNumber,
    citationLabel: `${article.lawName}، المادة ${article.articleNumber}${flags.repealed ? " (ملغاة)" : flags.inForce ? "" : " (حالة قيد التحقق)"}${versionNote}`,
    status: flags.statusLabel,
    repealed: flags.repealed,
    inForce: flags.inForce,
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
