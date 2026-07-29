import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { RasdReviewDecision } from "../types";

export type ReviewDecision = RasdReviewDecision;

interface ChangeRecord {
  id: string;
  documentId: string;
  changeType: string;
  severity: string;
  reviewStatus: string;
  detectedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewDecision: string | null;
  reviewNotes: string | null;
}

interface ChangeDelegate {
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
    take?: number;
    include?: Record<string, unknown>;
  }): Promise<ChangeRecord[]>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ChangeRecord>;
}

interface ReviewDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

function delegates(): { legalChangeDetection?: ChangeDelegate; legalUpdateReview?: ReviewDelegate } {
  return prisma as unknown as { legalChangeDetection?: ChangeDelegate; legalUpdateReview?: ReviewDelegate };
}

async function audit(action: string, actorId: string | undefined, entityId: string, metadata?: Prisma.InputJsonValue): Promise<void> {
  await auditEvent({
    actorId,
    subject: "RASD" as AuditSubject,
    action,
    entityId,
    metadata
  }).catch(() => undefined);
}

function statusForDecision(decision: ReviewDecision): string {
  if (decision === "APPROVE" || decision === "MERGE_WITH_EXISTING") return "APPROVED";
  if (decision === "REJECT" || decision === "MARK_AS_FALSE_POSITIVE") return "REJECTED";
  if (decision === "ESCALATE_LEGAL_REVIEW") return "ESCALATED";
  if (decision === "DEFER") return "DEFERRED";
  return "IN_REVIEW";
}

export async function listPendingChanges(options: {
  limit?: number;
  includeDeferred?: boolean;
  severity?: string;
} = {}): Promise<ChangeRecord[]> {
  const delegate = delegates().legalChangeDetection;
  if (!delegate) return [];
  const statuses = options.includeDeferred ? ["PENDING", "IN_REVIEW", "DEFERRED", "ESCALATED"] : ["PENDING", "IN_REVIEW", "ESCALATED"];
  try {
    return await delegate.findMany({
      where: {
        reviewStatus: { in: statuses },
        ...(options.severity ? { severity: options.severity } : {})
      },
      orderBy: { detectedAt: "desc" },
      take: options.limit ?? 100,
      include: { reviews: true }
    });
  } catch {
    return [];
  }
}

export async function submitReviewDecision(
  changeId: string,
  decision: ReviewDecision,
  reviewer: { id?: string; role?: string; name?: string },
  options: { reason?: string; approvedPayload?: Prisma.InputJsonValue } = {}
): Promise<{ ok: boolean; status?: string; message?: string }> {
  const changeDelegate = delegates().legalChangeDetection;
  const reviewDelegate = delegates().legalUpdateReview;
  if (!changeDelegate || !reviewDelegate) {
    return { ok: false, message: "جداول رصد غير متاحة بعد. طبّق الهجرة وشغّل prisma generate." };
  }

  const status = statusForDecision(decision);
  try {
    await reviewDelegate.create({
      data: {
        changeDetectionId: changeId,
        decision,
        reviewerId: reviewer.id,
        reviewerRole: reviewer.role,
        reason: options.reason,
        approvedPayload: options.approvedPayload
      }
    });
    await changeDelegate.update({
      where: { id: changeId },
      data: {
        reviewStatus: status,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        reviewDecision: decision,
        reviewNotes: options.reason
      }
    });
    await audit("rasd.review.decision", reviewer.id, changeId, {
      decision,
      status,
      reviewerRole: reviewer.role ?? null,
      reason: options.reason ?? null
    });
    return { ok: true, status };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
