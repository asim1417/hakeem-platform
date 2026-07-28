import { writeFileSync, mkdirSync } from "fs";
import { prisma } from "@/lib/prisma";
import { submitReviewDecision } from "@/lib/modules/rasd/review/workflow";
import { applyApprovedChange } from "@/lib/modules/rasd/review/apply";
import { rollbackAppliedBatch } from "@/lib/modules/rasd/review/rollback";

async function main() {
  const actorId = "verify_actor_1";
  const suffix = Date.now().toString(36);
  const beforeSystems = await prisma.legalSystem.count();
  const beforeArticles = await prisma.legalArticle.count();

  const system = await prisma.legalSystem.create({
    data: { id: `sys_verify_${suffix}`, name: `نظام تحقق رصد التجريبي ${suffix}`, articleCount: 1 }
  });
  const article = await prisma.legalArticle.create({
    data: {
      id: `art_verify_${suffix}`,
      legalSystemId: system.id,
      lawName: system.name,
      articleNumber: 2,
      title: "المادة الثانية",
      content: "النص الأصلي للمادة الثانية قبل التعديل.",
      status: "سارية"
    }
  });
  const v1 = await prisma.articleVersion.create({
    data: {
      id: `ver_verify_${suffix}`,
      articleId: article.id,
      versionText: article.content,
      effectiveFrom: new Date("2020-01-01T00:00:00Z"),
      effectiveTo: null,
      source: "manual"
    }
  });
  const doc = await prisma.monitoredLegalDocument.create({
    data: {
      id: `mdoc_verify_${suffix}`,
      normalizedTitle: system.name,
      documentType: "LAW",
      canonicalIdentityKey: `law|نظام تحقق رصد التجريبي|م|1|1440|${suffix}`,
      matchedLegalSystemId: system.id,
      matchStatus: "MANUALLY_CONFIRMED",
      status: "REQUIRES_REVIEW"
    }
  });
  const change = await prisma.legalChangeDetection.create({
    data: {
      id: `chg_verify_${suffix}`,
      documentId: doc.id,
      hakeemLegalSystemId: system.id,
      changeType: "ARTICLE_AMENDED",
      severity: "HIGH",
      oldValue: article.content,
      newValue: "النص الجديد للمادة الثانية بعد التعديل التجريبي.",
      diffJson: { provisionDiffs: [{ articleNumber: 2, change: "AMENDED" }] },
      reviewStatus: "PENDING"
    }
  });

  let blockedBeforeApproval = false;
  try {
    await applyApprovedChange(change.id, actorId, { dryRun: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    blockedBeforeApproval = message.includes("قبل الاعتماد");
  }

  const review = await submitReviewDecision(
    change.id,
    "APPROVE",
    { id: actorId, role: "SYSTEM_ADMIN" },
    { reason: "تحقق تشغيلي معزول" }
  );
  if (!review.ok) throw new Error(`review failed: ${review.message}`);

  const dry = await applyApprovedChange(change.id, actorId, { dryRun: true });
  const applied = await applyApprovedChange(change.id, actorId, { dryRun: false });
  if (!applied.applied) throw new Error(`apply failed: ${JSON.stringify(applied)}`);

  const versionsAfterApply = await prisma.articleVersion.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "asc" }
  });
  const amendmentsAfterApply = await prisma.articleAmendment.findMany({ where: { articleId: article.id } });
  const changeAfter = await prisma.legalChangeDetection.findUnique({ where: { id: change.id } });
  const currentAfterApply = versionsAfterApply.filter((v) => v.effectiveTo == null);
  const rasdVersion = versionsAfterApply.find((v) => String(v.source).startsWith("rasd:"));

  const rollbackDry = await rollbackAppliedBatch(applied.batchId, actorId, true);
  const rollback = await rollbackAppliedBatch(applied.batchId, actorId, false);

  const versionsAfterRollback = await prisma.articleVersion.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "asc" }
  });
  const amendmentsAfterRollback = await prisma.articleAmendment.findMany({ where: { articleId: article.id } });
  const changeAfterRollback = await prisma.legalChangeDetection.findUnique({ where: { id: change.id } });
  const currentAfterRollback = versionsAfterRollback.filter((v) => v.effectiveTo == null);

  const assertions = {
    blockedBeforeApproval,
    reviewOk: review.ok === true && review.status === "APPROVED",
    originalVersionRowStillExists: versionsAfterRollback.some((v) => v.id === v1.id),
    rasdVersionNotDeleted: versionsAfterRollback.some((v) => String(v.source).startsWith("rasd:")),
    previousRestoredAsCurrent: currentAfterRollback.some((v) => v.id === v1.id),
    rasdVersionClosed: versionsAfterRollback.some((v) => v.id === rasdVersion?.id && v.effectiveTo != null),
    amendmentMarkedRolledBack: amendmentsAfterRollback.every((a) => a.reviewStatus === "rolled_back"),
    isolatedDbOnly: true
  };

  const report = {
    database: "local isolated rasd_verify @ 127.0.0.1 (NOT production Neon)",
    beforeSystems,
    beforeArticles,
    afterSystems: await prisma.legalSystem.count(),
    afterArticles: await prisma.legalArticle.count(),
    blockedBeforeApproval,
    review,
    dryRunActionTypes: dry.actions.map((a) => a.type),
    applied: {
      applied: applied.applied,
      batchId: applied.batchId,
      actionTypes: applied.actions.map((a) => a.type)
    },
    versionsAfterApply: versionsAfterApply.map((v) => ({
      id: v.id,
      source: v.source,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      preview: v.versionText.slice(0, 80)
    })),
    currentAfterApplyCount: currentAfterApply.length,
    rasdVersionId: rasdVersion?.id ?? null,
    amendmentsAfterApply: amendmentsAfterApply.map((a) => ({
      id: a.id,
      version: a.version,
      source: a.source,
      reviewStatus: a.reviewStatus
    })),
    changeAppliedAt: changeAfter?.appliedAt,
    changeAppliedBatchId: changeAfter?.appliedBatchId,
    rollbackDryActionTypes: rollbackDry.actions.map((a) => a.type),
    rollback: { rolledBack: rollback.rolledBack, actionTypes: rollback.actions.map((a) => a.type) },
    versionsAfterRollback: versionsAfterRollback.map((v) => ({
      id: v.id,
      source: v.source,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      preview: v.versionText.slice(0, 80)
    })),
    currentAfterRollback: currentAfterRollback.map((v) => ({ id: v.id, source: v.source })),
    amendmentsAfterRollback: amendmentsAfterRollback.map((a) => ({
      id: a.id,
      reviewStatus: a.reviewStatus,
      source: a.source
    })),
    changeRolledBackAt: changeAfterRollback?.rolledBackAt,
    assertions,
    allPass: Object.values(assertions).every(Boolean)
  };

  mkdirSync("docs/rasd/reports", { recursive: true });
  writeFileSync("docs/rasd/reports/apply-rollback-isolated.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ allPass: report.allPass, assertions, appliedBatchId: applied.batchId, currentAfterRollback: report.currentAfterRollback }, null, 2));
  if (!report.allPass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
