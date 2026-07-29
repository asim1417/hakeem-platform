#!/usr/bin/env tsx
/**
 * Staging-only limited live scan (dry-run).
 * Fetches up to N docs per source, persists monitoring tables when DATABASE_URL is staging,
 * NEVER writes legal_systems / legal_articles (auto-apply forced off).
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { runScan } from "@/lib/modules/rasd/scan/orchestrator";
import { listCircuits, resetAllCircuits } from "@/lib/modules/rasd/connectors/circuit-breaker";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

function assertStagingDb(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL required for staging scan");
  const host = new URL(url).hostname;
  const allowLocal = ["127.0.0.1", "localhost"].includes(host);
  const allowNeonStaging =
    /\.neon\.tech$/i.test(host) && /staging|preview|rasd/i.test(url + (process.env.RASD_STAGING_OK || ""));
  if (!allowLocal && !process.env.RASD_STAGING_OK) {
    throw new Error("Refusing scan: set RASD_STAGING_OK=1 only for an authorized Neon staging/preview URL.");
  }
  if (!allowLocal && !allowNeonStaging && process.env.RASD_STAGING_OK !== "1") {
    throw new Error("DATABASE_URL does not look like staging; aborting.");
  }
  // Extra safety
  process.env.RASD_AUTO_APPLY_ENABLED = "false";
  process.env.RASD_REVIEW_REQUIRED = "true";
}

async function countLibrary() {
  const [systems, articles] = await Promise.all([
    prisma.legalSystem.count().catch(() => -1),
    prisma.legalArticle.count().catch(() => -1)
  ]);
  return { systems, articles };
}

async function countMonitoring() {
  const db = prisma as unknown as {
    monitoredLegalDocument?: { count(): Promise<number> };
    sourceSnapshot?: { count(): Promise<number> };
    monitoringRun?: { count(): Promise<number> };
  };
  return {
    documents: (await db.monitoredLegalDocument?.count()) ?? -1,
    snapshots: (await db.sourceSnapshot?.count()) ?? -1,
    runs: (await db.monitoringRun?.count()) ?? -1
  };
}

async function main() {
  assertStagingDb();
  process.env.RASD_ENABLED = "true";
  process.env.RASD_AUTO_FETCH_ENABLED = "true";
  process.env.RASD_MEMORY_ONLY = "false";
  process.env.RASD_FIXTURES_ONLY = "false";
  process.env.RASD_CIRCUIT_BREAKER_ENABLED = "true";

  const limit = Number(process.env.RASD_STAGING_LIMIT || 10);
  const sources = (process.env.RASD_STAGING_SOURCES || "UQN,BOE,NCAR")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is RasdSourceCode => ["UQN", "BOE", "NCAR"].includes(s));

  for (const code of sources) {
    process.env[`RASD_SOURCE_${code}_ENABLED`] = "true";
  }

  resetAllCircuits();
  const beforeLibrary = await countLibrary();
  const beforeMon = await countMonitoring();

  const pass1 = await runScan({
    runType: "MANUAL",
    sources,
    dryRun: true,
    fixturesOnly: false,
    limit,
    actorId: "staging-live-scan"
  });

  const pass2 = await runScan({
    runType: "MANUAL",
    sources,
    dryRun: true,
    fixturesOnly: false,
    limit,
    actorId: "staging-live-scan-dedupe"
  });

  const afterLibrary = await countLibrary();
  const afterMon = await countMonitoring();

  const report = {
    generatedAt: new Date().toISOString(),
    environment: "staging-only",
    dryRun: true,
    autoApply: false,
    limit,
    sources,
    pass1: {
      runId: pass1.runId,
      status: pass1.status,
      counts: pass1.counts,
      sources: pass1.sources,
      failures: pass1.failures,
      changesSample: pass1.changes.slice(0, 30).map((c) => ({
        documentId: c.documentId,
        changeType: c.changeType,
        severity: c.severity,
        reviewStatus: c.reviewStatus
      }))
    },
    pass2: {
      runId: pass2.runId,
      status: pass2.status,
      counts: pass2.counts,
      sources: pass2.sources,
      failures: pass2.failures
    },
    dedupe: {
      pass1New: pass1.counts.documentsNew,
      pass2Unchanged: pass2.counts.documentsUnchanged,
      pass2New: pass2.counts.documentsNew
    },
    libraryGuard: {
      before: beforeLibrary,
      after: afterLibrary,
      unchanged: beforeLibrary.systems === afterLibrary.systems && beforeLibrary.articles === afterLibrary.articles
    },
    monitoring: { before: beforeMon, after: afterMon },
    circuits: listCircuits()
  };

  const outDir = path.join(process.cwd(), "docs/rasd/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "STAGING_LIVE_SCAN_REPORT.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        outPath,
        status1: pass1.status,
        status2: pass2.status,
        libraryUnchanged: report.libraryGuard.unchanged,
        dedupe: report.dedupe,
        sourceOutcomes: pass1.sources.map((s) => ({ code: s.sourceCode, outcome: s.outcome, fetched: s.fetched }))
      },
      null,
      2
    )
  );

  if (!report.libraryGuard.unchanged) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
