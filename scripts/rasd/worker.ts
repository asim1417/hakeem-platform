#!/usr/bin/env tsx
/**
 * Rasd staging/production worker — long-running process separate from Next.js.
 *
 * Safety defaults:
 *   RASD_AUTO_APPLY_ENABLED=false
 *   RASD_REVIEW_REQUIRED=true
 *   RASD_WORKER_DRY_RUN=true until explicitly disabled
 *
 * Health:
 *   Optional protected HTTP listener on RASD_WORKER_HEALTH_PORT (default off).
 *   Auth via RASD_WORKER_HEALTH_TOKEN (required when port enabled).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
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
import { alertCircuitStates, sendRasdAlert } from "@/lib/modules/rasd/notify/alerts";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";
import { prisma } from "@/lib/prisma";

const POLL_MS = Number(process.env.RASD_WORKER_POLL_MS || 60_000);
const SOURCES = (["UQN", "BOE", "NCAR"] as RasdSourceCode[]).filter((code) => isRasdSourceEnabled(code));

let lastHeartbeatAt: string | null = null;
let lastRunSummary: Record<string, unknown> | null = null;
let startedAt = new Date().toISOString();
let running = false;

function log(message: string, extra?: unknown): void {
  const line = { ts: new Date().toISOString(), message, ...(extra ? { extra } : {}) };
  console.log(JSON.stringify(line));
}

function redactedFlags() {
  const flags = getRasdFeatureFlagSnapshot();
  return {
    ...flags,
    // ensure no accidental secret fields
  };
}

async function healthSnapshot(includeSecretsCheck = true) {
  lastHeartbeatAt = new Date().toISOString();
  return {
    workerStatus: running ? "RUNNING" : "IDLE",
    startedAt,
    lastHeartbeatAt,
    lastRun: lastRunSummary,
    sourcesConfigured: SOURCES,
    flags: redactedFlags(),
    connectors: describeAllConnectors().map((c) => ({
      code: c.code,
      certification: c.certification,
      live: c.live,
      enabled: isRasdSourceEnabled(c.code)
    })),
    circuits: listCircuits(),
    queueStatus: "inline-loop",
    secretsCheck: includeSecretsCheck
      ? {
          databaseUrlPresent: Boolean(process.env.DATABASE_URL),
          cronSecretPresent: Boolean(process.env.RASD_CRON_SECRET || process.env.CRON_SECRET),
          alertWebhookPresent: Boolean(process.env.RASD_ALERT_WEBHOOK_URL)
        }
      : undefined
  };
}

function readToken(req: IncomingMessage): string | null {
  const header = req.headers["x-rasd-worker-token"] || req.headers.authorization;
  if (!header) return null;
  if (Array.isArray(header)) return header[0] ?? null;
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return header.trim();
}

function startHealthServer(): void {
  const port = Number(process.env.RASD_WORKER_HEALTH_PORT || 0);
  if (!port) {
    log("health_server_disabled");
    return;
  }
  const expected = process.env.RASD_WORKER_HEALTH_TOKEN?.trim();
  if (!expected) {
    throw new Error("RASD_WORKER_HEALTH_TOKEN required when RASD_WORKER_HEALTH_PORT is set");
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== "/health" && req.url !== "/healthz") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    const token = readToken(req);
    if (token !== expected) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const body = await healthSnapshot();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });

  server.listen(port, "127.0.0.1", () => {
    log("health_server_listening", { port, bind: "127.0.0.1" });
  });
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
  lastRunSummary = {
    source,
    status: result.status,
    counts: result.counts,
    finishedAt: new Date().toISOString(),
    outcomes: result.sources.map((s) => ({ code: s.sourceCode, outcome: s.outcome, fetched: s.fetched }))
  };
  log("source_run_finished", {
    source,
    status: result.status,
    counts: result.counts,
    failures: result.failures.slice(0, 10),
    outcomes: lastRunSummary.outcomes
  });

  if (!result.sources.every((s) => s.ok)) {
    await sendRasdAlert({
      kind: "SOURCE_FAILURE",
      severity: "warning",
      title: `Source run issue: ${source}`,
      summary: `Worker run for ${source} finished with status ${result.status}.`,
      sourceCode: source,
      runId: result.runId,
      adminPath: "/health"
    });
  }
  if (result.counts.documentsNew > 0) {
    await sendRasdAlert({
      kind: "NEW_DOCUMENT",
      severity: "info",
      title: `New monitored documents: ${source}`,
      summary: `${result.counts.documentsNew} new document(s) detected (dry-run=${dryRun}).`,
      sourceCode: source,
      runId: result.runId,
      adminPath: "/runs"
    });
  }
  if (result.counts.conflictsFound > 0) {
    await sendRasdAlert({
      kind: "SOURCE_CONFLICT",
      severity: "warning",
      title: `Conflicts detected: ${source}`,
      summary: `${result.counts.conflictsFound} conflict(s) recorded.`,
      sourceCode: source,
      runId: result.runId,
      adminPath: "/conflicts"
    });
  }
  await alertCircuitStates();
  return result;
}

async function loop(): Promise<void> {
  if (!envBool("RASD_WORKER_ENABLED", false)) {
    throw new Error("RASD_WORKER_ENABLED must be true to start the worker.");
  }
  requireRasdEnabled();
  startHealthServer();
  running = true;
  log("worker_started", await healthSnapshot());
  await sendRasdAlert({
    kind: "WORKER_HEARTBEAT",
    severity: "info",
    title: "Rasd worker started",
    summary: `Worker started with sources: ${SOURCES.join(",") || "(none)"}`,
    adminPath: "/health"
  });

  if (envBool("RASD_WORKER_ONCE", false)) {
    for (const source of SOURCES) {
      await runOne(source).catch((error) => log("source_run_error", { source, error: String(error) }));
    }
    running = false;
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
    const snapshot = await healthSnapshot();
    const outDir = path.join(process.cwd(), "reports", "rasd");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "worker-health.json"), JSON.stringify(snapshot, null, 2));
    await sendRasdAlert({
      kind: "WORKER_HEARTBEAT",
      severity: "info",
      title: "Rasd worker heartbeat",
      summary: "Worker loop heartbeat written.",
      adminPath: "/health"
    });
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    running = false;
    await prisma.$disconnect().catch(() => undefined);
  });
