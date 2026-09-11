import assert from "node:assert/strict";
import {
  compareDueDiligenceSnapshots,
  parseDueDiligenceSnapshotMeta,
  type DueDiligenceSnapshotMeta,
} from "../lib/modules/due-diligence/changes";

const previous: DueDiligenceSnapshotMeta = {
  kind: "due_diligence_snapshot",
  version: 2,
  generatedAt: "2026-09-10T10:00:00.000Z",
  query: { name: "شركة المثال", commercialRegistration: "1010123456" },
  risk: { score: 12, level: "LOW" },
  coverage: { configuredSources: 3, successfulSources: 3, verifiedEvidence: 1 },
  sources: [
    { key: "commerce", nameAr: "وزارة التجارة", status: "OK" },
    { key: "judgments", nameAr: "الأحكام المنشورة", status: "OK" },
    { key: "regulator", nameAr: "جهة تنظيمية", status: "OK" },
  ],
  evidence: [
    { sha256: "identity-old", sourceKey: "commerce", category: "identity", title: "هوية" },
    { sha256: "licence-old", sourceKey: "regulator", category: "regulatory_license_listing", title: "ترخيص" },
  ],
  needsReview: [
    { sha256: "judgment-old", sourceKey: "judgments", category: "published_judgment_mention", title: "حكم قديم" },
  ],
};

const current: DueDiligenceSnapshotMeta = {
  kind: "due_diligence_snapshot",
  version: 2,
  generatedAt: "2026-09-11T10:00:00.000Z",
  query: { name: "شركة المثال", commercialRegistration: "1010123456" },
  risk: { score: 20, level: "MODERATE" },
  coverage: { configuredSources: 3, successfulSources: 2, verifiedEvidence: 2 },
  sources: [
    { key: "commerce", nameAr: "وزارة التجارة", status: "OK" },
    { key: "judgments", nameAr: "الأحكام المنشورة", status: "OK" },
    { key: "regulator", nameAr: "جهة تنظيمية", status: "FAILED" },
  ],
  evidence: [
    { sha256: "identity-old", sourceKey: "commerce", category: "identity", title: "هوية" },
    { sha256: "identity-new", sourceKey: "commerce", category: "identity", title: "بيان جديد" },
  ],
  needsReview: [],
};

function main() {
  assert.equal(parseDueDiligenceSnapshotMeta(null), null);
  assert.equal(parseDueDiligenceSnapshotMeta({ kind: "other" }), null);
  assert.equal(parseDueDiligenceSnapshotMeta(current)?.query?.name, "شركة المثال");

  const baseline = compareDueDiligenceSnapshots(current, null);
  assert.equal(baseline.baseline, true);
  assert.equal(baseline.hasEntityChange, false);
  assert.equal(baseline.hasOperationalChange, false);

  const change = compareDueDiligenceSnapshots(current, previous);
  assert.equal(change.baseline, false);
  assert.equal(change.comparedToGeneratedAt, "2026-09-10T10:00:00.000Z");
  assert.equal(change.riskDelta, 8);
  assert.equal(change.addedEvidence.length, 1);
  assert.equal(change.addedEvidence[0]?.sha256, "identity-new");

  // The judgment source is healthy, so disappearance can be reported as no longer observed.
  assert.equal(change.noLongerObservedNeedsReview.length, 1);
  assert.equal(change.noLongerObservedNeedsReview[0]?.sha256, "judgment-old");

  // The regulator source failed. Its old licence must NOT be reported as removed.
  assert.equal(change.noLongerObservedEvidence.some((item) => item.sha256 === "licence-old"), false);
  const unavailable = change.unavailableSources.find((item) => item.key === "regulator");
  assert.ok(unavailable);
  assert.equal(unavailable.currentStatus, "FAILED");
  assert.equal(unavailable.suppressedEvidence.some((item) => item.sha256 === "licence-old"), true);

  assert.equal(change.hasEntityChange, true);
  assert.equal(change.hasOperationalChange, true);
  assert.equal(change.hasMaterialChange, true);

  const unchanged = compareDueDiligenceSnapshots(current, JSON.parse(JSON.stringify(current)));
  assert.equal(unchanged.riskDelta, 0);
  assert.equal(unchanged.addedEvidence.length, 0);
  assert.equal(unchanged.noLongerObservedEvidence.length, 0);
  assert.equal(unchanged.unavailableSources.length, 1, "A currently failed source remains operationally unavailable");
  assert.equal(unchanged.hasEntityChange, false);

  console.log("✓ first scan is treated as a baseline, not a change alert");
  console.log("✓ new evidence and real disappearance from healthy sources are detected");
  console.log("✓ evidence is never declared removed when its source is failed or missing");
  console.log("✓ entity changes are separated from source-health changes");
}

main();
