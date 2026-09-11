import assert from "node:assert/strict";
import { runDueDiligence } from "../lib/modules/due-diligence/core";
import { CstIotEntitiesConnector } from "../lib/modules/due-diligence/cst";
import { governmentOpenDataRegistry } from "../lib/modules/due-diligence/government-open-data";
import { SfdaLicensedEstablishmentsConnector } from "../lib/modules/due-diligence/sfda";

const SFDA_ROW = `
<table><tbody><tr>
<td>شركة المثال للدواء</td>
<td>1010123456</td>
<td>Local Manufacturer</td>
<td>Drug</td>
<td>LIC-42</td>
<td>Details</td>
</tr></tbody></table>`;

async function main() {
  const registry = governmentOpenDataRegistry();
  assert.ok(registry.length >= 10);
  assert.ok(registry.some((item) => item.key === "national_open_data" && item.scope === "CATALOG"));
  assert.ok(registry.some((item) => item.key === "sfda_licensed_establishments" && item.scope === "ENTITY"));
  assert.ok(registry.some((item) => item.key === "saudi_commerce_gis" && item.scope === "CONTEXT"));

  const sfdaGet = async (url: URL) => {
    assert.equal(url.hostname, "sfda.gov.sa");
    assert.equal(url.searchParams.get("crNumber"), "1010123456");
    return SFDA_ROW;
  };
  const sfda = new SfdaLicensedEstablishmentsConnector(sfdaGet);
  const sfdaReport = await runDueDiligence(
    { name: "شركة المثال للدواء", commercialRegistration: "1010123456" },
    [sfda]
  );
  assert.equal(sfdaReport.evidence.length, 1);
  assert.equal(sfdaReport.evidence[0]?.status, "VERIFIED");
  assert.equal(sfdaReport.evidence[0]?.commercialRegistration, "1010123456");
  assert.equal(sfdaReport.risk.score, 0, "positive licence listing must not raise adverse risk");

  const sfdaConflict = new SfdaLicensedEstablishmentsConnector(async () => SFDA_ROW);
  const conflictReport = await runDueDiligence(
    { name: "شركة المثال للدواء", commercialRegistration: "9999999999" },
    [sfdaConflict]
  );
  assert.equal(conflictReport.evidence.length, 0);
  assert.equal(conflictReport.rejected.length, 1);
  assert.ok(conflictReport.rejected[0]?.rejectionReasons.some((reason) => reason.includes("السجل التجاري")));

  const cst = new CstIotEntitiesConnector(async () => '<html><body><h3>شركة إنترنت الأشياء المتقدمة</h3><p>IoT Platform</p></body></html>');
  const cstReport = await runDueDiligence({ name: "شركة إنترنت الأشياء المتقدمة" }, [cst]);
  assert.equal(cstReport.evidence.length, 0);
  assert.equal(cstReport.needsReview.length, 1);
  assert.equal(cstReport.needsReview[0]?.sourceKey, "cst_iot_entities");
  assert.equal(cstReport.risk.score, 0);

  const cstNegative = await runDueDiligence({ name: "شركة غير موجودة إطلاقا" }, [cst]);
  assert.equal(cstNegative.evidence.length, 0);
  assert.equal(cstNegative.needsReview.length, 0);

  console.log("✓ government open-data registry separates ENTITY, CONTEXT and CATALOG sources");
  console.log("✓ SFDA official public directory verifies by name + CR and rejects CR conflicts");
  console.log("✓ positive licence listings never create adverse risk by themselves");
  console.log("✓ CST IoT name-only discovery stays NEEDS_REVIEW and negative lookup fabricates nothing");
}

main();
