import assert from "node:assert/strict";
import {
  compareDueDiligenceSnapshots,
  parseDueDiligenceSnapshotMeta,
  type DueDiligenceSnapshotMeta,
} from "../lib/modules/due-diligence/changes";

const previous: DueDiligenceSnapshotMeta = {
  kind: "due_diligence_snapshot",
  version: 1,
  query: { name: "شركة المثال", commercialRegistration: "1010123456" },
  risk: { score: 12, level: "LOW" },
  coverage: { configuredSources: 5, successfulSources: 4, verifiedEvidence: 1 },
  sources: [
    { key: "commerce", nameAr: "وزارة التجارة", status: "OK" },
    { key: "judgments", nameAr: "الأحكام المنشورة", status: "OK" },
  ],
  evidence: [
    { sha256: "old-evidence", sourceKey: "commerce", category: "identity", title: "هوية" },
  ],
  needsReview: [
    { sha256: "review-old", sourceKey: "judgments", category: "published_judgment_mention", title: "حكم قديم" },
  ],
};

const current: DueDiligenceSnapshotMeta = {
  kind: "due_diligence_snapshot",
  version: 1,
  query: { name: "شركة المثال", commercialRegistration: "1010123456" },
  risk: { score: 20, level: "MODERATE" },
  coverage: { configuredSources: 6, successfulSources: 5, verifiedEvidence: 2 },
  sources: [
    { key: "commerce", nameAr: "وزارة التجارة", status: "OK" },
    { key: "judgments", nameAr: "الأحكام المنشورة", status: "WARNING" },
    { key: "sama", nameAr: "البنك المركزي", status: "OK" },
  ],
  evidence: [
    { sha256: "old-evidence", sourceKey: "commerce", category: "identity", title: "هوية" },
    { sha256: "new-evidence", sourceKey: "sama", category: "regulatory_license_listing", title: "ترخيص" },
  ],
  needsReview: [
    { sha256: "review-new", sourceKey: "judgments", category: "published_judgment_mention", title: "حكم جديد" },
  ],
};

function main() {
  assert.equal(parseDueDiligenceSnapshotMeta(null), null);
  assert.equal(parseDueDiligenceSnapshotMeta({ kind: "other" }), null);
  assert.equal(parseDueDiligenceSnapshotMeta(current)?.query?.name, "شركة المثال");

  const baseline = compareDueDiligenceSnapshots(current, null);
  assert.equal(baseline.baseline, true);
  assert.equal(baseline.hasMaterialChange, false);
  assert.equal(baseline.currentRisk, 20);

  const change = compareDueDiligenceSnapshots(current, previous);
  assert.equal(change.baseline, false);
  assert.equal(change.riskDelta, 8);
  assert.equal(change.successfulSourcesDelta, 1);
  assert.equal(change.verifiedEvidenceDelta, 1);
  assert.equal(change.addedEvidence.length, 1);
  assert.equal(change.addedEvidence[0]?.sha256, "new-evidence");
  assert.equal(change.noLongerObservedEvidence.length, 0);
  assert.equal(change.addedNeedsReview.length, 1);
  assert.equal(change.noLongerObservedNeedsReview.length, 1);
  assert.equal(change.sourceStatusChanges.length, 2);
  assert.ok(change.sourceStatusChanges.some((item) => item.key === "judgments" && item.from === "OK" && item.to === "WARNING"));
  assert.ok(change.sourceStatusChanges.some((item) => item.key === "sama" && item.from === null && item.to === "OK"));
  assert.equal(change.hasMaterialChange, true);

  const unchanged = compareDueDiligenceSnapshots(current, JSON.parse(JSON.stringify(current)));
  assert.equal(unchanged.riskDelta, 0);
  assert.equal(unchanged.addedEvidence.length, 0);
  assert.equal(unchanged.sourceStatusChanges.length, 0);
  assert.equal(unchanged.hasMaterialChange, false);

  console.log("✓ snapshot metadata parser rejects unrelated audit records");
  console.log("✓ baseline scan is separated from change claims");
  console.log("✓ risk, evidence, review queue and source-status deltas are detected");
  console.log("✓ identical scans do not produce false change alerts");
}

main();
