// سجلّ قواعد الامتثال (§15). كلّها الآن «نموذجيّة غير معتمدة» (approval: "demo")
// حتى تُربط بأساسٍ رسميّ. استبدالها بقواعد معتمدة قرارٌ قانونيّ خارج نطاق الهندسة.

import type { ComplianceRule } from "./types";

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // ── مركز المراجعة: كل جلسة تحتاج عنوانًا ونوع كيان. ──
  {
    ruleId: "REVIEW-SESSION-TITLE-REQUIRED",
    title: "عنوان جلسة المراجعة إلزاميّ",
    source: "demo",
    version: "1.0.0",
    approval: "demo",
    effectiveFrom: null,
    effectiveTo: null,
    scope: { subjectType: "review_session" },
    severity: "high",
    validation: { kind: "required", field: "title" },
  },
  {
    ruleId: "REVIEW-SESSION-ENTITY-TYPE",
    title: "نوع الكيان محدَّد من قائمة معتمدة",
    source: "demo",
    version: "1.0.0",
    approval: "demo",
    effectiveFrom: null,
    effectiveTo: null,
    scope: { subjectType: "review_session" },
    severity: "medium",
    validation: { kind: "enum", field: "entityType", values: ["consultation", "judgment", "document", "case", "other"] },
  },
  // ── القضية: عنوان لا يتجاوز حدًّا، ووجود موضوع. ──
  {
    ruleId: "CASE-TITLE-REQUIRED",
    title: "عنوان القضية إلزاميّ",
    source: "demo",
    version: "1.0.0",
    approval: "demo",
    effectiveFrom: null,
    effectiveTo: null,
    scope: { subjectType: "case" },
    severity: "high",
    validation: { kind: "required", field: "title" },
  },
  {
    ruleId: "CASE-TITLE-MAXLEN",
    title: "عنوان القضية ضمن الحدّ",
    source: "demo",
    version: "1.0.0",
    approval: "demo",
    effectiveFrom: null,
    effectiveTo: null,
    scope: { subjectType: "case" },
    severity: "low",
    validation: { kind: "maxLength", field: "title", max: 200 },
  },
  // ── الاستشارة: يجب أن تحمل وقائع كافية. ──
  {
    ruleId: "CONSULTATION-FACTS-MINLEN",
    title: "وقائع الاستشارة ذات حدٍّ أدنى",
    source: "demo",
    version: "1.0.0",
    approval: "demo",
    effectiveFrom: null,
    effectiveTo: null,
    scope: { subjectType: "consultation" },
    severity: "medium",
    validation: { kind: "minLength", field: "facts", min: 20 },
  },
];
