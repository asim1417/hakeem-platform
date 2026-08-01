// اختبار شرائح المواءمة غير الكاسرة (§14/§15/§18) — نواة نقيّة.
import {
  SIMULATION_WORKFLOW,
  BLUEPRINT_WORKFLOW,
  validateAdvance,
} from "../lib/modules/workflow/state-machine";
import { canApproveRule, complianceRuleStats } from "../lib/modules/compliance/engine";
import type { ComplianceRule } from "../lib/modules/compliance/types";
import { WORKSPACES, getWorkspace } from "../lib/modules/workspaces/registry";

let failures = 0;
function assert(c: boolean, m: string) { if (!c) { failures++; console.error("✗", m); } else console.log("✓", m); }

// §14 validateAdvance
const okAdv = validateAdvance(SIMULATION_WORKFLOW, "CLAIM_FILING", "INITIAL_ADMISSIBILITY");
assert(okAdv.allowed, "§14 انتقال متتابع مسموح");
const badAdv = validateAdvance(SIMULATION_WORKFLOW, "CLAIM_FILING", "OBJECTION");
assert(!badAdv.allowed, "§14 قفزة غير معرّفة مرفوضة");
const gate = validateAdvance(BLUEPRINT_WORKFLOW, "Revision", "Review");
assert(gate.allowed && gate.gates.includes("revision-addressed"), "§14 بوابة الدخول مُعادة");

// §15 حارس الاعتماد
const demo: ComplianceRule = {
  ruleId: "R1", title: "t", source: "demo", version: "1.0.0", approval: "demo",
  effectiveFrom: null, effectiveTo: null, scope: { subjectType: "case" },
  severity: "low", validation: { kind: "required", field: "title" },
};
assert(canApproveRule(demo).ok, "§15 القاعدة النموذجيّة مسموح إبقاؤها");
const fakeAuth: ComplianceRule = { ...demo, approval: "authoritative" };
assert(!canApproveRule(fakeAuth).ok, "§15 قاعدة معتمدة بلا أساس مرفوضة (§76)");
const groundedAuth: ComplianceRule = { ...fakeAuth, basis: { system: "نظام المرافعات", articleNumber: 1 } };
assert(canApproveRule(groundedAuth).ok, "§15 قاعدة معتمدة بأساس نظاميّ مقبولة");
assert(complianceRuleStats().grounded === 0, "§15 لا قواعد مربوطة بأساس بعد (لا اختلاق)");

// §18 مساحات العمل
assert(WORKSPACES.length === 8, "§18 ثماني مساحات عمل");
assert(getWorkspace("review")?.permission === "REVIEW_USE", "§18 مساحة المراجعة تحمل صلاحيتها");
assert(getWorkspace("zzz" as never) === null, "§18 مساحة مجهولة → null");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nشرائح المواءمة: كل التحقّقات ناجحة.");
