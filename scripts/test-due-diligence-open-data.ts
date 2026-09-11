import assert from "node:assert/strict";
import { __baladyOpenDataTest } from "../lib/modules/due-diligence/balady-open-data";
import { runDueDiligence } from "../lib/modules/due-diligence/core";
import { CstIotEntitiesConnector } from "../lib/modules/due-diligence/cst";
import { extendedGovernmentOpenDataRegistry } from "../lib/modules/due-diligence/government-open-data-extended";
import { NcecQualifiedAgenciesConnector } from "../lib/modules/due-diligence/ncec";
import { SasoConformityBodiesConnector } from "../lib/modules/due-diligence/saso";
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
  const registry = extendedGovernmentOpenDataRegistry();
  assert.ok(registry.length >= 26);
  assert.ok(registry.some((item) => item.key === "national_open_data" && item.scope === "CATALOG"));
  assert.ok(registry.some((item) => item.key === "sfda_licensed_establishments" && item.scope === "ENTITY"));
  assert.ok(registry.some((item) => item.key === "saudi_commerce_gis" && item.scope === "CONTEXT"));
  assert.ok(registry.some((item) => item.key === "balady_open_data_api" && item.integration === "LIVE"));
  assert.ok(registry.some((item) => item.key === "saso_conformity_bodies" && item.integration === "LIVE"));
  assert.ok(registry.some((item) => item.key === "ncec_qualified_environmental_agencies" && item.integration === "LIVE"));
  assert.ok(registry.some((item) => item.key === "insurance_authority_licensed_companies" && item.integration === "ADAPTER"));
  assert.ok(registry.some((item) => item.key === "misa_open_data" && item.scope === "CONTEXT"));

  const liveBaladyShape = {
    statusDetails: { code: 200, message: "Ok" },
    data: {
      responseCode: "1",
      responseMessage: "success",
      result: {
        rows: [
          {
            nid: [{ value: "6231" }],
            title: [{ value: "نشاطات التفتيش الصحي 1439" }],
            field_year_g: [{ value: "2015" }],
            created: [{ value: "2020/01/02" }],
            changed: [{ value: "2021/10/26" }],
            field_opendata_category: [{ value: "التفتيش الصحي" }],
            field_file: [
              { uri: "https://example.gov.sa/report.xlsx", filename: "report.xlsx" },
              { uri: "https://example.gov.sa/report.csv", filename: "report.csv" },
            ],
          },
        ],
      },
    },
  };
  const baladyRows = __baladyOpenDataTest.collectObjects(liveBaladyShape);
  assert.equal(baladyRows.length, 1);
  const baladyItem = __baladyOpenDataTest.normalize(baladyRows[0]!);
  assert.equal(baladyItem.id, "6231");
  assert.equal(baladyItem.title, "نشاطات التفتيش الصحي 1439");
  assert.equal(baladyItem.year, "2015");
  assert.equal(baladyItem.category, "التفتيش الصحي");
  assert.ok(baladyItem.files?.some((item) => item.includes("report.xlsx")));

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

  const saso = new SasoConformityBodiesConnector(async () => `
    <table><tbody><tr><td>1234</td><td>شركة المختبرات السعودية</td><td>Saudi Arabia</td></tr></tbody></table>`);
  const sasoReport = await runDueDiligence({ name: "شركة المختبرات السعودية" }, [saso]);
  assert.equal(sasoReport.evidence.length, 0);
  assert.equal(sasoReport.needsReview.length, 1);
  assert.equal(sasoReport.risk.score, 0);

  const ncec = new NcecQualifiedAgenciesConnector(async () => `
    <table><tbody><tr><td>شركة البيئة الخضراء</td><td>خدمات استشارات بيئية</td><td>فئة أ</td><td>الرياض</td></tr></tbody></table>`);
  const ncecReport = await runDueDiligence({ name: "شركة البيئة الخضراء" }, [ncec]);
  assert.equal(ncecReport.evidence.length, 0);
  assert.equal(ncecReport.needsReview.length, 1);
  assert.equal(ncecReport.risk.score, 0);

  console.log("✓ extended government registry separates ENTITY, CONTEXT and CATALOG sources");
  console.log("✓ Balady live Drupal field-array response normalizes correctly");
  console.log("✓ SFDA official public directory verifies by name + CR and rejects CR conflicts");
  console.log("✓ positive licence listings never create adverse risk by themselves");
  console.log("✓ CST, SASO and NCEC name-only discovery stays NEEDS_REVIEW and never raises risk");
}

main();
