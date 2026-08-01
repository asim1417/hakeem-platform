// اختبار محرك الامتثال (§15) — نواة نقيّة.
import { evaluateCompliance, isEffective, complianceRuleStats } from "../lib/modules/compliance/engine";
import type { ComplianceRule } from "../lib/modules/compliance/types";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

const now = "2026-08-01T00:00:00.000Z";

// جلسة مراجعة صالحة → لا انتهاكات حاجبة.
const ok = evaluateCompliance("review_session", { title: "مراجعة مذكّرة", entityType: "consultation" }, now);
assert(ok.passed, "جلسة صالحة تمرّ");
assert(ok.rulesEvaluated >= 2, "قواعد review_session تُقيَّم");

// عنوان مفقود + نوع خارج القائمة → انتهاكات.
const bad = evaluateCompliance("review_session", { title: "", entityType: "xyz" }, now);
assert(!bad.passed, "عنوان مفقود يكسر الامتثال (high)");
assert(bad.violations.some((v) => v.ruleId === "REVIEW-SESSION-TITLE-REQUIRED"), "انتهاك العنوان مُلتقَط");
assert(bad.violations.some((v) => v.ruleId === "REVIEW-SESSION-ENTITY-TYPE"), "انتهاك نوع الكيان مُلتقَط");

// السريان الزمنيّ.
const future: ComplianceRule = {
  ruleId: "X", title: "قاعدة مستقبلية", source: "demo", version: "1.0.0", approval: "demo",
  effectiveFrom: "2027-01-01T00:00:00.000Z", effectiveTo: null,
  scope: { subjectType: "case" }, severity: "low", validation: { kind: "required", field: "title" },
};
assert(!isEffective(future, now), "قاعدة مستقبلية غير سارية الآن");

// الإحصاء الحوكميّ: كل القواعد نموذجيّة (لا معتمدة بعد).
const stats = complianceRuleStats();
assert(stats.authoritative === 0 && stats.demo === stats.total, "كل القواعد نموذجيّة (غير معتمدة)");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nمحرك الامتثال: كل التحقّقات ناجحة.");
