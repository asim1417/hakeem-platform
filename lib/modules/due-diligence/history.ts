import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { DueDiligenceReport, EvidenceRecord } from "./core";

const DD_ACTION = "DUE_DILIGENCE_REPORT_CREATED";
const DD_SCHEMA_VERSION = "due-diligence-snapshot-v1";

function entityKey(report: DueDiligenceReport): string {
  const seed = [
    report.query.name,
    report.query.unifiedNumber ?? "",
    report.query.commercialRegistration ?? "",
  ]
    .join("|")
    .trim();
  return `dd:${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function compactEvidence(item: EvidenceRecord) {
  return {
    id: item.id,
    sha256: item.sha256,
    sourceKey: item.sourceKey,
    sourceRecordId: item.sourceRecordId ?? null,
    entityName: item.entityName,
    category: item.category,
    title: item.title,
    summary: item.summary?.slice(0, 800) ?? null,
    sourceUrl: item.sourceUrl,
    occurredAt: item.occurredAt ?? null,
    fetchedAt: item.fetchedAt,
    confidence: item.confidence,
    status: item.status,
    matchReasons: item.matchReasons,
    rejectionReasons: item.rejectionReasons,
  };
}

function snapshotPayload(report: DueDiligenceReport): Prisma.InputJsonValue {
  return {
    kind: "due_diligence_snapshot",
    version: 1,
    query: {
      name: report.query.name,
      unifiedNumber: report.query.unifiedNumber ?? null,
      commercialRegistration: report.query.commercialRegistration ?? null,
      city: report.query.city ?? null,
    },
    generatedAt: report.generatedAt,
    risk: report.risk as unknown as Prisma.InputJsonValue,
    coverage: report.coverage as unknown as Prisma.InputJsonValue,
    sources: report.sources as unknown as Prisma.InputJsonValue,
    evidence: report.evidence.map(compactEvidence) as unknown as Prisma.InputJsonValue,
    rejected: report.rejected.map(compactEvidence) as unknown as Prisma.InputJsonValue,
    needsReview: report.needsReview.map(compactEvidence) as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Persists a compact immutable snapshot in the existing audited event store.
 * Raw source payloads are deliberately omitted to minimize retention and avoid
 * duplicating potentially large public documents.
 */
export async function persistDueDiligenceSnapshot(actorId: string, report: DueDiligenceReport) {
  return auditEvent({
    actorId,
    subject: "CASE",
    action: DD_ACTION,
    entityId: entityKey(report),
    metadata: snapshotPayload(report),
    schemaVersion: DD_SCHEMA_VERSION,
  });
}

export async function listDueDiligenceSnapshots(actorId: string, take = 20) {
  const safeTake = Math.min(Math.max(take, 1), 50);
  return prisma.auditEvent.findMany({
    where: {
      actorId,
      subject: "CASE",
      action: DD_ACTION,
    },
    orderBy: { createdAt: "desc" },
    take: safeTake,
    select: {
      id: true,
      entityId: true,
      metadata: true,
      schemaVersion: true,
      createdAt: true,
    },
  });
}
