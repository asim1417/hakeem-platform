import assert from "node:assert/strict";
import { SaudiCommerceGisConnector } from "../lib/modules/due-diligence/connectors";

async function main() {
  const connector = new SaudiCommerceGisConnector();
  const result = await connector.collect({
    name: "اختبار اتصال حكيم",
    city: "الرياض",
  });

  assert.equal(result.source.key, "saudi_commerce_gis");
  assert.equal(result.observations.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("اتصال وزارة التجارة ناجح")));
  assert.ok(result.warnings.some((warning) => warning.includes("لا تثبت تسجيل الكيان")));

  console.log("MC_GIS_PRODUCTION_CONNECTOR=success");
  console.log(result.warnings[0]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
