import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";

export interface RollbackAction {
  type: string;
  target: string;
  description: string;
}

export interface RollbackResult {
  batchId: string;
  dryRun: boolean;
  rolledBack: boolean;
  actions: RollbackAction[];
}

interface ChangeDelegate {
  findMany(args: { where: Record<string, unknown> }): Promise<Array<{ id: string }>>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
}

function changeDelegate(): ChangeDelegate | undefined {
  return (prisma as unknown as { legalChangeDetection?: ChangeDelegate }).legalChangeDetection;
}

async function audit(actorId: string, batchId: string, metadata: Prisma.InputJsonValue): Promise<void> {
  await auditEvent({
    actorId,
    subject: "RASD" as AuditSubject,
    action: "rasd.change.rollback",
    entityId: batchId,
    metadata
  }).catch(() => undefined);
}

export async function rollbackAppliedBatch(
  batchId: string,
  actorId: string,
  dryRun = true
): Promise<RollbackResult> {
  const sourceTag = `rasd:${batchId}`;
  const actions: RollbackAction[] = [];
  const createdVersions = await prisma.articleVersion.findMany({
    where: { source: sourceTag },
    orderBy: { createdAt: "desc" }
  });
  const amendments = await prisma.articleAmendment.findMany({
    where: { source: sourceTag }
  });

  for (const version of createdVersions) {
    actions.push({
      type: "CLOSE_RASD_VERSION",
      target: version.id,
      description: "إغلاق النسخة المنشأة من رصد بتعيين effectiveTo دون حذفها."
    });
    const previous = await prisma.articleVersion.findFirst({
      where: {
        articleId: version.articleId,
        id: { not: version.id },
        source: { not: sourceTag }
      },
      orderBy: { createdAt: "desc" }
    });
    if (previous) {
      actions.push({
        type: "RESTORE_PREVIOUS_CURRENT",
        target: previous.id,
        description: "استعادة النسخة السابقة كنسخة نافذة حالية إن أمكن."
      });
    }
  }

  for (const amendment of amendments) {
    actions.push({
      type: "MARK_AMENDMENT_ROLLED_BACK",
      target: amendment.id,
      description: "وسم سجل التعديل بأنه مُتراجع عنه دون حذفه."
    });
  }

  if (dryRun) return { batchId, dryRun, rolledBack: false, actions };

  await prisma.$transaction(async (tx) => {
    for (const version of createdVersions) {
      await tx.articleVersion.update({
        where: { id: version.id },
        data: { effectiveTo: new Date() }
      });
      const previous = await tx.articleVersion.findFirst({
        where: {
          articleId: version.articleId,
          id: { not: version.id },
          source: { not: sourceTag }
        },
        orderBy: { createdAt: "desc" }
      });
      if (previous) {
        await tx.articleVersion.update({
          where: { id: previous.id },
          data: { effectiveTo: null }
        });
      }
    }
    await tx.articleAmendment.updateMany({
      where: { source: sourceTag },
      data: { reviewStatus: "rolled_back" }
    });
    await (tx as unknown as { legalChangeDetection?: ChangeDelegate }).legalChangeDetection?.updateMany({
      where: { appliedBatchId: batchId },
      data: { rolledBackAt: new Date() }
    });
  });

  if (!changeDelegate()) {
    // The transaction above already used the generated delegate when available.
  }
  await audit(actorId, batchId, { actions: actions.map((action) => ({ ...action })) });
  return { batchId, dryRun, rolledBack: true, actions };
}
