import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import type { RasdRunStatus, RasdRunType, RasdSourceCode, RasdTriggerType } from "../types";

export interface CreateRunInput {
  runType: RasdRunType;
  triggerType: RasdTriggerType;
  sourceCode?: RasdSourceCode;
  dryRun?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface RunCounts {
  pagesDiscovered?: number;
  pagesFetched?: number;
  documentsDiscovered?: number;
  documentsNew?: number;
  documentsChanged?: number;
  documentsUnchanged?: number;
  documentsFailed?: number;
  conflictsFound?: number;
  retryCount?: number;
}

export interface RasdMonitoringRun {
  id: string;
  runType: string;
  triggerType: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  sourceId: string | null;
  pagesDiscovered: number;
  pagesFetched: number;
  documentsDiscovered: number;
  documentsNew: number;
  documentsChanged: number;
  documentsUnchanged: number;
  documentsFailed: number;
  conflictsFound: number;
  retryCount: number;
  dryRun: boolean;
  errorSummary: string | null;
  checkpoint: Prisma.InputJsonValue | null;
  metadata: Prisma.InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MonitoringRunDelegate {
  create(args: {
    data: {
      runType: string;
      triggerType: string;
      sourceId?: string;
      dryRun: boolean;
      metadata?: Prisma.InputJsonValue;
    };
  }): Promise<RasdMonitoringRun>;
  update(args: { where: { id: string }; data: Partial<RasdMonitoringRun> | RunCounts }): Promise<RasdMonitoringRun>;
  findUnique(args: { where: { id: string } }): Promise<RasdMonitoringRun | null>;
  findMany(args: {
    where?: { status: string };
    orderBy: { createdAt: "desc" };
    take: number;
  }): Promise<RasdMonitoringRun[]>;
}

interface MonitoringSourceDelegate {
  findUnique(args: { where: { code: RasdSourceCode } }): Promise<{ id: string } | null>;
}

interface RasdPrismaDelegates {
  monitoringRun?: MonitoringRunDelegate;
  monitoringSource?: MonitoringSourceDelegate;
}

function rasdDelegates(): RasdPrismaDelegates {
  return prisma as unknown as RasdPrismaDelegates;
}

const memoryRuns = new Map<string, RasdMonitoringRun>();

function cuid(prefix = "rasd"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function now(): Date {
  return new Date();
}

function baseMemoryRun(input: CreateRunInput, sourceId?: string): RasdMonitoringRun {
  const timestamp = now();
  return {
    id: cuid("run"),
    runType: input.runType,
    triggerType: input.triggerType,
    status: "PENDING",
    startedAt: null,
    finishedAt: null,
    sourceId: sourceId ?? null,
    pagesDiscovered: 0,
    pagesFetched: 0,
    documentsDiscovered: 0,
    documentsNew: 0,
    documentsChanged: 0,
    documentsUnchanged: 0,
    documentsFailed: 0,
    conflictsFound: 0,
    retryCount: 0,
    dryRun: input.dryRun ?? true,
    errorSummary: null,
    checkpoint: null,
    metadata: input.metadata ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function audit(action: string, runId: string, metadata?: Prisma.InputJsonValue): Promise<void> {
  try {
    await auditEvent({ subject: "RASD" as AuditSubject, action, entityId: runId, metadata });
  } catch {
    // Audit failure must not prevent tests or local dry-runs from completing.
  }
}

async function sourceIdForCode(sourceCode?: RasdSourceCode): Promise<string | undefined> {
  if (!sourceCode) return undefined;
  const delegate = rasdDelegates().monitoringSource;
  if (!delegate) return undefined;
  const source = await delegate.findUnique({ where: { code: sourceCode } });
  return source?.id;
}

export async function createRun(input: CreateRunInput): Promise<RasdMonitoringRun> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    const sourceId = await sourceIdForCode(input.sourceCode);
    const run = await delegate.create({
      data: {
        runType: input.runType,
        triggerType: input.triggerType,
        sourceId,
        dryRun: input.dryRun ?? true,
        metadata: input.metadata
      }
    });
    await audit("rasd.run.created", run.id, { runType: input.runType, sourceCode: input.sourceCode ?? null });
    return run;
  } catch {
    const run = baseMemoryRun(input);
    memoryRuns.set(run.id, run);
    return run;
  }
}

function updateMemoryRun(id: string, patch: Partial<RasdMonitoringRun>): RasdMonitoringRun | null {
  const existing = memoryRuns.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: now() };
  memoryRuns.set(id, updated);
  return updated;
}

export async function startRun(id: string): Promise<RasdMonitoringRun | null> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    const run = await delegate.update({
      where: { id },
      data: { status: "RUNNING", startedAt: now() }
    });
    await audit("rasd.run.started", id);
    return run;
  } catch {
    return updateMemoryRun(id, { status: "RUNNING", startedAt: now() });
  }
}

export async function finishRun(
  id: string,
  status: Exclude<RasdRunStatus, "PENDING" | "RUNNING" | "FAILED"> = "COMPLETED"
): Promise<RasdMonitoringRun | null> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    const run = await delegate.update({
      where: { id },
      data: { status, finishedAt: now() }
    });
    await audit("rasd.run.finished", id, { status });
    return run;
  } catch {
    return updateMemoryRun(id, { status, finishedAt: now() });
  }
}

export async function failRun(id: string, error: string): Promise<RasdMonitoringRun | null> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    const run = await delegate.update({
      where: { id },
      data: { status: "FAILED", finishedAt: now(), errorSummary: error.slice(0, 4000) }
    });
    await audit("rasd.run.failed", id, { error: error.slice(0, 1000) });
    return run;
  } catch {
    return updateMemoryRun(id, { status: "FAILED", finishedAt: now(), errorSummary: error.slice(0, 4000) });
  }
}

export async function updateRunCounts(id: string, counts: RunCounts): Promise<RasdMonitoringRun | null> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    return await delegate.update({ where: { id }, data: counts });
  } catch {
    return updateMemoryRun(id, counts);
  }
}

export async function getRun(id: string): Promise<RasdMonitoringRun | null> {
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    return await delegate.findUnique({ where: { id } });
  } catch {
    return memoryRuns.get(id) ?? null;
  }
}

export async function listRuns(options: { status?: RasdRunStatus; limit?: number } = {}): Promise<RasdMonitoringRun[]> {
  const limit = options.limit ?? 50;
  try {
    const delegate = rasdDelegates().monitoringRun;
    if (!delegate) throw new Error("monitoringRun delegate is unavailable");
    return await delegate.findMany({
      where: options.status ? { status: options.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit
    });
  } catch {
    return [...memoryRuns.values()]
      .filter((run) => (options.status ? run.status === options.status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
