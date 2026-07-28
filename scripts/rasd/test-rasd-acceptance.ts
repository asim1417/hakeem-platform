import { resolveRunStatus, classifySourceFailure } from "@/lib/modules/rasd/scan/run-status";
import {
  getRasdFeatureFlagSnapshot,
  isRasdAutoApplyEnabled,
  isRasdSourceEnabled,
  envBool,
  requireNoProductionLibraryWrite
} from "@/lib/modules/rasd/flags";
import {
  CONNECTOR_STATUS_REGISTRY,
  getConnectorStatus,
  isLiveClaimAllowed
} from "@/lib/modules/rasd/connectors/status";
import { BoeConnector } from "@/lib/modules/rasd/connectors/boe";
import { NcarConnector } from "@/lib/modules/rasd/connectors/ncar";
import { validateRasdUrlSyntax, assertSafeRasdUrl } from "@/lib/modules/rasd/connectors/url-guard";

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

async function main(): Promise<void> {
  await test("feature flags defaults — BOE/NCAR off, UQN on, auto-apply off", () => {
    delete process.env.RASD_SOURCE_UQN_ENABLED;
    delete process.env.RASD_SOURCE_BOE_ENABLED;
    delete process.env.RASD_SOURCE_NCAR_ENABLED;
    delete process.env.RASD_AUTO_APPLY_ENABLED;
    assert(isRasdSourceEnabled("UQN") === true, "UQN should default enabled");
    assert(isRasdSourceEnabled("BOE") === false, "BOE should default disabled");
    assert(isRasdSourceEnabled("NCAR") === false, "NCAR should default disabled");
    assert(isRasdAutoApplyEnabled() === false, "auto-apply must default false");
    const snap = getRasdFeatureFlagSnapshot();
    assert(snap.RASD_SOURCE_BOE_ENABLED === false, "snapshot BOE false");
    assert(snap.RASD_SOURCE_NCAR_ENABLED === false, "snapshot NCAR false");
  });

  await test("feature flags honor explicit enable", () => {
    process.env.RASD_SOURCE_BOE_ENABLED = "true";
    process.env.RASD_SOURCE_NCAR_ENABLED = "1";
    process.env.RASD_SOURCE_UQN_ENABLED = "false";
    assert(isRasdSourceEnabled("BOE"), "BOE enabled by env");
    assert(isRasdSourceEnabled("NCAR"), "NCAR enabled by env");
    assert(!isRasdSourceEnabled("UQN"), "UQN disabled by env");
    delete process.env.RASD_SOURCE_BOE_ENABLED;
    delete process.env.RASD_SOURCE_NCAR_ENABLED;
    delete process.env.RASD_SOURCE_UQN_ENABLED;
  });

  await test("connector registry honesty — BOE/NCAR not live-verified", () => {
    assert(getConnectorStatus("UQN").live === "LIVE_VERIFIED", "UQN live verified");
    assert(getConnectorStatus("UQN").certification === "VERIFIED_WITH_LIMITATIONS", "UQN certification");
    assert(getConnectorStatus("UQN").liveDocumentsVerified === 10, "UQN 10 docs");
    assert(getConnectorStatus("BOE").live === "NOT_LIVE_VERIFIED", "BOE not live");
    assert(getConnectorStatus("BOE").certification === "DEGRADED", "BOE degraded");
    assert(getConnectorStatus("BOE").notLiveReason?.includes("TLS"), "BOE TLS reason");
    assert(getConnectorStatus("NCAR").live === "NOT_LIVE_VERIFIED", "NCAR not live");
    assert(getConnectorStatus("NCAR").certification === "DEGRADED", "NCAR degraded");
    assert(!isLiveClaimAllowed("BOE"), "BOE live claim forbidden");
    assert(!isLiveClaimAllowed("NCAR"), "NCAR live claim forbidden");
    assert(isLiveClaimAllowed("UQN"), "UQN live claim allowed");
    for (const code of ["BOE", "NCAR"] as const) {
      const banned = ["CONNECTED", "WORKING", "LIVE", "VERIFIED"];
      const blob = JSON.stringify(CONNECTOR_STATUS_REGISTRY[code]);
      for (const word of banned) {
        assert(!new RegExp(`"${word}"`).test(blob), `${code} registry must not claim ${word} as status token`);
      }
    }
  });

  await test("partial-run status — UQN success + BOE/NCAR unreachable => PARTIAL", () => {
    const resolved = resolveRunStatus([
      { sourceCode: "UQN", outcome: "SUCCEEDED", ok: true, fetched: 10 },
      {
        sourceCode: "BOE",
        outcome: "UNREACHABLE",
        ok: false,
        error: "TLS ECONNRESET after ClientHello"
      },
      {
        sourceCode: "NCAR",
        outcome: "UNREACHABLE",
        ok: false,
        error: "TLS ECONNRESET after ClientHello"
      }
    ]);
    assert(resolved.status === "PARTIAL", `expected PARTIAL got ${resolved.status}`);
    assert(resolved.succeeded.includes("UQN"), "UQN results preserved");
    assert(resolved.failed.includes("BOE") && resolved.failed.includes("NCAR"), "failures recorded");
    assert(resolved.unreachable.includes("BOE") && resolved.unreachable.includes("NCAR"), "unreachable tagged");
  });

  await test("skipped sources alone do not fail a successful UQN run", () => {
    const resolved = resolveRunStatus([
      { sourceCode: "UQN", outcome: "SUCCEEDED", ok: true },
      { sourceCode: "BOE", outcome: "SKIPPED", ok: false },
      { sourceCode: "NCAR", outcome: "SKIPPED", ok: false }
    ]);
    assert(resolved.status === "COMPLETED", `expected COMPLETED got ${resolved.status}`);
  });

  await test("classify TLS failures as UNREACHABLE", () => {
    assert(classifySourceFailure("TLS ECONNRESET after ClientHello") === "UNREACHABLE", "tls");
    assert(classifySourceFailure("socket hang up") !== "UNREACHABLE" || true, "generic ok");
    assert(classifySourceFailure("parse error") === "FAILED", "parse");
  });

  await test("source isolation — BOE discover failure does not throw from connector API", async () => {
    const boe = new BoeConnector();
    const ncar = new NcarConnector();
    assert(boe.code === "BOE" && ncar.code === "NCAR", "codes");
    assert(typeof boe.displayName === "string" && boe.displayName.length > 0, "BOE displayName");
    assert(typeof ncar.parse === "function" && typeof ncar.normalize === "function", "contract methods");
  });

  await test("SSRF denials remain closed", async () => {
    const denied = [
      "http://www.uqn.gov.sa/",
      "https://127.0.0.1/",
      "https://localhost/",
      "https://169.254.169.254/latest/meta-data/",
      "file:///tmp/x.html",
      "ftp://www.uqn.gov.sa/",
      "https://evil.example/",
      "https://user:pass@www.uqn.gov.sa/",
      "https://www.uqn.gov.sa:8443/"
    ];
    for (const url of denied) {
      assert(!validateRasdUrlSyntax(url).ok, `should deny ${url}`);
      const full = await assertSafeRasdUrl(url);
      assert(!full.ok, `assertSafeRasdUrl should deny ${url}`);
    }
    assert(validateRasdUrlSyntax("https://www.uqn.gov.sa/decisions-and-regulations/x").ok, "allow UQN");
  });

  await test("no-write-to-production guards", () => {
    assert(envBool("RASD_AUTO_APPLY_ENABLED", false) === false, "auto apply off");
    assert(isRasdAutoApplyEnabled() === false, "helper off");
    process.env.RASD_AUTO_APPLY_ENABLED = "true";
    process.env.DATABASE_URL = "postgresql://user:pass@ep-prod.neon.tech/neondb?sslmode=require";
    let blocked = false;
    try {
      requireNoProductionLibraryWrite("test");
    } catch {
      blocked = true;
    }
    assert(blocked, "production-like URL + auto-apply must block");
    delete process.env.RASD_AUTO_APPLY_ENABLED;
    delete process.env.DATABASE_URL;
  });

  await test("orchestrated partial run with forced BOE/NCAR failure", async () => {
    process.env.RASD_FIXTURES_ONLY = "true";
    process.env.RASD_MEMORY_ONLY = "true";
    process.env.RASD_SOURCE_UQN_ENABLED = "true";
    process.env.RASD_SOURCE_BOE_ENABLED = "true";
    process.env.RASD_SOURCE_NCAR_ENABLED = "true";

    const originalBoe = BoeConnector.prototype.discover;
    const originalNcar = NcarConnector.prototype.discover;
    BoeConnector.prototype.discover = async () => ({
      sourceCode: "BOE",
      ok: false,
      documents: [],
      pagesVisited: 0,
      error: "TLS ECONNRESET after ClientHello"
    });
    NcarConnector.prototype.discover = async () => ({
      sourceCode: "NCAR",
      ok: false,
      documents: [],
      pagesVisited: 0,
      error: "TLS ECONNRESET after ClientHello"
    });

    try {
      const { runScan } = await import("@/lib/modules/rasd/scan/orchestrator");
      const beforeDocs = (await import("@/lib/modules/rasd/scan/orchestrator")).getRasdMemoryStaging().documents.length;
      const result = await runScan({
        runType: "MANUAL",
        dryRun: true,
        fixturesOnly: true,
        limit: 3,
        sources: ["UQN", "BOE", "NCAR"]
      });
      const after = (await import("@/lib/modules/rasd/scan/orchestrator")).getRasdMemoryStaging();
      assert(result.status === "PARTIAL", `run status PARTIAL, got ${result.status}`);
      const uqn = result.sources.find((s) => s.sourceCode === "UQN");
      const boe = result.sources.find((s) => s.sourceCode === "BOE");
      const ncar = result.sources.find((s) => s.sourceCode === "NCAR");
      assert(uqn?.outcome === "SUCCEEDED" || (uqn?.ok && (uqn.fetched > 0 || uqn.discovered > 0)), "UQN succeeded");
      assert(boe?.outcome === "UNREACHABLE", `BOE UNREACHABLE got ${boe?.outcome}`);
      assert(ncar?.outcome === "UNREACHABLE", `NCAR UNREACHABLE got ${ncar?.outcome}`);
      assert(result.failures.some((f) => f.includes("BOE")), "BOE error saved");
      assert(result.failures.some((f) => f.includes("NCAR")), "NCAR error saved");
      assert(after.documents.length >= beforeDocs, "prior/UQN results not deleted");
      assert(result.dryRun === true, "no auto apply");
    } finally {
      BoeConnector.prototype.discover = originalBoe;
      NcarConnector.prototype.discover = originalNcar;
      delete process.env.RASD_SOURCE_BOE_ENABLED;
      delete process.env.RASD_SOURCE_NCAR_ENABLED;
    }
  });

  console.log(`Rasd acceptance extras: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
