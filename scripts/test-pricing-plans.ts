/**
 * اختبار كتالوج الخطط — بلا شبكة.
 * التشغيل: npx tsx scripts/test-pricing-plans.ts
 */
import assert from "node:assert/strict";
import { getPlans, PRICING, formatSar, getPlan, isCheckoutLive } from "../config/pricing";

assert.ok(PRICING.freeQuota >= 0);
const plans = getPlans();
assert.ok(plans.length >= 3);
assert.equal(getPlan("free")?.monthlySar, null);
assert.ok((getPlan("pro")?.monthlySar ?? 0) > 0);
assert.equal(formatSar(null), "مجاني");
assert.ok(formatSar(149).includes("149") || formatSar(149).includes("١٤٩"));
assert.equal(isCheckoutLive(), false);
assert.ok(plans.every((p) => p.features.length >= 3));

console.log("test-pricing-plans: OK");
