import assert from "node:assert/strict";
import {
  resolveObservation,
  runDueDiligence,
  type DataSourceDefinition,
  type EntityQuery,
  type RawObservation,
} from "../lib/modules/due-diligence/core";
import {
  buildConfiguredConnectors,
  dueDiligenceSourceCatalog,
  MC_GIS_ENDPOINT,
  SaudiCommerceGisConnector,
  StaticDueDiligenceConnector,
} from "../lib/modules/due-diligence/connectors";

const source: DataSourceDefinition = {
  key: "test_official",
  nameAr: "مصدر رسمي تجريبي",
  authority: "اختبار حكيم",
  accessType: "OPEN_DATA",
  status: "APPROVED",
  reliability: 1,
};

const query: EntityQuery = {
  name: "شركة المثال للتجارة المحدودة",
  unifiedNumber: "7001234567",
  commercialRegistration: "1010123456",
  city: "الرياض",
};

const now = new Date().toISOString();
const baseObservation: RawObservation = {
  sourceKey: source.key,
  sourceRecordId: "record-1",
  entityName: "شركة المثال للتجارة المحدودة",
  unifiedNumber: "7001234567",
  commercialRegistration: "1010123456",
  city: "الرياض",
  category: "bankruptcy",
  title: "واقعة منشورة للاختبار فقط",
  summary: "بيانات صناعية لا تمثل كيانًا حقيقيًا.",
  sourceUrl: "https://example.com/public-record/1",
  occurredAt: now,
  fetchedAt: now,
  raw: { fixture: true },
};

async function main() {
  const verified = resolveObservation(query, baseObservation);
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.confidence, 100);
  assert.equal(verified.sha256.length, 64);

  const conflict = resolveObservation(query, {
    ...baseObservation,
    sourceRecordId: "record-2",
    unifiedNumber: "7009999999",
    sourceUrl: "https://example.com/public-record/2",
  });
  assert.equal(conflict.status, "REJECTED");
  assert.ok(conflict.rejectionReasons.includes("تعارض الرقم الموحد"));

  const staticConnector = new StaticDueDiligenceConnector(source, [
    baseObservation,
    {
      ...baseObservation,
      sourceRecordId: "record-2",
      unifiedNumber: "7009999999",
      sourceUrl: "https://example.com/public-record/2",
    },
  ]);

  const report = await runDueDiligence(query, [staticConnector]);
  assert.equal(report.coverage.verifiedEvidence, 1);
  assert.equal(report.evidence.length, 1);
  assert.equal(report.rejected.length, 1);
  assert.equal(report.risk.level, "MODERATE");

  const configured = buildConfiguredConnectors({});
  assert.equal(configured.length, 1);
  assert.equal(configured[0]?.source.key, "saudi_commerce_gis");
  const catalogSource = dueDiligenceSourceCatalog().find((item) => item.key === "saudi_commerce_gis");
  assert.ok(catalogSource);
  assert.equal(catalogSource.authority, "وزارة التجارة");
  assert.ok(MC_GIS_ENDPOINT.includes("/ar/About/Statistics/_api/"));
  assert.ok(MC_GIS_ENDPOINT.includes("GetByTitle('GISInfo')"));

  let requestedUrl = "";
  const mockGet = async <T>(url: URL): Promise<T> => {
    requestedUrl = url.toString();
    return {
      value: [{ CityName: "الرياض", BusinessType: "Establishment", CRsCount: 123 }],
    } as T;
  };
  const gisConnector = new SaudiCommerceGisConnector(mockGet);
  const gisReport = await runDueDiligence(query, [gisConnector]);

  assert.ok(requestedUrl.startsWith(MC_GIS_ENDPOINT));
  assert.ok(requestedUrl.includes("%24filter="));
  assert.ok(requestedUrl.includes("%24top=200"));
  assert.equal(gisReport.evidence.length, 0);
  assert.equal(gisReport.risk.score, 0);
  const gis = gisReport.sources.find((item) => item.key === "saudi_commerce_gis");
  assert.ok(gis);
  assert.equal(gis.status, "WARNING");
  assert.ok(gis.warnings.some((warning) => warning.includes("لا تثبت تسجيل الكيان")));

  console.log("✓ due-diligence entity resolution");
  console.log("✓ conflicting identifiers are rejected");
  console.log("✓ source orchestration and risk scoring");
  console.log("✓ Ministry GISInfo endpoint and query contract");
  console.log("✓ official Ministry GIS data remains contextual-only");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
