import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { healthCheckAllSources } from "@/lib/modules/rasd/health";
import { buildCoverageReport } from "@/lib/modules/rasd/reports/coverage";
import { buildConflictReport } from "@/lib/modules/rasd/reports/conflicts";
import { buildGapReport } from "@/lib/modules/rasd/reports/gaps";
import { applyApprovedChange } from "@/lib/modules/rasd/review/apply";
import { rollbackAppliedBatch } from "@/lib/modules/rasd/review/rollback";
import { runBaselineScan } from "@/lib/modules/rasd/scan/baseline";
import { runScan } from "@/lib/modules/rasd/scan/orchestrator";
import { runWeeklyScan } from "@/lib/modules/rasd/scan/weekly";
import { parseDocumentStructure } from "@/lib/modules/rasd/parse/structure";
import { buildDiffResult } from "@/lib/modules/rasd/diff/engine";
import { rankMatches } from "@/lib/modules/rasd/match/engine";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

type Flags = Record<string, string | boolean>;

function parseArgv(argv: string[]): { command: string; flags: Flags } {
  const [command = "help", ...rest] = argv;
  const flags: Flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

function has(flags: Flags, key: string): boolean {
  return flags[key] === true;
}

function value(flags: Flags, key: string): string | undefined {
  const raw = flags[key];
  return typeof raw === "string" ? raw : undefined;
}

function sources(flags: Flags): RasdSourceCode[] | undefined {
  const raw = value(flags, "source") ?? value(flags, "code");
  if (!raw) return undefined;
  const allowed = new Set(["BOE", "NCAR", "UQN"]);
  return raw.split(",").map((item) => item.trim()).filter((item): item is RasdSourceCode => allowed.has(item));
}

function limit(flags: Flags): number | undefined {
  const parsed = Number(value(flags, "limit"));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function print(result: unknown): void {
  console.log(JSON.stringify(result, null, 2));
}

async function reparseSnapshot(snapshotId: string): Promise<unknown> {
  const delegate = (prisma as unknown as {
    sourceSnapshot?: { findUnique(args: { where: { id: string } }): Promise<{ id: string; sourceUrl: string; rawText: string | null; rawStoragePath: string | null } | null> };
  }).sourceSnapshot;
  const snapshot = await delegate?.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new Error("Snapshot not found.");
  const raw = snapshot.rawText ?? (snapshot.rawStoragePath ? await readFile(snapshot.rawStoragePath, "utf8") : "");
  const parsed = parseDocumentStructure(raw, "CLI");
  return { snapshotId, title: parsed.title, provisions: parsed.provisions.length, hash: parsed.normalizedHash };
}

async function rematch(documentId?: string): Promise<unknown> {
  const docDelegate = (prisma as unknown as {
    monitoredLegalDocument?: { findMany(args: { where?: Record<string, unknown>; include: Record<string, unknown>; take: number }): Promise<Array<{ id: string; versions: Array<{ fullNormalizedText: string | null; metadata: Record<string, unknown> | null }> }>> };
  }).monitoredLegalDocument;
  const docs = await docDelegate?.findMany({
    where: documentId ? { id: documentId } : undefined,
    include: { versions: { take: 1, orderBy: { detectedAt: "desc" } } },
    take: 50
  });
  const systems = await prisma.legalSystem.findMany({
    take: 300,
    include: { articles: { take: 5, orderBy: { articleNumber: "asc" }, select: { articleNumber: true, content: true } } }
  });
  return (docs ?? []).map((doc) => {
    const version = doc.versions[0];
    const parsed = parseDocumentStructure(version?.fullNormalizedText ?? "", "CLI");
    return {
      documentId: doc.id,
      matches: rankMatches(
        { ...parsed, metadata: { ...parsed.metadata, ...(version?.metadata ?? {}) } },
        systems.map((system) => ({
          id: system.id,
          name: system.name,
          articles: system.articles.map((article) => ({ articleNumber: article.articleNumber, content: article.content }))
        }))
      ).slice(0, 3)
    };
  });
}

async function rediff(documentId?: string): Promise<unknown> {
  const versionDelegate = (prisma as unknown as {
    monitoredDocumentVersion?: { findMany(args: { where?: Record<string, unknown>; include: Record<string, unknown>; orderBy: Record<string, string>; take: number }): Promise<Array<{ id: string; documentId: string; fullNormalizedText: string | null; metadata: Record<string, unknown> | null; provisions: [] }>> };
  }).monitoredDocumentVersion;
  const versions = await versionDelegate?.findMany({
    where: documentId ? { documentId } : undefined,
    include: { provisions: { orderBy: { sequence: "asc" } } },
    orderBy: { detectedAt: "desc" },
    take: 2
  });
  if (!versions || versions.length < 2) return { message: "Need at least two versions to diff." };
  const [next, previous] = versions;
  return {
    documentId: next.documentId,
    diff: buildDiffResult(
      parseDocumentStructure(previous.fullNormalizedText ?? "", "CLI"),
      parseDocumentStructure(next.fullNormalizedText ?? "", "CLI")
    )
  };
}

async function integrityCheck(): Promise<unknown> {
  const duplicateCurrent = await prisma.$queryRaw<Array<{ article_id: string; count: bigint }>>`
    SELECT article_id, COUNT(*)::bigint AS count
    FROM article_versions
    WHERE effective_to IS NULL
    GROUP BY article_id
    HAVING COUNT(*) > 1
  `.catch(() => []);
  return {
    ok: duplicateCurrent.length === 0,
    duplicateCurrentVersions: duplicateCurrent.map((row) => ({ articleId: row.article_id, count: Number(row.count) }))
  };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgv(process.argv.slice(2));
  if (has(flags, "fixtures")) process.env.RASD_FIXTURES_ONLY = "true";
  const dryRun = command === "baseline" || command === "apply-change" || command === "rollback-batch"
    ? !has(flags, "apply")
    : has(flags, "dry-run") || !has(flags, "apply");

  switch (command) {
    case "baseline":
      print(await runBaselineScan({ dryRun, fixturesOnly: has(flags, "fixtures"), limit: limit(flags), sources: sources(flags) }));
      break;
    case "weekly":
      print(await runWeeklyScan({ dryRun: has(flags, "dry-run") || !has(flags, "apply"), fixturesOnly: has(flags, "fixtures") }));
      break;
    case "source":
      print(await runScan({ runType: "MANUAL", dryRun: true, fixturesOnly: has(flags, "fixtures"), sources: sources(flags), limit: limit(flags) }));
      break;
    case "retry-failed":
      print(await runScan({ runType: "RETRY", dryRun: true, fixturesOnly: has(flags, "fixtures"), resumeRunId: value(flags, "run-id") }));
      break;
    case "reparse-snapshot":
      print(await reparseSnapshot(value(flags, "snapshot-id") ?? ""));
      break;
    case "rematch":
      print(await rematch(value(flags, "document-id")));
      break;
    case "rediff":
      print(await rediff(value(flags, "document-id")));
      break;
    case "integrity-check":
      print(await integrityCheck());
      break;
    case "coverage-report":
      print({ coverage: await buildCoverageReport({ write: true }), gaps: await buildGapReport({ write: true }), conflicts: await buildConflictReport({ write: true }) });
      break;
    case "apply-change":
      print(await applyApprovedChange(value(flags, "id") ?? "", "cli", { dryRun }));
      break;
    case "rollback-batch":
      print(await rollbackAppliedBatch(value(flags, "id") ?? "", "cli", dryRun));
      break;
    case "health":
      print(await healthCheckAllSources());
      break;
    default:
      console.log("Usage: baseline|weekly|source|retry-failed|reparse-snapshot|rematch|rediff|integrity-check|coverage-report|apply-change|rollback-batch|health");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
