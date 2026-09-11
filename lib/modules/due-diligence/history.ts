import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { DueDiligenceReport } from "./core";
import {
  buildDueDiligenceSnapshotMeta,
  type DueDiligenceChangeSummary,
} from "./changes";

const DD_ACTION = "DUE_DILIGENCE_REPORT_CREATED";
const DD_SCHEMA_VERSION = "due-diligence-snapshot-v2";

export function dueDiligenceEntityKey(report: DueDiligenceReport): string {
  const seed = [
    report.query.name,
    report.query.unifiedNumber ?? "",
    report.query.commercialRegistration ?? "",
  ]
    .join("|")
    .trim();
  return `dd:${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function snapshotPayload(
  report: DueDiligenceReport,
  changes?: DueDiligenceChangeSummary
): Prisma.InputJsonValue {
  const meta = buildDueDiligenceSnapshotMeta(report);
  return {
    ...(meta as unknown as Prisma.InputJsonObject),
    changes: changes ? (changes as unknown as Prisma.InputJsonValue) : undefined,
  } as Prisma.InputJsonValue;
}

/**
 * Returns the most recent snapshot for the same actor + entity identity key.
 * This is read before persisting a new snapshot so change detection compares
 * the new run with the actual previous run, not with itself.
 */
export async function getLatestDueDiligenceSnapshot(actorId: string, report: DueDiligenceReport) {
  return prisma.auditEvent.findFirst({
    where: {
      actorId,
      subject: "CASE",
      action: DD_ACTION,
      entityId: dueDiligenceEntityKey(report),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entityId: true,
      metadata: true,
      schemaVersion: true,
      createdAt: true,
    },
  });
}

/**
 * Persists a compact immutable snapshot in the existing audited event store.
 * Raw source payloads are deliberately omitted to minimize retention and avoid
 * duplicating potentially large public documents.
 */
export async function persistDueDiligenceSnapshot(
  actorId: string,
  report: DueDiligenceReport,
  changes?: DueDiligenceChangeSummary
) {
  return auditEvent({
    actorId,
    subject: "CASE",
    action: DD_ACTION,
    entityId: dueDiligenceEntityKey(report),
    metadata: snapshotPayload(report, changes),
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
