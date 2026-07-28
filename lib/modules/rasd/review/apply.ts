import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { RASD_REVIEW_REQUIRED, envBool, isRasdAutoApplyEnabled, requireNoProductionLibraryWrite } from "../flags";

export interface ApplyPlanAction {
  type: string;
  target: string;
  description: string;
}

export interface ApplyApprovedChangeResult {
  changeId: string;
  dryRun: boolean;
  batchId: string;
  applied: boolean;
  actions: ApplyPlanAction[];
}

interface ChangeWithDocument {
  id: string;
  documentId: string;
  sourceVersionId: string | null;
  hakeemLegalSystemId: string | null;
  changeType: string;
  severity: string;
  oldValue: string | null;
  newValue: string | null;
  diffJson: Prisma.JsonValue | null;
  reviewStatus: string;
  reviewDecision: string | null;
  document?: {
    matchedLegalSystemId: string | null;
  };
}

interface ChangeDelegate {
  findUnique(args: { where: { id: string }; include?: Record<string, unknown> }): Promise<ChangeWithDocument | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

function changeDelegate(): ChangeDelegate | undefined {
  return (prisma as unknown as { legalChangeDetection?: ChangeDelegate }).legalChangeDetection;
}

function reviewRequired(): boolean {
  return envBool("RASD_REVIEW_REQUIRED", RASD_REVIEW_REQUIRED);
}

function extractArticleNumber(diffJson: Prisma.JsonValue | null): number | undefined {
  if (!diffJson || typeof diffJson !== "object" || Array.isArray(diffJson)) return undefined;
  const record = diffJson as Record<string, unknown>;
  const provisionDiffs = record.provisionDiffs;
  if (!Array.isArray(provisionDiffs)) return undefined;
  for (const item of provisionDiffs) {
    if (!item || typeof item !== "object") continue;
    const value = (item as Record<string, unknown>).articleNumber;
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function amendmentChangeType(changeType: string): string {
  if (changeType === "ARTICLE_REPEALED" || changeType === "REPEAL") return "repealed";
  if (changeType === "CORRECTION") return "corrected";
  if (changeType === "ARTICLE_ADDED") return "amended";
  return "amended";
}

async function audit(actorId: string, entityId: string, metadata: Prisma.InputJsonValue): Promise<void> {
  await auditEvent({
    actorId,
    subject: "RASD" as AuditSubject,
    action: "rasd.change.apply",
    entityId,
    metadata
  }).catch(() => undefined);
}

export async function applyApprovedChange(
  changeId: string,
  actorId: string,
  options: { dryRun?: boolean; auto?: boolean } = {}
): Promise<ApplyApprovedChangeResult> {
  const dryRun = options.dryRun ?? true;
  if (options.auto && !isRasdAutoApplyEnabled()) {
    throw new Error("RASD_AUTO_APPLY_ENABLED=false — التطبيق التلقائي معطّل.");
  }
  if (!dryRun) {
    requireNoProductionLibraryWrite("applyApprovedChange");
  }
  const delegate = changeDelegate();
  if (!delegate) throw new Error("جداول رصد غير متاحة بعد. طبّق الهجرة وشغّل prisma generate.");

  const change = await delegate.findUnique({
    where: { id: changeId },
    include: { document: true }
  });
  if (!change) throw new Error("لم يتم العثور على تغيير رصد بهذا المعرف.");
  if (reviewRequired() && change.reviewStatus !== "APPROVED") {
    throw new Error("لا يمكن التطبيق قبل الاعتماد البشري الصريح.");
  }

  const batchId = `rasd_apply_${Date.now().toString(36)}_${changeId.slice(0, 8)}`;
  const legalSystemId = change.hakeemLegalSystemId ?? change.document?.matchedLegalSystemId;
  const articleNumber = extractArticleNumber(change.diffJson);
  const actions: ApplyPlanAction[] = [];

  if (!legalSystemId) {
    actions.push({
      type: "SKIP_NO_MATCH",
      target: change.documentId,
      description: "لا يوجد نظام قانوني مطابق في مكتبة حكيم؛ يُترك للمراجعة اليدوية."
    });
    return { changeId, dryRun, batchId, applied: false, actions };
  }
  if (!articleNumber) {
    actions.push({
      type: "SKIP_NO_ARTICLE",
      target: legalSystemId,
      description: "لم يحدد diff رقم مادة قابل للتطبيق الآمن."
    });
    return { changeId, dryRun, batchId, applied: false, actions };
  }

  const article = await prisma.legalArticle.findFirst({
    where: { legalSystemId, articleNumber },
    include: { versions: { where: { effectiveTo: null }, take: 1 }, amendments: true }
  });
  if (!article) {
    actions.push({
      type: "SKIP_ARTICLE_NOT_FOUND",
      target: `${legalSystemId}:${articleNumber}`,
      description: "لم توجد المادة المطابقة في مكتبة حكيم؛ لا يتم إنشاء مادة جديدة آلياً."
    });
    return { changeId, dryRun, batchId, applied: false, actions };
  }

  const nextVersion = article.amendments.length + 1;
  const newText = change.newValue ?? article.content;
  const previousCurrent = article.versions[0];
  actions.push({
    type: "CREATE_ARTICLE_AMENDMENT",
    target: article.id,
    description: `إنشاء سجل تعديل Rasd للمادة ${articleNumber} بالإصدار ${nextVersion}.`
  });
  if (newText && newText !== previousCurrent?.versionText) {
    if (previousCurrent) {
      actions.push({
        type: "CLOSE_CURRENT_ARTICLE_VERSION",
        target: previousCurrent.id,
        description: "تعيين effectiveTo للنسخة الحالية دون حذفها."
      });
    }
    actions.push({
      type: "CREATE_ARTICLE_VERSION",
      target: article.id,
      description: "إنشاء نسخة مادة جديدة مع إبقاء النسخ القديمة."
    });
  }

  if (dryRun) {
    return { changeId, dryRun, batchId, applied: false, actions };
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.articleVersion.findFirst({
      where: { articleId: article.id, effectiveTo: null },
      orderBy: { createdAt: "desc" }
    });
    const amendment = await tx.articleAmendment.create({
      data: {
        articleId: article.id,
        version: nextVersion,
        changeType: amendmentChangeType(change.changeType),
        summary: `تطبيق تغيير رصد ${change.changeType}`,
        previousText: change.oldValue ?? current?.versionText ?? article.content,
        newText,
        source: `rasd:${batchId}`,
        reviewStatus: "approved"
      }
    });
    if (current && newText && newText !== current.versionText) {
      await tx.articleVersion.update({
        where: { id: current.id },
        data: { effectiveTo: new Date() }
      });
      await tx.articleVersion.create({
        data: {
          articleId: article.id,
          versionText: newText,
          effectiveFrom: new Date(),
          source: `rasd:${batchId}`
        }
      });
    } else if (!current && newText) {
      await tx.articleVersion.create({
        data: {
          articleId: article.id,
          versionText: newText,
          effectiveFrom: new Date(),
          source: `rasd:${batchId}`
        }
      });
    }
    await delegate.update({
      where: { id: changeId },
      data: { appliedAt: new Date(), appliedBatchId: batchId }
    });
    actions.push({
      type: "MARK_CHANGE_APPLIED",
      target: amendment.id,
      description: "وسم تغيير رصد كمطبق وربطه برقم دفعة."
    });
  });

  await audit(actorId, changeId, { batchId, dryRun: false, actions: actions.map((action) => ({ ...action })) });
  return { changeId, dryRun, batchId, applied: true, actions };
}
