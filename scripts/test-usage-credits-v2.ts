import assert from "node:assert/strict";
import {
  DEFAULT_USAGE_PRICES,
  USAGE_REWARDS,
  calculateUsageCost,
  milliUnitsToUnits,
} from "../config/usage-credits";

assert.equal(
  milliUnitsToUnits(
    USAGE_REWARDS.verified_contact +
      USAGE_REWARDS.profile_completed +
      USAGE_REWARDS.first_document_indexed
  ),
  100
);
assert.equal(milliUnitsToUnits(USAGE_REWARDS.referral_invitee_qualified), 25);
assert.equal(milliUnitsToUnits(USAGE_REWARDS.referral_inviter_qualified), 50);
assert.equal(milliUnitsToUnits(USAGE_REWARDS.referral_inviter_first_purchase), 100);
assert.equal(calculateUsageCost("OCR_PAGE", 1), 250);
assert.equal(calculateUsageCost("OCR_COMPLEX_TABLE", 1), 500);
assert.equal(calculateUsageCost("INDEX_TOKENS", 1_001), 200);
assert.equal(calculateUsageCost("HYBRID_SEARCH", 1), 250);
assert.equal(calculateUsageCost("RERANK", 1), 250);
assert.equal(DEFAULT_USAGE_PRICES.ASK_HAKEEM.unitSize, 1_000);

console.log("test-usage-credits-v2: OK");
