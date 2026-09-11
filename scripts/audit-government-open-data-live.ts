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

async function diagnoseBaladyShape() {
  const response = await fetch("https://apiservices.balady.gov.sa/v1/momrah-services/open-data?items_per_page=5", {
    redirect: "error",
    headers: { accept: "application/json,text/plain;q=0.8", "user-agent": "HakeemDueDiligenceAudit/1.0 (+https://hakeemai.net)" },
  });
  const parsed = (await response.json()) as Record<string, unknown>;
  const data = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : undefined;
  const result = data?.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : undefined;
  const rows = Array.isArray(result?.rows) ? result?.rows : [];
  const first = rows[0] && typeof rows[0] === "object" ? (rows[0] as Record<string, unknown>) : undefined;
  const firstKeys = first ? Object.keys(first) : [];
  const firstTypes = first
    ? Object.entries(first)
        .slice(0, 20)
        .map(([key, value]) => `${key}:${Array.isArray(value) ? `array[${value.length}]` : typeof value}`)
        .join(",")
    : "none";
  console.log(
    `DIAG | Balady raw | status=${response.status} top=${Object.keys(parsed).join(",")} data=${data ? Object.keys(data).join(",") : "none"} result=${result ? Object.keys(result).join(",") : "none"} rows=${rows.length} firstKeys=${firstKeys.join(",")} firstTypes=${firstTypes}`
  );
}

async function main() {
  console.log("=== Saudi Government Open Data live audit ===");
  const registry = governmentOpenDataRegistry();
  assert.ok(registry.length >= 20);
  console.log(`PASS | Registry | ${registry.length} official/open-data entries catalogued`);

  const portal = await probeNationalPortal();
  console.log(`${portal.ok ? "PASS" : "INFO"} | National Open Data portal | status=${portal.status} ${portal.finalUrl || portal.error || ""}`);

  const sfda = new SfdaLicensedEstablishmentsConnector();
  const sfdaRaw = await sfda.collect({ name: "AL MADAR MEDICAL SERVICES COMPANY", commercialRegistration: "7001583587" });
  const sfdaMatch = sfdaRaw.observations.find((item) => item.commercialRegistration === "7001583587");
  assert.ok(sfdaMatch, "SFDA public licensed-establishments directory did not return known published CR 7001583587");
  console.log(`PASS | SFDA directory | observations=${sfdaRaw.observations.length} cr=${sfdaMatch?.commercialRegistration} license=${sfdaMatch?.sourceRecordId ?? "n/a"}`);

  const sfdaReport = await runDueDiligence({ name: "AL MADAR MEDICAL SERVICES COMPANY", commercialRegistration: "7001583587" }, [sfda]);
  assert.equal(sfdaReport.risk.score, 0);
  assert.equal(sfdaReport.rejected.length, 0);
  console.log(`PASS | SFDA resolution | accepted=${sfdaReport.evidence.length} review=${sfdaReport.needsReview.length} risk=${sfdaReport.risk.score}`);

  const cst = new CstIotEntitiesConnector();
  const cstRaw = await cst.collect({ name: "ZAIN" });
  assert.ok(cstRaw.observations.length >= 1);
  const cstReport = await runDueDiligence({ name: "ZAIN" }, [cst]);
  assert.equal(cstReport.evidence.length, 0);
  assert.equal(cstReport.needsReview.length, 1);
  assert.equal(cstReport.risk.score, 0);
  console.log(`PASS | CST IoT | review=${cstReport.needsReview.length} risk=${cstReport.risk.score}`);

  const balady = await fetchBaladyOpenDataCatalog({ limit: 5 });
  if (!balady.items.length) await diagnoseBaladyShape();
  assert.ok(balady.items.length > 0, "Balady official open-data API returned no catalog items");
  console.log(`PASS | Balady Open Data API | items=${balady.items.length}`);

  console.log("Summary: SFDA, CST and Balady live probes passed; national portal reachability is informational only.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
