import { prisma } from "@/lib/prisma";
import { isRasdEnabled } from "./flags";

export async function getRasdOverview() {
  const enabled = isRasdEnabled();
  try {
    const client = prisma as unknown as {
      monitoringRun?: { count(args?: { where?: Record<string, unknown> }): Promise<number> };
      monitoringSource?: { count(args?: { where?: Record<string, unknown> }): Promise<number> };
      legalChangeDetection?: { count(args?: { where?: Record<string, unknown> }): Promise<number> };
      sourceConflict?: { count(args?: { where?: Record<string, unknown> }): Promise<number> };
    };
    const [runs, activeSources, pendingChanges, openConflicts] = await Promise.all([
      client.monitoringRun?.count() ?? Promise.resolve(0),
      client.monitoringSource?.count({ where: { isActive: true } }) ?? Promise.resolve(0),
      client.legalChangeDetection?.count({ where: { reviewStatus: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] } } }) ?? Promise.resolve(0),
      client.sourceConflict?.count({ where: { status: "OPEN" } }) ?? Promise.resolve(0)
    ]);
    return { enabled, dbAvailable: true, runs, activeSources, pendingChanges, openConflicts };
  } catch {
    return { enabled, dbAvailable: false, runs: 0, activeSources: 0, pendingChanges: 0, openConflicts: 0 };
  }
}

export async function listRasdRuns(limit = 50) {
  try {
    const delegate = (prisma as unknown as {
      monitoringRun?: {
        findMany(args: { take: number; orderBy: Record<string, string>; include?: Record<string, boolean> }): Promise<Array<Record<string, unknown>>>;
      };
    }).monitoringRun;
    return (await delegate?.findMany({ take: limit, orderBy: { createdAt: "desc" }, include: { source: true } })) ?? [];
  } catch {
    return [];
  }
}

export async function listRasdSources() {
  try {
    const delegate = (prisma as unknown as {
      monitoringSource?: { findMany(args: { orderBy: Record<string, string> }): Promise<Array<Record<string, unknown>>> };
    }).monitoringSource;
    return (await delegate?.findMany({ orderBy: { trustPriority: "asc" } })) ?? [];
  } catch {
    return [];
  }
}

export async function listRasdChanges(limit = 100) {
  try {
    const delegate = (prisma as unknown as {
      legalChangeDetection?: {
        findMany(args: { take: number; orderBy: Record<string, string>; include?: Record<string, boolean> }): Promise<Array<Record<string, unknown>>>;
      };
    }).legalChangeDetection;
    return (await delegate?.findMany({ take: limit, orderBy: { detectedAt: "desc" }, include: { document: true } })) ?? [];
  } catch {
    return [];
  }
}

export async function listRasdConflicts(limit = 100) {
  try {
    const delegate = (prisma as unknown as {
      sourceConflict?: {
        findMany(args: { take: number; orderBy: Record<string, string>; include?: Record<string, boolean> }): Promise<Array<Record<string, unknown>>>;
      };
    }).sourceConflict;
    return (await delegate?.findMany({ take: limit, orderBy: { createdAt: "desc" }, include: { document: true } })) ?? [];
  } catch {
    return [];
  }
}
