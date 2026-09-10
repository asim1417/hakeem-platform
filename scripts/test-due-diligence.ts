import assert from "node:assert/strict";
import {
  resolveObservation,
  runDueDiligence,
  type DataSourceDefinition,
  type EntityQuery,
  type RawObservation,
} from "../lib/modules/due-diligence/core";
import { StaticDueDiligenceConnector } from "../lib/modules/due-diligence/connectors";

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

  const connector = new StaticDueDiligenceConnector(source, [baseObservation, {
    ...baseObservation,
    sourceRecordId: "record-2",
    unifiedNumber: "7009999999",
    sourceUrl: "https://example.com/public-record/2",
  }]);

  const report = await runDueDiligence(query, [connector]);
  assert.equal(report.coverage.configuredSources, 1);
  assert.equal(report.coverage.successfulSources, 1);
  assert.equal(report.coverage.verifiedEvidence, 1);
  assert.equal(report.evidence.length, 1);
  assert.equal(report.rejected.length, 1);
  assert.equal(report.risk.level, "MODERATE");
  assert.ok(report.risk.score > 0);

  console.log("✓ due-diligence entity resolution");
  console.log("✓ conflicting identifiers are rejected");
  console.log("✓ source orchestration and risk scoring");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
