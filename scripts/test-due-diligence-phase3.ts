import assert from "node:assert/strict";
import {
  CMA_OPEN_DATA_API_URL,
  htmlToSearchText,
} from "../lib/modules/due-diligence/cma";
import { runDueDiligence, type EntityQuery } from "../lib/modules/due-diligence/core";
import { buildPhase3Connectors, phase3SourceCatalog } from "../lib/modules/due-diligence/phase3";
import {
  SAMA_FINANCE_ENTITIES_URL,
  SamaFinanceEntitiesConnector,
} from "../lib/modules/due-diligence/sama";

const query: EntityQuery = {
  name: "شركة المثال المالية",
  commercialRegistration: "1010123456",
  unifiedNumber: "7001234567",
  city: "الرياض",
};

async function main() {
  const decoded = htmlToSearchText(
    '<html><style>.x{}</style><script>ignore()</script><body>شركة&nbsp;المثال المالية &amp; شركاؤها</body></html>'
  );
  assert.equal(decoded, "شركة المثال المالية & شركاؤها");

  let samaRequested = "";
  const samaPositive = new SamaFinanceEntitiesConnector(async (url) => {
    samaRequested = url;
    return `<!doctype html><html lang="ar"><body>
      <ul><li>شركة النايفات للتمويل</li><li>شركة المثال المالية</li><li>شركة أخرى للتمويل</li></ul>
    </body></html>`;
  });
  const samaPositiveReport = await runDueDiligence(query, [samaPositive]);
  assert.equal(samaRequested, SAMA_FINANCE_ENTITIES_URL);
  assert.equal(samaPositiveReport.evidence.length, 0);
  assert.equal(samaPositiveReport.needsReview.length, 1);
  assert.equal(samaPositiveReport.needsReview[0]?.status, "NEEDS_REVIEW");
  assert.equal(samaPositiveReport.needsReview[0]?.category, "regulatory_license_listing");
  assert.equal(samaPositiveReport.needsReview[0]?.unifiedNumber, undefined);
  assert.equal(samaPositiveReport.risk.score, 0);
  assert.ok(
    samaPositiveReport.sources[0]?.warnings.some((warning) => warning.includes("لم يُستخدم الرقم"))
  );

  const samaNegative = new SamaFinanceEntitiesConnector(async () =>
    '<html><body><ul><li>شركة أخرى للتمويل</li></ul></body></html>'
  );
  const samaNegativeReport = await runDueDiligence(query, [samaNegative]);
  assert.equal(samaNegativeReport.evidence.length, 0);
  assert.equal(samaNegativeReport.needsReview.length, 0);
  assert.equal(samaNegativeReport.risk.score, 0);
  assert.ok(
    samaNegativeReport.sources[0]?.warnings.some((warning) => warning.includes("لا تُفسر النتيجة كنفي للترخيص"))
  );

  const catalog = phase3SourceCatalog();
  const cma = catalog.find((source) => source.key === "cma_capital_market_institutions");
  assert.ok(cma);
  assert.equal(cma.authority, "هيئة السوق المالية");
  assert.equal(cma.accessType, "OFFICIAL_API");
  assert.equal(cma.status, "REVIEW_REQUIRED");
  assert.equal(new URL(CMA_OPEN_DATA_API_URL).hostname, "opendataapi.cma.gov.sa");

  const liveKeys = new Set(buildPhase3Connectors().map((connector) => connector.source.key));
  assert.equal(liveKeys.has("cma_capital_market_institutions"), false);
  assert.equal(liveKeys.has("sama_finance_entities"), true);

  const sama = catalog.find((source) => source.key === "sama_finance_entities");
  assert.ok(sama);
  assert.equal(sama.authority, "البنك المركزي السعودي");
  assert.equal(sama.accessType, "PUBLIC_WEB");
  assert.equal(sama.status, "APPROVED");

  console.log("✓ CMA official API remains catalogued but is not falsely instantiated as healthy");
  console.log("✓ SAMA stable server-rendered directory is the active finance-list source");
  console.log("✓ positive SAMA name hits remain review-only and cannot inflate adverse risk");
  console.log("✓ user-supplied unified number is not borrowed as though SAMA published it");
  console.log("✓ negative SAMA lookup is never treated as proof of no licence");
  console.log("✓ HTML normalization strips executable content and decodes entities");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
