/**
 * article-upsert — إدخال/تحديث المادة بشكل idempotent مع:
 *   • حفظ النسخة السابقة في ArticleVersion عند تغيّر النصّ (لا طغيان على القديم).
 *   • تسجيل التعديل المقترَح في ArticleAmendment عند مجيئه من مصدر غير رسمي — دون
 *     تطبيقه آليًّا على النصّ الحيّ (المصدر غير الرسمي لا يعتمد تعديلًا).
 *   • ختم provenance (رابط/ناشر/تاريخ/بصمة) وحالة مراجعة لا تدّعي التحقق.
 *
 * لا يحذف أي بيانات. أي استبدال أو تعديل غير مؤكَّد يبقى في حالة مراجعة.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { sha256Normalized } from "./article-numbering";

/** مجموعة المضيفات الرسمية المعتمدة (يشمل العدل كمصدر مساعد). nezams ليس رسميًّا. */
const OFFICIAL_HOSTS = new Set([
  "ncar.gov.sa", "www.ncar.gov.sa",
  "laws.boe.gov.sa", "boe.gov.sa", "www.boe.gov.sa",
  "uqn.gov.sa", "www.uqn.gov.sa",
  "laws.moj.gov.sa", "moj.gov.sa", "www.moj.gov.sa",
]);

/** هل الرابط مصدرٌ رسميٌّ معتمد (HTTPS + مضيف ضمن القائمة البيضاء)؟ */
export function isOfficialSourceUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return [...OFFICIAL_HOSTS].some((h) => host === h || host.endsWith("." + h));
}

export type ReviewStatus =
  | "verified"
  | "needs_review"
  | "numbering_conflict"
  | "missing_official_source"
  | "unverified";

/**
 * يحسم حالة المراجعة: لا يجوز اعتماد «verified» إلا من مصدر رسمي. أي مصدر غير
 * رسمي يُخفَّض حتمًا إلى «needs_review» — بوابة تمنع اعتماد تعديل من مصدر غير رسمي.
 */
export function resolveReviewStatus(requested: ReviewStatus, fromOfficialSource: boolean): ReviewStatus {
  if (requested === "verified" && !fromOfficialSource) return "needs_review";
  return requested;
}

export interface ArticleProvenance {
  sourceUrl?: string | null;
  sourcePublisher?: string | null;
  sourcePublishedAt?: Date | null;
  sourceFetchedAt?: Date | null;
}

export interface UpsertArticleInput {
  lawName: string;
  articleNumber: number;
  title: string;
  content: string;
  keywords?: string[];
  legalSystemId?: string | null;
  provenance?: ArticleProvenance;
  /** حالة المراجعة المطلوبة (تُخفَّض تلقائيًّا إن كان المصدر غير رسمي). */
  requestedReviewStatus?: ReviewStatus;
}

export type UpsertAction = "created" | "updated" | "proposed-change" | "noop";

export interface UpsertResult {
  action: UpsertAction;
  versioned: boolean;
  reviewStatus: ReviewStatus;
  reason?: string;
}

/**
 * إدخال/تحديث مادة واحدة بشكل idempotent وآمن قانونيًّا.
 * apply=false ⇒ محاكاة بلا كتابة (تُرجع القرار فقط).
 */
export async function upsertLegalArticle(
  prisma: PrismaClient,
  input: UpsertArticleInput,
  opts: { apply: boolean } = { apply: false },
): Promise<UpsertResult> {
  const fromOfficial = isOfficialSourceUrl(input.provenance?.sourceUrl);
  const requested = input.requestedReviewStatus ?? (fromOfficial ? "needs_review" : "unverified");
  const reviewStatus = resolveReviewStatus(requested, fromOfficial);
  const newSha = sha256Normalized(input.content);

  const existing = await prisma.legalArticle.findUnique({
    where: { lawName_articleNumber: { lawName: input.lawName, articleNumber: input.articleNumber } },
    select: { id: true, content: true, title: true },
  });

  const provenanceData = {
    sourceUrl: input.provenance?.sourceUrl ?? undefined,
    sourcePublisher: input.provenance?.sourcePublisher ?? undefined,
    sourcePublishedAt: input.provenance?.sourcePublishedAt ?? undefined,
    sourceFetchedAt: input.provenance?.sourceFetchedAt ?? undefined,
    contentSha256: newSha,
  } as const;

  // ① مادة جديدة.
  if (!existing) {
    if (opts.apply) {
      await prisma.legalArticle.create({
        data: {
          lawName: input.lawName,
          legalSystemId: input.legalSystemId ?? undefined,
          articleNumber: input.articleNumber,
          title: input.title,
          content: input.content,
          keywords: input.keywords ?? [],
          reviewStatus,
          ...provenanceData,
        } as Prisma.LegalArticleUncheckedCreateInput,
      });
    }
    return { action: "created", versioned: false, reviewStatus };
  }

  const contentChanged = sha256Normalized(existing.content) !== newSha;
  const titleChanged = (existing.title ?? "") !== input.title;

  // ② لا تغيّر في النصّ — نحدّث provenance/العنوان فقط (آمن، بلا نسخة جديدة).
  if (!contentChanged) {
    if (opts.apply) {
      await prisma.legalArticle.update({
        where: { id: existing.id },
        data: {
          title: titleChanged ? input.title : undefined,
          reviewStatus,
          ...provenanceData,
        } as Prisma.LegalArticleUncheckedUpdateInput,
      });
    }
    return { action: titleChanged ? "updated" : "noop", versioned: false, reviewStatus };
  }

  // ③ تغيّر النصّ من مصدر غير رسمي ⇒ لا نطبّقه؛ نرفعه اقتراحًا للمراجعة فقط.
  if (!fromOfficial) {
    if (opts.apply) {
      const versionCount = await prisma.articleAmendment.count({ where: { articleId: existing.id } });
      await prisma.articleAmendment.create({
        data: {
          articleId: existing.id,
          version: versionCount + 1,
          changeType: "corrected",
          previousText: existing.content,
          newText: input.content,
          summary: "تعديل مقترَح من مصدر غير رسمي — لم يُطبَّق (يلزم مصدر رسمي + مراجعة).",
          source: "import",
          reviewStatus: "needs_review",
        },
      });
    }
    return {
      action: "proposed-change",
      versioned: false,
      reviewStatus: "needs_review",
      reason: "non-official-source",
    };
  }

  // ④ تغيّر النصّ من مصدر رسمي ⇒ نحفظ النسخة السابقة ثمّ نحدّث (لا طغيان).
  if (opts.apply) {
    await prisma.$transaction(async (tx) => {
      // أغلق النسخة النافذة السابقة (إن لم تكن مُسجّلة) بحفظ نصّها القديم.
      await tx.articleVersion.updateMany({
        where: { articleId: existing.id, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });
      await tx.articleVersion.create({
        data: {
          articleId: existing.id,
          versionText: existing.content,
          effectiveTo: new Date(),
          source: "import",
        },
      });
      await tx.legalArticle.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          content: input.content,
          keywords: input.keywords ?? undefined,
          reviewStatus,
          ...provenanceData,
        } as Prisma.LegalArticleUncheckedUpdateInput,
      });
    });
  }
  return { action: "updated", versioned: true, reviewStatus };
}
