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
import { SaudiBankruptcyConnector } from "../lib/modules/due-diligence/bankruptcy";
import { buildDemoConnectors } from "../lib/modules/due-diligence/demo";

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

  const ipCatalog = dueDiligenceSourceCatalog().find((item) => item.key === "saudi_ip");
  assert.ok(ipCatalog);
  assert.equal(ipCatalog.accessType, "AUTHORIZED");
  assert.equal(ipCatalog.baseUrl, "https://www.saip.gov.sa");

  let requestedUrl = "";
  const mockGet = async (url: URL) => {
    requestedUrl = url.toString();
    return {
      value: [{ CityName: "الرياض", BusinessType: "Establishment", CRsCount: 123 }],
    };
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

  let bankruptcyAdapterUrl = "";
  let bankruptcyRequestCr = "";
  const bankruptcyConnector = new SaudiBankruptcyConnector(
    "https://adapter.example.com/bankruptcy",
    "fixture-token",
    async (endpoint, body) => {
      bankruptcyAdapterUrl = endpoint.toString();
      bankruptcyRequestCr = body.commercialRegistration ?? "";
      return {
        checkedAt: now,
        records: [
          {
            id: "fixture-bankruptcy-1",
            debtorName: "شركة المثال للتجارة المحدودة",
            commercialRegistration: "1010123456",
            procedureType: "إعادة التنظيم المالي",
            title: "واقعة إفلاس رسمية للاختبار فقط",
            sourceUrl:
              "https://bankruptcy.gov.sa/ar/Other/BankruptcyRecord/Pages/recordDetails.aspx?recordid=fixture-1",
            documentDate: now,
          },
          {
            id: "fixture-bankruptcy-conflict",
            debtorName: "شركة المثال للتجارة المحدودة",
            commercialRegistration: "1010999999",
            procedureType: "التصفية",
            sourceUrl:
              "https://bankruptcy.gov.sa/ar/Announcements/Pages/announcementDetails.aspx?AdID=fixture-2",
            documentDate: now,
          },
          {
            id: "fixture-external-link",
            debtorName: "شركة المثال للتجارة المحدودة",
            commercialRegistration: "1010123456",
            sourceUrl: "https://example.com/not-official-evidence",
          },
        ],
      };
    }
  );

  const bankruptcyReport = await runDueDiligence(query, [bankruptcyConnector]);
  assert.equal(bankruptcyAdapterUrl, "https://adapter.example.com/bankruptcy");
  assert.equal(bankruptcyRequestCr, "1010123456");
  assert.equal(bankruptcyReport.evidence.length, 1);
  assert.equal(bankruptcyReport.evidence[0]?.category, "bankruptcy");
  assert.equal(bankruptcyReport.evidence[0]?.status, "VERIFIED");
  assert.equal(bankruptcyReport.rejected.length, 1);
  assert.ok(bankruptcyReport.rejected[0]?.rejectionReasons.includes("تعارض السجل التجاري"));
  assert.equal(bankruptcyReport.risk.level, "MODERATE");
  assert.ok(bankruptcyReport.risk.score > 0);
  const bankruptcySource = bankruptcyReport.sources.find((item) => item.key === "saudi_bankruptcy");
  assert.ok(bankruptcySource);
  assert.ok(bankruptcySource.warnings.some((warning) => warning.includes("رابط الإثبات")));

  const configuredWithBankruptcy = buildConfiguredConnectors({
    DUE_DILIGENCE_BANKRUPTCY_ADAPTER_URL: "https://adapter.example.com/bankruptcy",
    DUE_DILIGENCE_BANKRUPTCY_ADAPTER_TOKEN: "fixture-token",
  });
  assert.equal(configuredWithBankruptcy.length, 2);
  assert.equal(configuredWithBankruptcy[1]?.source.key, "saudi_bankruptcy");
  assert.equal(configuredWithBankruptcy[1]?.source.accessType, "AUTHORIZED");
  const bankruptcyCatalog = dueDiligenceSourceCatalog().find((item) => item.key === "saudi_bankruptcy");
  assert.ok(bankruptcyCatalog);
  assert.equal(bankruptcyCatalog.authority, "لجنة الإفلاس — إيسار");

  const demoReport = await runDueDiligence(query, buildDemoConnectors(query));
  assert.equal(demoReport.coverage.configuredSources, 4);
  assert.ok(demoReport.evidence.some((item) => item.category === "trademark"));
  assert.ok(demoReport.evidence.some((item) => item.category === "bankruptcy"));
  assert.ok(demoReport.evidence.some((item) => item.category === "license_issue"));
  assert.equal(demoReport.rejected.length, 1);
  assert.ok(demoReport.risk.score >= 25);
  assert.ok(demoReport.risk.factors.some((factor) => factor.key === "bankruptcy"));

  console.log("✓ due-diligence entity resolution");
  console.log("✓ conflicting identifiers are rejected");
  console.log("✓ source orchestration and risk scoring");
  console.log("✓ Ministry GISInfo endpoint and query contract");
  console.log("✓ official Ministry GIS data remains contextual-only");
  console.log("✓ SAIP source is authorized, not falsely presented as a public API");
  console.log("✓ Saudi bankruptcy adapter accepts only official Commission evidence URLs");
  console.log("✓ bankruptcy CR conflicts are rejected and excluded from risk scoring");
  console.log("✓ demo pipeline covers identity, IP, bankruptcy, licensing and rejected conflicts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
