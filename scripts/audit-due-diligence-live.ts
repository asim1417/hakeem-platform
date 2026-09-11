import assert from "node:assert/strict";
import {
  MC_GIS_ENDPOINT,
  SaudiCommerceGisConnector,
} from "../lib/modules/due-diligence/connectors";
import {
  CMA_INSTITUTIONS_URL,
  CmaCapitalMarketInstitutionsConnector,
} from "../lib/modules/due-diligence/cma";
import {
  SAMA_FINANCE_ENTITIES_URL,
  SamaFinanceEntitiesConnector,
} from "../lib/modules/due-diligence/sama";
import { runDueDiligence, type EntityQuery } from "../lib/modules/due-diligence/core";

type ProbeResult = {
  probe: string;
  ok: boolean;
  detail: string;
  sourceStatus?: string;
  evidence?: number;
  needsReview?: number;
  rejected?: number;
};

const results: ProbeResult[] = [];

async function probe(name: string, fn: () => Promise<Omit<ProbeResult, "probe" | "ok">>) {
  try {
    const detail = await fn();
    results.push({ probe: name, ok: true, ...detail });
  } catch (error) {
    results.push({
      probe: name,
      ok: false,
      detail: error instanceof Error ? error.stack || error.message : String(error),
    });
  }
}

async function main() {
  await probe("Ministry of Commerce GIS live connection", async () => {
    assert.equal(new URL(MC_GIS_ENDPOINT).hostname, "mc.gov.sa");
    const query: EntityQuery = { name: "كيان اختبار غير حقيقي", city: "الرياض" };
    const report = await runDueDiligence(query, [new SaudiCommerceGisConnector()], { timeoutMs: 25_000 });
    const source = report.sources.find((item) => item.key === "saudi_commerce_gis");
    assert.ok(source, "Commerce source summary missing");
    assert.notEqual(source.status, "FAILED", source.warnings.join(" | "));
    assert.equal(report.evidence.length, 0, "GIS aggregate context must never become entity evidence");
    assert.equal(report.risk.score, 0, "GIS aggregate context must never change risk score");
    return {
      detail: source.warnings.join(" | "),
      sourceStatus: source.status,
      evidence: report.evidence.length,
      needsReview: report.needsReview.length,
      rejected: report.rejected.length,
    };
  });

  await probe("CMA positive public-list lookup", async () => {
    assert.equal(new URL(CMA_INSTITUTIONS_URL).hostname, "cma.org.sa");
    const query: EntityQuery = { name: "شركة وزان النمو" };
    const report = await runDueDiligence(query, [new CmaCapitalMarketInstitutionsConnector()], { timeoutMs: 25_000 });
    const source = report.sources.find((item) => item.key === "cma_capital_market_institutions");
    assert.ok(source, "CMA source summary missing");
    assert.notEqual(source.status, "FAILED", source.warnings.join(" | "));
    assert.ok(
      report.needsReview.some((item) => item.sourceKey === "cma_capital_market_institutions"),
      "Known current CMA institution should be discovered as review-only evidence"
    );
    assert.equal(report.risk.score, 0, "Positive licence listing must not inflate adverse risk");
    return {
      detail: source.warnings.join(" | "),
      sourceStatus: source.status,
      evidence: report.evidence.length,
      needsReview: report.needsReview.length,
      rejected: report.rejected.length,
    };
  });

  await probe("CMA negative lookup does not fabricate evidence", async () => {
    const query: EntityQuery = { name: "شركة حكيم التجريبية غير الموجودة 92837465" };
    const report = await runDueDiligence(query, [new CmaCapitalMarketInstitutionsConnector()], { timeoutMs: 25_000 });
    const source = report.sources[0];
    assert.ok(source);
    assert.notEqual(source.status, "FAILED", source.warnings.join(" | "));
    assert.equal(report.evidence.length, 0);
    assert.equal(report.needsReview.length, 0);
    assert.equal(report.risk.score, 0);
    return {
      detail: source.warnings.join(" | "),
      sourceStatus: source.status,
      evidence: 0,
      needsReview: 0,
      rejected: report.rejected.length,
    };
  });

  await probe("SAMA positive unified-number lookup", async () => {
    assert.equal(new URL(SAMA_FINANCE_ENTITIES_URL).hostname, "sama.gov.sa");
    const query: EntityQuery = {
      name: "شركة آجل للخدمات التمويلية",
      unifiedNumber: "7001455307",
    };
    const report = await runDueDiligence(query, [new SamaFinanceEntitiesConnector()], { timeoutMs: 25_000 });
    const source = report.sources.find((item) => item.key === "sama_finance_entities");
    assert.ok(source, "SAMA source summary missing");
    assert.notEqual(source.status, "FAILED", source.warnings.join(" | "));
    const hits = [...report.evidence, ...report.needsReview].filter(
      (item) => item.sourceKey === "sama_finance_entities" && item.unifiedNumber === "7001455307"
    );
    assert.ok(hits.length >= 1, "Known current SAMA unified number was not discovered");
    assert.equal(report.risk.score, 0, "Positive licence listing must not inflate adverse risk");
    return {
      detail: `${hits[0]?.status ?? "NO_STATUS"}: ${hits[0]?.title ?? "no title"}; ${source.warnings.join(" | ")}`,
      sourceStatus: source.status,
      evidence: report.evidence.length,
      needsReview: report.needsReview.length,
      rejected: report.rejected.length,
    };
  });

  await probe("SAMA negative unified-number lookup does not fabricate evidence", async () => {
    const query: EntityQuery = {
      name: "شركة حكيم التجريبية غير الموجودة",
      unifiedNumber: "7999999999",
    };
    const report = await runDueDiligence(query, [new SamaFinanceEntitiesConnector()], { timeoutMs: 25_000 });
    const source = report.sources[0];
    assert.ok(source);
    assert.notEqual(source.status, "FAILED", source.warnings.join(" | "));
    assert.equal(report.evidence.length, 0);
    assert.equal(report.needsReview.length, 0);
    assert.equal(report.risk.score, 0);
    return {
      detail: source.warnings.join(" | "),
      sourceStatus: source.status,
      evidence: 0,
      needsReview: 0,
      rejected: report.rejected.length,
    };
  });

  console.log("\n=== Hakeem Due Diligence live integration audit ===");
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} | ${result.probe}`);
    console.log(`  ${result.detail}`);
    if (result.sourceStatus) {
      console.log(
        `  status=${result.sourceStatus} evidence=${result.evidence ?? 0} needsReview=${result.needsReview ?? 0} rejected=${result.rejected ?? 0}`
      );
    }
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} probes passed.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
