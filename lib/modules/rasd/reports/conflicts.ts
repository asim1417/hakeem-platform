import { prisma } from "@/lib/prisma";
import { getRasdMemoryStaging } from "../scan/orchestrator";
import { writeRasdReport } from "./gaps";

export interface ConflictReportRow {
  conflictId: string;
  documentId: string;
  fieldName: string;
  conflictType: string;
  severity: string;
  status: string;
  boeValue?: string;
  ncarValue?: string;
  uqnValue?: string;
}

export interface ConflictReport {
  generatedAt: string;
  open: number;
  critical: number;
  rows: ConflictReportRow[];
}

export async function buildConflictReport(options: { write?: boolean; status?: string } = {}): Promise<ConflictReport> {
  const rows: ConflictReportRow[] = [];
  try {
    const delegate = (prisma as unknown as {
      sourceConflict?: {
        findMany(args: { where?: Record<string, unknown>; orderBy: Record<string, string>; take: number }): Promise<Array<{
          id: string;
          documentId: string;
          fieldName: string;
          conflictType: string;
          severity: string;
          status: string;
          boeValue: string | null;
          ncarValue: string | null;
          uqnValue: string | null;
        }>>;
      };
    }).sourceConflict;
    const conflicts = await delegate?.findMany({
      where: options.status ? { status: options.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500
    });
    for (const conflict of conflicts ?? []) {
      rows.push({
        conflictId: conflict.id,
        documentId: conflict.documentId,
        fieldName: conflict.fieldName,
        conflictType: conflict.conflictType,
        severity: conflict.severity,
        status: conflict.status,
        boeValue: conflict.boeValue ?? undefined,
        ncarValue: conflict.ncarValue ?? undefined,
        uqnValue: conflict.uqnValue ?? undefined
      });
    }
  } catch {
    for (const conflict of getRasdMemoryStaging().conflicts) {
      if (options.status && conflict.status !== options.status) continue;
      rows.push({
        conflictId: `memory-${rows.length + 1}`,
        documentId: conflict.documentId ?? "memory",
        fieldName: conflict.fieldName,
        conflictType: conflict.conflictType,
        severity: conflict.severity,
        status: conflict.status,
        boeValue: conflict.valuesBySource.BOE,
        ncarValue: conflict.valuesBySource.NCAR,
        uqnValue: conflict.valuesBySource.UQN
      });
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    open: rows.filter((row) => row.status === "OPEN").length,
    critical: rows.filter((row) => row.severity === "CRITICAL").length,
    rows
  };
  if (options.write) await writeRasdReport("conflicts", report, rows.map((row) => ({ ...row })));
  return report;
}
