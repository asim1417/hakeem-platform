import { prisma } from "@/lib/prisma";
import { writeRasdReport } from "./gaps";

export interface CoverageReportRow {
  sourceCode: string;
  documents: number;
  currentVersions: number;
  matched: number;
  unmatched: number;
}

export interface CoverageReport {
  generatedAt: string;
  totals: {
    documents: number;
    matched: number;
    unmatched: number;
  };
  rows: CoverageReportRow[];
}

export async function buildCoverageReport(options: { write?: boolean } = {}): Promise<CoverageReport> {
  const rows: CoverageReportRow[] = [];
  try {
    const delegate = (prisma as unknown as {
      monitoringSource?: {
        findMany(args: { include: Record<string, unknown>; orderBy: Record<string, string> }): Promise<Array<{
          code: string;
          versions: Array<{ isCurrentAtSource: boolean; document: { matchStatus: string } }>;
        }>>;
      };
    }).monitoringSource;
    const sources = await delegate?.findMany({
      include: { versions: { include: { document: true } } },
      orderBy: { code: "asc" }
    });
    for (const source of sources ?? []) {
      const documentIds = new Set(source.versions.map((version, index) => `${version.document.matchStatus}:${index}`));
      const matched = source.versions.filter((version) => version.document.matchStatus === "EXACT_MATCH" || version.document.matchStatus === "PROBABLE_MATCH").length;
      rows.push({
        sourceCode: source.code,
        documents: documentIds.size,
        currentVersions: source.versions.filter((version) => version.isCurrentAtSource).length,
        matched,
        unmatched: source.versions.length - matched
      });
    }
  } catch {
    try {
      const { getRasdMemoryStaging } = await import("../scan/orchestrator");
      const grouped = new Map<string, CoverageReportRow>();
      for (const document of getRasdMemoryStaging().documents) {
        const row = grouped.get(document.sourceCode) ?? {
          sourceCode: document.sourceCode,
          documents: 0,
          currentVersions: 0,
          matched: 0,
          unmatched: 0
        };
        row.documents += 1;
        row.currentVersions += 1;
        const best = document.matches[0];
        if (best?.status === "EXACT_MATCH" || best?.status === "PROBABLE_MATCH") row.matched += 1;
        else row.unmatched += 1;
        grouped.set(document.sourceCode, row);
      }
      rows.push(...grouped.values());
    } catch {
      // no memory staging available
    }
  }

  const totals = rows.reduce(
    (acc, row) => ({
      documents: acc.documents + row.documents,
      matched: acc.matched + row.matched,
      unmatched: acc.unmatched + row.unmatched
    }),
    { documents: 0, matched: 0, unmatched: 0 }
  );
  const report = { generatedAt: new Date().toISOString(), totals, rows };
  if (options.write) await writeRasdReport("coverage", report, rows.map((row) => ({ ...row })));
  return report;
}
