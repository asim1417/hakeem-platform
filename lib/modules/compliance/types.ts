// محرك الامتثال — المخطط السيادي §15. منفصلٌ عن الجودة:
// الجودة تسأل «هل المخرج قويّ؟»، والامتثال يسأل «هل يطابق القواعد الإلزامية؟».
// كل قاعدة تحمل معرّفًا ومصدرًا وإصدارًا ونطاق سريان — لا نصّ مُختلَق.

export type ComplianceSeverity = "info" | "low" | "medium" | "high" | "critical";

/** حالة اعتماد القاعدة — «نموذجيّة» حتى تُربط بأساسٍ رسميّ (§75/§76). */
export type RuleApproval = "authoritative" | "demo";

/** أنواع التحقّق المدعومة — حتميّة، بلا نموذج. */
export type RuleValidation =
  | { kind: "required"; field: string }
  | { kind: "maxLength"; field: string; max: number }
  | { kind: "minLength"; field: string; min: number }
  | { kind: "regex"; field: string; pattern: string; message?: string }
  | { kind: "enum"; field: string; values: string[] };

/** أساس نظاميّ يربط القاعدة بمادّة حقيقيّة — يُملأ عند اعتماد القاعدة (§75/§76). */
export interface RuleBasis {
  system: string; // اسم النظام
  articleNumber: number;
  articleVersionRef?: string; // معرّف نسخة المادّة (ArticleVersion) عند توفّره
}

export interface ComplianceRule {
  ruleId: string;
  title: string;
  source: string; // الجهة/الأساس، مثل: "نظام المرافعات" أو "demo"
  version: string; // SemVer
  approval: RuleApproval;
  effectiveFrom: string | null; // ISO — null = سارية دائمًا
  effectiveTo: string | null; // ISO — null = غير منتهية
  scope: { subjectType: string }; // نوع الكيان الذي تنطبق عليه القاعدة
  severity: ComplianceSeverity;
  validation: RuleValidation;
  /**
   * الأساس النظاميّ (اختياريّ). قاعدةٌ لا تحمل basis تبقى «نموذجيّة» ولا يجوز اعتمادها.
   * تُعتمَد القاعدة (approval="authoritative") فقط حين تُربط بأساسٍ حقيقيّ — قرارٌ قانونيّ.
   */
  basis?: RuleBasis;
}

export interface ComplianceViolation {
  ruleId: string;
  title: string;
  severity: ComplianceSeverity;
  source: string;
  approval: RuleApproval;
  detail: string;
}

export interface ComplianceResult {
  subjectType: string;
  evaluatedAt: string; // ISO
  rulesEvaluated: number;
  rulesSkipped: number; // خارج نطاق السريان الزمنيّ
  violations: ComplianceViolation[];
  passed: boolean; // لا انتهاكات high/critical
  note: string;
}
