import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getRasdMemoryStaging } from "../scan/orchestrator";

export interface GapReportRow {
  documentId: string;
  title: string;
  documentType: string;
  matchStatus: string;
  sourceCount: number;
  reason: string;
}

export interface GapReport {
  generatedAt: string;
  rows: GapReportRow[];
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function writeRasdReport(name: string, report: unknown, rows: Array<Record<string, string | number | null | undefined>> = []): Promise<{ jsonPath: string; csvPath?: string }> {
  const dir = path.join(process.cwd(), "reports/rasd");
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${name}.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  if (rows.length === 0) return { jsonPath };
  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))].join("\n");
  const csvPath = path.join(dir, `${name}.csv`);
  await writeFile(csvPath, csv, "utf8");
  return { jsonPath, csvPath };
}

export async function buildGapReport(options: { write?: boolean } = {}): Promise<GapReport> {
  const rows: GapReportRow[] = [];
  try {
    const delegate = (prisma as unknown as {
      monitoredLegalDocument?: {
        findMany(args: { where: Record<string, unknown>; include: Record<string, unknown>; take: number; orderBy: Record<string, string> }): Promise<Array<{
          id: string;
          normalizedTitle: string;
          documentType: string;
          matchStatus: string;
          versions: Array<{ sourceId: string }>;
        }>>;
      };
    }).monitoredLegalDocument;
    const documents = await delegate?.findMany({
      where: { matchStatus: { in: ["NO_MATCH", "AMBIGUOUS"] } },
      include: { versions: true },
      take: 500,
      orderBy: { createdAt: "desc" }
    });
    for (const document of documents ?? []) {
      rows.push({
        documentId: document.id,
        title: document.normalizedTitle,
        documentType: document.documentType,
        matchStatus: document.matchStatus,
        sourceCount: new Set(document.versions.map((version) => version.sourceId)).size,
        reason: document.matchStatus === "NO_MATCH" ? "لا توجد مطابقة في مكتبة حكيم" : "مطابقة محتملة تحتاج مراجعة"
      });
    }
  } catch {
    for (const document of getRasdMemoryStaging().documents) {
      const best = document.matches[0];
      if (best && best.status !== "NO_MATCH" && best.status !== "AMBIGUOUS") continue;
      rows.push({
        documentId: document.id,
        title: document.parsed.title ?? document.discovered.title ?? document.discovered.url,
        documentType: String(document.parsed.metadata.documentType ?? "OTHER"),
        matchStatus: best?.status ?? "NO_MATCH",
        sourceCount: 1,
        reason: "ذاكرة تشغيل fixtures/dry-run"
      });
    }
  }
  const report = { generatedAt: new Date().toISOString(), rows };
  if (options.write) await writeRasdReport("gaps", report, rows.map((row) => ({ ...row })));
  return report;
}
