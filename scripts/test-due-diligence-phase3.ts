import assert from "node:assert/strict";
import {
  CMA_INSTITUTIONS_URL,
  CmaCapitalMarketInstitutionsConnector,
  htmlToSearchText,
} from "../lib/modules/due-diligence/cma";
import { runDueDiligence, type EntityQuery } from "../lib/modules/due-diligence/core";
import { phase3SourceCatalog } from "../lib/modules/due-diligence/phase3";
import {
  SAMA_FINANCE_ENTITIES_URL,
  SamaFinanceEntitiesConnector,
} from "../lib/modules/due-diligence/sama";

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

  const samaQuery: EntityQuery = {
    name: "شركة المثال المالية",
    unifiedNumber: "7001234567",
    city: "الرياض",
  };
  let samaRequested = "";
  const samaPositive = new SamaFinanceEntitiesConnector(async (url) => {
    samaRequested = url;
    return `<!doctype html><html lang="ar"><body>
      <div>شركات التمويل نوع النشاط التمويل الاستهلاكي الرقم الموحد 7001234567 رقم الترخيص 55/ أ ش / 202004 قم بزيارة موقع الشركة اسم الشركة شركة المثال المالية</div>
      <div>شركات التمويل نوع النشاط التمويل العقاري الرقم الموحد 7009999999 رقم الترخيص 99/ أ ش / 202699 اسم الشركة شركة أخرى</div>
    </body></html>`;
  });
  const samaPositiveReport = await runDueDiligence(samaQuery, [samaPositive]);
  assert.equal(samaRequested, SAMA_FINANCE_ENTITIES_URL);
  assert.equal(samaPositiveReport.evidence.length, 1);
  assert.equal(samaPositiveReport.evidence[0]?.status, "VERIFIED");
  assert.equal(samaPositiveReport.evidence[0]?.unifiedNumber, "7001234567");
  assert.equal(samaPositiveReport.evidence[0]?.category, "regulatory_license_listing");
  assert.equal(samaPositiveReport.risk.score, 0);

  const samaNegative = new SamaFinanceEntitiesConnector(async () =>
    '<html><body>اسم الشركة شركة أخرى الرقم الموحد 7009999999 رقم الترخيص 99/ أ ش / 202699</body></html>'
  );
  const samaNegativeReport = await runDueDiligence(samaQuery, [samaNegative]);
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
  assert.equal(cma.accessType, "PUBLIC_WEB");
  const sama = catalog.find((source) => source.key === "sama_finance_entities");
  assert.ok(sama);
  assert.equal(sama.authority, "البنك المركزي السعودي");
  assert.equal(sama.accessType, "PUBLIC_WEB");

  console.log("✓ CMA official list connector uses a fixed official URL");
  console.log("✓ positive CMA exact-name hits are review-only and do not inflate risk");
  console.log("✓ negative CMA lookup is never treated as proof of no licence");
  console.log("✓ SAMA unified-number match can verify a published finance licence without adding risk");
  console.log("✓ negative SAMA lookup is never treated as proof of no licence");
  console.log("✓ HTML normalization strips executable content and decodes entities");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
