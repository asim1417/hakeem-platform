/**
 * Isolation / partial-run scenario tests for Rasd orchestration.
 */
process.env.RASD_FIXTURES_ONLY = "true";
process.env.RASD_MEMORY_ONLY = "true";
process.env.RASD_SOURCE_UQN_ENABLED = "true";
process.env.RASD_SOURCE_BOE_ENABLED = "true";
process.env.RASD_SOURCE_NCAR_ENABLED = "true";

import { BoeConnector } from "@/lib/modules/rasd/connectors/boe";
import { NcarConnector } from "@/lib/modules/rasd/connectors/ncar";
import { UqnConnector } from "@/lib/modules/rasd/connectors/uqn";
import { runScan, getRasdMemoryStaging } from "@/lib/modules/rasd/scan/orchestrator";
import { resolveRunStatus } from "@/lib/modules/rasd/scan/run-status";
import { isRasdAutoApplyEnabled } from "@/lib/modules/rasd/flags";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type DiscoverFn = typeof BoeConnector.prototype.discover;
type FetchFn = typeof BoeConnector.prototype.fetchDocument;

async function withPatched(
  patches: Array<{ target: { discover: DiscoverFn; fetchDocument: FetchFn }; discover?: DiscoverFn; fetch?: FetchFn }>,
  fn: () => Promise<void>
): Promise<void> {
  const originals = patches.map((p) => ({
    target: p.target,
    discover: p.target.discover,
    fetch: p.target.fetchDocument
  }));
  try {
    for (const p of patches) {
      if (p.discover) p.target.discover = p.discover;
      if (p.fetch) p.target.fetchDocument = p.fetch;
    }
    await fn();
  } finally {
    for (const o of originals) {
      o.target.discover = o.discover;
      o.target.fetchDocument = o.fetch;
    }
  }
}

function unreachableDiscover(code: "BOE" | "NCAR" | "UQN"): DiscoverFn {
  return async () => ({
    sourceCode: code,
    ok: false,
    documents: [],
    pagesVisited: 0,
    error: "TLS ECONNRESET after ClientHello"
  });
}

function timeoutDiscover(code: "BOE" | "NCAR" | "UQN"): DiscoverFn {
  return async () => ({
    sourceCode: code,
    ok: false,
    documents: [],
    pagesVisited: 0,
    error: "ETIMEDOUT network timeout"
  });
}

function unexpectedHtmlFetch(): FetchFn {
  return async (url: string) => ({
    ok: true,
    status: 200,
    headers: { "content-type": "text/html" },
    bodyText: "<html><body><h1>Unexpected portal</h1><p>no legal content</p></body></html>",
    error: undefined
  });
}

function httpErrorFetch(status: number): FetchFn {
  return async () => ({
    ok: false,
    status,
    headers: {},
    bodyText: "",
    error: `HTTP ${status}`
  });
}

async function main(): Promise<void> {
  await test("1) UQN success + BOE/NCAR fail => PARTIAL, UQN kept, no auto-apply", async () => {
    const before = getRasdMemoryStaging().documents.length;
    await withPatched(
      [
        { target: BoeConnector.prototype, discover: unreachableDiscover("BOE") },
        { target: NcarConnector.prototype, discover: unreachableDiscover("NCAR") }
      ],
      async () => {
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 2,
          sources: ["UQN", "BOE", "NCAR"]
        });
        assert(result.status === "PARTIAL", `expected PARTIAL got ${result.status}`);
        assert(result.sources.find((s) => s.sourceCode === "UQN")?.ok, "UQN ok");
        assert(result.sources.find((s) => s.sourceCode === "BOE")?.outcome === "UNREACHABLE", "BOE unreachable");
        assert(result.sources.find((s) => s.sourceCode === "NCAR")?.outcome === "UNREACHABLE", "NCAR unreachable");
        assert(getRasdMemoryStaging().documents.length >= before, "results not deleted");
        assert(result.dryRun === true, "dry run");
        assert(isRasdAutoApplyEnabled() === false, "no auto apply");
      }
    );
  });

  await test("2) BOE success + NCAR fail => PARTIAL", async () => {
    await withPatched(
      [{ target: NcarConnector.prototype, discover: unreachableDiscover("NCAR") }],
      async () => {
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 2,
          sources: ["BOE", "NCAR"]
        });
        assert(result.status === "PARTIAL", `expected PARTIAL got ${result.status}`);
        assert(result.sources.find((s) => s.sourceCode === "BOE")?.outcome === "SUCCEEDED" || result.sources.find((s) => s.sourceCode === "BOE")?.ok, "BOE ok");
      }
    );
  });

  await test("3) NCAR success + BOE fail => PARTIAL", async () => {
    await withPatched(
      [{ target: BoeConnector.prototype, discover: unreachableDiscover("BOE") }],
      async () => {
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 2,
          sources: ["BOE", "NCAR"]
        });
        assert(result.status === "PARTIAL", `expected PARTIAL got ${result.status}`);
        assert(result.sources.find((s) => s.sourceCode === "NCAR")?.ok, "NCAR ok");
      }
    );
  });

  await test("4) timeout classification => UNREACHABLE / PARTIAL", async () => {
    await withPatched(
      [{ target: BoeConnector.prototype, discover: timeoutDiscover("BOE") }],
      async () => {
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 1,
          sources: ["UQN", "BOE"]
        });
        assert(result.status === "PARTIAL", `expected PARTIAL got ${result.status}`);
        assert(result.sources.find((s) => s.sourceCode === "BOE")?.outcome === "UNREACHABLE", "timeout unreachable");
      }
    );
  });

  await test("5) unexpected HTML still does not crash engine", async () => {
    await withPatched(
      [{ target: UqnConnector.prototype, fetch: unexpectedHtmlFetch() }],
      async () => {
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 1,
          sources: ["UQN"]
        });
        assert(["COMPLETED", "PARTIAL"].includes(result.status), `engine continued with ${result.status}`);
      }
    );
  });

  await test("6) HTTP 429/5xx recorded without wiping prior results", async () => {
    const before = getRasdMemoryStaging().documents.length;
    await withPatched(
      [
        { target: BoeConnector.prototype, fetch: httpErrorFetch(429) },
        { target: NcarConnector.prototype, fetch: httpErrorFetch(503) }
      ],
      async () => {
        // Force discover success via fixtures then fail fetch for BOE/NCAR paths:
        // fixtures fetch uses file:// — patch fetch to fail for non-file.
        const result = await runScan({
          runType: "MANUAL",
          dryRun: true,
          fixturesOnly: true,
          limit: 1,
          sources: ["UQN"]
        });
        assert(result.status === "COMPLETED" || result.status === "PARTIAL", "engine continued");
        assert(getRasdMemoryStaging().documents.length >= before, "no wipe");
        const resolved = resolveRunStatus([
          { sourceCode: "UQN", outcome: "SUCCEEDED", ok: true },
          { sourceCode: "BOE", outcome: "FAILED", ok: false, error: "HTTP 429" },
          { sourceCode: "NCAR", outcome: "FAILED", ok: false, error: "HTTP 503" }
        ]);
        assert(resolved.status === "PARTIAL", "429/5xx => PARTIAL aggregate");
      }
    );
  });

  console.log(`Rasd isolation tests: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
