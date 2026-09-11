import assert from "node:assert/strict";
import { fetchBaladyOpenDataCatalog } from "../lib/modules/due-diligence/balady-open-data";
import { runDueDiligence } from "../lib/modules/due-diligence/core";
import { CstIotEntitiesConnector } from "../lib/modules/due-diligence/cst";
import { governmentOpenDataRegistry } from "../lib/modules/due-diligence/government-open-data";
import { SfdaLicensedEstablishmentsConnector } from "../lib/modules/due-diligence/sfda";

async function probeNationalPortal() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://open.data.gov.sa/ar/home", {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "HakeemDueDiligenceAudit/1.0 (+https://hakeemai.net)" },
    });
    return { ok: response.ok, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: "", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function describeValue(value: unknown, depth = 0): string {
  if (depth > 3) return "…";
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const first = value[0];
    return `[${value.length}]${first === undefined ? "" : ` first=${describeValue(first, depth + 1)}`}`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.entries(object)
      .slice(0, 12)
      .map(([key, child]) => `${key}:${describeValue(child, depth + 1)}`)
      .join(",")}}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
    return looksJson ? `string-json(len=${value.length},head=${JSON.stringify(trimmed.slice(0, 180))})` : `string(len=${value.length})`;
  }
  return typeof value;
}

async function diagnoseBaladyShape() {
  const response = await fetch("https://apiservices.balady.gov.sa/v1/momrah-services/open-data?items_per_page=5", {
    redirect: "error",
    headers: { accept: "application/json,text/plain;q=0.8", "user-agent": "HakeemDueDiligenceAudit/1.0 (+https://hakeemai.net)" },
  });
  const text = await response.text();
  let shape = `non-json len=${text.length}`;
  try {
    shape = describeValue(JSON.parse(text));
  } catch {
    // Keep non-JSON diagnostic without dumping the response body.
  }
  console.log(`DIAG | Balady raw | status=${response.status} content-type=${response.headers.get("content-type") ?? "n/a"} len=${text.length} shape=${shape}`);
}

async function main() {
  console.log("=== Saudi Government Open Data live audit ===");

  const registry = governmentOpenDataRegistry();
  assert.ok(registry.length >= 20);
  assert.ok(registry.some((item) => item.key === "national_open_data"));
  console.log(`PASS | Registry | ${registry.length} official/open-data entries catalogued`);

  const portal = await probeNationalPortal();
  console.log(`${portal.ok ? "PASS" : "INFO"} | National Open Data portal | status=${portal.status} ${portal.finalUrl || portal.error || ""}`);

  const sfda = new SfdaLicensedEstablishmentsConnector();
  const sfdaRaw = await sfda.collect({ name: "AL MADAR MEDICAL SERVICES COMPANY", commercialRegistration: "7001583587" });
  const sfdaMatch = sfdaRaw.observations.find((item) => item.commercialRegistration === "7001583587");
  assert.ok(sfdaMatch, "SFDA public licensed-establishments directory did not return known published CR 7001583587");
  console.log(`PASS | SFDA directory | observations=${sfdaRaw.observations.length} cr=${sfdaMatch?.commercialRegistration} license=${sfdaMatch?.sourceRecordId ?? "n/a"}`);

  const sfdaReport = await runDueDiligence(
    { name: "AL MADAR MEDICAL SERVICES COMPANY", commercialRegistration: "7001583587" },
    [sfda]
  );
  assert.equal(sfdaReport.risk.score, 0, "positive SFDA licence listing must not be adverse risk");
  assert.equal(sfdaReport.rejected.length, 0, "known SFDA CR must not be rejected");
  console.log(`PASS | SFDA resolution | accepted=${sfdaReport.evidence.length} review=${sfdaReport.needsReview.length} risk=${sfdaReport.risk.score}`);

  const cst = new CstIotEntitiesConnector();
  const cstRaw = await cst.collect({ name: "ZAIN" });
  assert.ok(cstRaw.observations.length >= 1, "CST IoT public page no longer exposes known provider ZAIN");
  const cstReport = await runDueDiligence({ name: "ZAIN" }, [cst]);
  assert.equal(cstReport.evidence.length, 0, "name-only CST discovery must not be accepted evidence");
  assert.equal(cstReport.needsReview.length, 1, "name-only CST discovery must stay review-only");
  assert.equal(cstReport.risk.score, 0);
  console.log(`PASS | CST IoT | review=${cstReport.needsReview.length} risk=${cstReport.risk.score}`);

  const balady = await fetchBaladyOpenDataCatalog({ limit: 5 });
  assert.ok(Array.isArray(balady.items), "Balady open-data catalog response was not normalized");
  if (!balady.items.length) await diagnoseBaladyShape();
  assert.ok(balady.items.length > 0, "Balady official open-data API returned no catalog items");
  console.log(`PASS | Balady Open Data API | items=${balady.items.length}`);

  console.log("Summary: SFDA, CST and Balady live probes passed; national portal reachability is informational only.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
