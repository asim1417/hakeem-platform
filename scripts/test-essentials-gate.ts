/**
 * npx tsx scripts/test-essentials-gate.ts
 */
import assert from "node:assert/strict";
import { needsEssentials, type UserProfile } from "../lib/modules/onboarding/profile";

const base = {
  unknown: false,
  phone: null,
  entityType: null,
} as UserProfile;

assert.equal(needsEssentials({ name: "عاصم", email: "a@b.com" }, base), true);
assert.equal(
  needsEssentials(
    { name: "عاصم", email: "a@b.com" },
    { ...base, phone: "0500000000", entityType: "INDIVIDUAL" }
  ),
  false
);
assert.equal(
  needsEssentials({ name: "guest@hakeem.local", email: "guest@hakeem.local" }, base),
  false
);
assert.equal(needsEssentials({ name: "a@b.com", email: "a@b.com" }, { ...base, phone: "05", entityType: "OTHER" }), true);

console.log("test-essentials-gate: OK");
