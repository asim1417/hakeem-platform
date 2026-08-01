// محرك الامتثال (§15) — تقييم حتميّ منفصل عن الجودة. نواة نقيّة (بلا شبكة/DB).
import type {
  ComplianceRule,
  ComplianceResult,
  ComplianceViolation,
  RuleValidation,
} from "./types";
import { COMPLIANCE_RULES } from "./rules";

/** هل القاعدة سارية زمنيًّا عند اللحظة now؟ (§15: effective_from/to). */
export function isEffective(rule: ComplianceRule, nowIso: string): boolean {
  const now = new Date(nowIso).getTime();
  if (rule.effectiveFrom && now < new Date(rule.effectiveFrom).getTime()) return false;
  if (rule.effectiveTo && now > new Date(rule.effectiveTo).getTime()) return false;
  return true;
}

function fieldValue(data: Record<string, unknown>, field: string): unknown {
  return data[field];
}

/** يطبّق تحقّقًا واحدًا؛ يعيد رسالة الانتهاك أو null إن مرّ. */
function runValidation(v: RuleValidation, data: Record<string, unknown>): string | null {
  const raw = fieldValue(data, v.field);
  switch (v.kind) {
    case "required":
      return raw === undefined || raw === null || String(raw).trim() === ""
        ? `الحقل «${v.field}» مطلوب.`
        : null;
    case "minLength":
      return String(raw ?? "").trim().length < v.min
        ? `الحقل «${v.field}» أقصر من ${v.min}.`
        : null;
    case "maxLength":
      return String(raw ?? "").length > v.max
        ? `الحقل «${v.field}» يتجاوز ${v.max}.`
        : null;
    case "regex":
      return !new RegExp(v.pattern).test(String(raw ?? ""))
        ? v.message ?? `الحقل «${v.field}» لا يطابق النمط.`
        : null;
    case "enum":
      return !v.values.includes(String(raw ?? ""))
        ? `الحقل «${v.field}» خارج القيم المعتمدة (${v.values.join("، ")}).`
        : null;
    default:
      return null;
  }
}

/**
 * يقيّم امتثال كيانٍ لقواعده المنطبقة (نطاقًا وزمنًا).
 * @param subjectType نوع الكيان (review_session | case | consultation | ...)
 * @param data قيم حقول الكيان
 * @param nowIso اللحظة (تُمرَّر من المستدعي — لا Date.now في النواة)
 */
export function evaluateCompliance(
  subjectType: string,
  data: Record<string, unknown>,
  nowIso: string,
  rules: ComplianceRule[] = COMPLIANCE_RULES
): ComplianceResult {
  const applicable = rules.filter((r) => r.scope.subjectType === subjectType);
  const effective = applicable.filter((r) => isEffective(r, nowIso));
  const violations: ComplianceViolation[] = [];

  for (const rule of effective) {
    const detail = runValidation(rule.validation, data);
    if (detail) {
      violations.push({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        source: rule.source,
        approval: rule.approval,
        detail,
      });
    }
  }

  const blocking = violations.some((v) => v.severity === "high" || v.severity === "critical");
  return {
    subjectType,
    evaluatedAt: nowIso,
    rulesEvaluated: effective.length,
    rulesSkipped: applicable.length - effective.length,
    violations,
    passed: !blocking,
    note: "قواعد نموذجيّة غير معتمدة — تُستبدل بأساسٍ رسميّ عند اعتماده (§75/§76).",
  };
}

/** إحصاء حوكميّ للقواعد المسجّلة (للعرض في لوحة الحوكمة). */
export function complianceRuleStats(rules: ComplianceRule[] = COMPLIANCE_RULES) {
  return {
    total: rules.length,
    authoritative: rules.filter((r) => r.approval === "authoritative").length,
    demo: rules.filter((r) => r.approval === "demo").length,
    grounded: rules.filter((r) => r.basis != null).length, // مربوطة بأساس نظاميّ
    subjects: Array.from(new Set(rules.map((r) => r.scope.subjectType))),
  };
}

/**
 * حارس الاعتماد (§15/§76): قاعدةٌ لا يجوز أن تكون authoritative دون basis نظاميّ.
 * يمنع «اختلاق» قاعدة رسميّة بلا سند. يُستدعى عند إدخال قواعد معتمدة مستقبلًا.
 */
export function canApproveRule(rule: ComplianceRule): { ok: boolean; reason: string } {
  if (rule.approval !== "authoritative") return { ok: true, reason: "قاعدة نموذجيّة" };
  if (!rule.basis) return { ok: false, reason: "قاعدة معتمدة بلا أساس نظاميّ — مرفوضة (§76)." };
  return { ok: true, reason: "معتمدة بأساس نظاميّ." };
}
