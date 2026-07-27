#!/usr/bin/env tsx
/**
 * Rasd production worker — long-running process separate from the Next.js web tier.
 *
 * Deploy this on a runner/VPS that can complete TLS to BOE/NCAR/UQN.
 * Do NOT run crawls solely on Vercel Serverless.
 *
 * Env (required for live mode):
 *   RASD_ENABLED=true
 *   RASD_AUTO_FETCH_ENABLED=true
 *   RASD_WORKER_ENABLED=true
 *   DATABASE_URL=... (staging first; production only after gates)
 *   RASD_SOURCE_UQN_ENABLED / BOE / NCAR per source
 *
 * Safety defaults:
 *   RASD_AUTO_APPLY_ENABLED=false
 *   RASD_REVIEW_REQUIRED=true
 *   RASD_WORKER_DRY_RUN=true until explicitly disabled
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import {
  envBool,
  getRasdFeatureFlagSnapshot,
  isRasdSourceEnabled,
  requireRasdEnabled
} from "@/lib/modules/rasd/flags";
import { runScan } from "@/lib/modules/rasd/scan/orchestrator";
import { listCircuits } from "@/lib/modules/rasd/connectors/circuit-breaker";
import { describeAllConnectors } from "@/lib/modules/rasd/connectors";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";
import { prisma } from "@/lib/prisma";

const POLL_MS = Number(process.env.RASD_WORKER_POLL_MS || 60_000);
const SOURCES = (["UQN", "BOE", "NCAR"] as RasdSourceCode[]).filter((code) => isRasdSourceEnabled(code));

function log(message: string, extra?: unknown): void {
  const line = { ts: new Date().toISOString(), message, ...(extra ? { extra } : {}) };
  console.log(JSON.stringify(line));
}

async function healthSnapshot() {
  return {
    flags: getRasdFeatureFlagSnapshot(),
    connectors: describeAllConnectors(),
    circuits: listCircuits(),
    sourcesConfigured: SOURCES
  };
}

async function runOne(source: RasdSourceCode) {
  const dryRun = envBool("RASD_WORKER_DRY_RUN", true);
  const fixturesOnly = envBool("RASD_FIXTURES_ONLY", false);
  log("source_run_start", { source, dryRun, fixturesOnly });
  const result = await runScan({
    runType: "WEEKLY",
    sources: [source],
    dryRun,
    fixturesOnly,
    limit: Number(process.env.RASD_WORKER_LIMIT || 25),
    actorId: "rasd-worker"
  });
  log("source_run_finished", {
    source,
    status: result.status,
    counts: result.counts,
    failures: result.failures.slice(0, 10),
    outcomes: result.sources.map((s) => ({ code: s.sourceCode, outcome: s.outcome, fetched: s.fetched }))
  });
  return result;
}

async function loop(): Promise<void> {
  if (!envBool("RASD_WORKER_ENABLED", false)) {
    throw new Error("RASD_WORKER_ENABLED must be true to start the worker.");
  }
  requireRasdEnabled();
  log("worker_started", await healthSnapshot());

  // One-shot mode for CI/smoke
  if (envBool("RASD_WORKER_ONCE", false)) {
    for (const source of SOURCES) {
      await runOne(source).catch((error) => log("source_run_error", { source, error: String(error) }));
    }
    return;
  }

  while (true) {
    for (const source of SOURCES) {
      try {
        await runOne(source);
      } catch (error) {
        log("source_run_error", { source, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const outDir = path.join(process.cwd(), "reports", "rasd");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "worker-health.json"), JSON.stringify(await healthSnapshot(), null, 2));
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
