import assert from "node:assert/strict";
import {
  CMA_INSTITUTIONS_URL,
  CmaCapitalMarketInstitutionsConnector,
  htmlToSearchText,
} from "../lib/modules/due-diligence/cma";
import { runDueDiligence, type EntityQuery } from "../lib/modules/due-diligence/core";
import { phase3SourceCatalog } from "../lib/modules/due-diligence/phase3";

const query: EntityQuery = {
  name: "شركة المثال المالية",
  commercialRegistration: "1010123456",
  city: "الرياض",
};

async function main() {
  const decoded = htmlToSearchText(
    '<html><style>.x{}</style><script>ignore()</script><body>شركة&nbsp;المثال المالية &amp; شركاؤها</body></html>'
  );
  assert.equal(decoded, "شركة المثال المالية & شركاؤها");

  let requested = "";
  const positive = new CmaCapitalMarketInstitutionsConnector(async (url) => {
    requested = url;
    return `<!doctype html><html lang="ar"><body><h3>شركة المثال المالية</h3><p>تقديم المشورة</p></body></html>`;
  });
  const positiveReport = await runDueDiligence(query, [positive]);
  assert.equal(requested, CMA_INSTITUTIONS_URL);
  assert.equal(positiveReport.needsReview.length, 1);
  assert.equal(positiveReport.needsReview[0]?.category, "regulatory_license_listing");
  assert.equal(positiveReport.risk.score, 0);
  assert.equal(positiveReport.evidence.length, 0);

  const negative = new CmaCapitalMarketInstitutionsConnector(async () =>
    '<html><body><h3>شركة أخرى للاستثمار</h3></body></html>'
  );
  const negativeReport = await runDueDiligence(query, [negative]);
  assert.equal(negativeReport.evidence.length, 0);
  assert.equal(negativeReport.needsReview.length, 0);
  assert.equal(negativeReport.risk.score, 0);
  assert.ok(
    negativeReport.sources[0]?.warnings.some((warning) => warning.includes("لا تُفسر النتيجة كنفي للترخيص"))
  );

  const catalog = phase3SourceCatalog();
  const cma = catalog.find((source) => source.key === "cma_capital_market_institutions");
  assert.ok(cma);
  assert.equal(cma.authority, "هيئة السوق المالية");
  assert.equal(cma.accessType, "PUBLIC_WEB");

  console.log("✓ CMA official list connector uses a fixed official URL");
  console.log("✓ positive exact-name hits are review-only and do not inflate risk");
  console.log("✓ negative CMA lookup is never treated as proof of no licence");
  console.log("✓ HTML normalization strips executable content and decodes entities");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
