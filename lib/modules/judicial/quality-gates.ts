// ─────────────────────────────────────────────────────────────────────────────
// §27 — سجلّ بوّابات الجودة القضائيّة (JG0..JG21)
//
// إطارٌ موحّد تمرّ به مخرجات كلّ خدمةٍ قضائيّة. الأخطاء المانعة (§27) تمنع بلوغ
// READY_FOR_REVIEW. يُبنى عليه في PR6 محرّك تنفيذ البوّابات؛ هنا التعريفات فقط.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialQualityGate } from "./contracts";

export const JUDICIAL_QUALITY_GATES: readonly JudicialQualityGate[] = [
  { id: "JG0", code: "CASE_INPUT_COMPLETENESS", titleAr: "اكتمال مدخلات القضية", descriptionAr: "توافر الأطراف والوقائع والطلبات الكافية للبدء.", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG1", code: "ROLE_AND_PERMISSION", titleAr: "الدور والصلاحية", descriptionAr: "مطابقة الدور المطلوب لصلاحية المستخدم (RBAC/ABAC).", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG2", code: "PARTY_IDENTITY_CAPACITY_REPRESENTATION", titleAr: "هوية الأطراف وأهليتهم وتمثيلهم", descriptionAr: "تحديد الصفة والأهلية والتمثيل.", severity: "BLOCKING", appliesToFunctions: ["CLAIM_FORMULATION", "ANSWER_FORMULATION", "RECORD", "DISPOSITION"] },
  { id: "JG3", code: "JURISDICTION", titleAr: "الاختصاص", descriptionAr: "تحقّق الاختصاص النوعيّ والمكانيّ والوظيفيّ.", severity: "BLOCKING", appliesToFunctions: ["CLAIM_FORMULATION", "PROCEDURAL_DECISION", "REASONING", "DISPOSITION"] },
  { id: "JG4", code: "PROCEDURE_GRAPH_VALIDITY", titleAr: "صحّة خريطة الإجراءات", descriptionAr: "اتّساق العقد والحواف والمتطلّبات المحلولة.", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG5", code: "CLAIM_FORMULATION", titleAr: "تحرير الدعوى", descriptionAr: "اكتمال العلاقة المنشئة والوقائع المؤثّرة والطلبات.", severity: "BLOCKING", appliesToFunctions: ["CLAIM_FORMULATION"] },
  { id: "JG6", code: "FACT_STATUS_INTEGRITY", titleAr: "سلامة حالة الوقائع", descriptionAr: "عدم تحوّل الادّعاء إلى واقعة ثابتة بلا سند.", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG7", code: "EVIDENCE_AND_BURDEN", titleAr: "الإثبات وعبء الإثبات", descriptionAr: "ربط الدليل بالواقعة وصحّة توزيع العبء.", severity: "BLOCKING", appliesToFunctions: ["EVIDENCE_ANALYSIS", "REASONING", "DISPOSITION"] },
  { id: "JG8", code: "AUTHORITY_CURRENTNESS", titleAr: "سريان السلطة", descriptionAr: "أنّ كلّ نصٍّ مستنَد إليه ساري المفعول وفق law_as_of_date.", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG9", code: "QUOTE_AND_CITATION_MATCH", titleAr: "مطابقة الاقتباس والاستشهاد", descriptionAr: "أنّ كلّ اقتباس/استشهاد مطابقٌ لمصدرٍ حقيقيّ (منع الاختلاق).", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG10", code: "ISSUE_COMPLETENESS", titleAr: "اكتمال المسائل", descriptionAr: "تغطية كلّ مسألةٍ متفرّعة عن الطلبات.", severity: "WARNING", appliesToFunctions: ["ISSUE_MAP", "REASONING"] },
  { id: "JG11", code: "REASONING_APPLICATION", titleAr: "تطبيق التسبيب", descriptionAr: "انتقالٌ سليم من الواقعة إلى القاعدة فالتطبيق فالنتيجة.", severity: "BLOCKING", appliesToFunctions: ["REASONING", "DISPOSITION"] },
  { id: "JG12", code: "MATERIAL_DEFENSE_COVERAGE", titleAr: "تغطية الدفوع الجوهريّة", descriptionAr: "عدم إسقاط دفعٍ جوهريّ.", severity: "BLOCKING", appliesToFunctions: ["REASONING", "DEFENSE", "DISPOSITION"] },
  { id: "JG13", code: "JUDICIAL_LANGUAGE_FIDELITY", titleAr: "أمانة اللغة القضائيّة", descriptionAr: "عدم خلط صوت المحكمة بالمحامي، وضبط مستوى الجزم.", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG14", code: "ROUTE_TERMINOLOGY", titleAr: "مصطلح طريق الاعتراض", descriptionAr: "عدم خلط الاستئناف بالنقض بالالتماس.", severity: "BLOCKING", appliesToFunctions: ["OBJECTION"] },
  { id: "JG15", code: "RELIEF_AND_NON_ULTRA_PETITA", titleAr: "الطلبات وعدم تجاوزها", descriptionAr: "عدم القضاء بما لم يُطلب أو إهمال طلب.", severity: "BLOCKING", appliesToFunctions: ["DISPOSITION"] },
  { id: "JG16", code: "REASONING_DISPOSITION_CONSISTENCY", titleAr: "اتّساق الأسباب والمنطوق", descriptionAr: "أنّ لكلّ بند منطوقٍ سببًا ولكلّ طلبٍ نتيجة.", severity: "BLOCKING", appliesToFunctions: ["DISPOSITION", "REASONING"] },
  { id: "JG17", code: "RECORD_FORMALISM", titleAr: "شكليّة الضبط", descriptionAr: "اتّصال السرد ومنع الفراغات وحفظ التصحيحات وعدم تغيير الأقوال.", severity: "BLOCKING", appliesToFunctions: ["RECORD"] },
  { id: "JG18", code: "PRIVACY_CONFIDENTIALITY", titleAr: "الخصوصيّة والسرّية", descriptionAr: "حماية البيانات الشخصيّة وسرّية الملفّ (PDPL).", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG19", code: "IMPERSONATION_NON_BINDING_LABEL", titleAr: "وسم عدم الإلزام", descriptionAr: "وسم المسودّات الداخليّة صراحةً بأنّها غير ملزمة ولا تمثّل حكمًا صادرًا.", severity: "BLOCKING", appliesToFunctions: ["RECORD", "REASONING", "DISPOSITION", "PROCEDURAL_DECISION"] },
  { id: "JG20", code: "DOMAIN_PACK_COMPATIBILITY", titleAr: "توافق حزمة المجال", descriptionAr: "عدم نقل إجراءٍ/نتيجة بين المسارات دون مواءمة (§8.1).", severity: "BLOCKING", appliesToFunctions: "ALL" },
  { id: "JG21", code: "RELEASE_READINESS", titleAr: "جاهزيّة الإصدار", descriptionAr: "اجتياز البوّابات المانعة والوقوف عند READY_FOR_REVIEW.", severity: "BLOCKING", appliesToFunctions: "ALL" },
];

/** أخطاء §27 المانعة الصريحة — تُمنع بها الجاهزيّة مهما كانت جودة الصياغة. */
export const BLOCKING_ERROR_CODES: readonly string[] = [
  "FABRICATION",
  "STALE_UNVERIFIED_AUTHORITY",
  "ASSERTION_BECAME_FACT",
  "ULTRA_PETITA",
  "MATERIAL_DEFENSE_DROPPED",
  "WRONG_OBJECTION_ROUTE",
  "BENCH_PARTY_VOICE_MIX",
  "DOMAIN_CROSS_CONTAMINATION",
  "NON_CURRENT_PROCEDURE",
  "REASONING_DISPOSITION_CONTRADICTION",
  "RECORD_ALTERS_STATEMENT",
  "UNENFORCEABLE_DISPOSITION",
  "UNLABELED_INTERNAL_DRAFT_EXPORT",
];

export function getQualityGate(id: string): JudicialQualityGate | undefined {
  return JUDICIAL_QUALITY_GATES.find((g) => g.id === id);
}

/** البوّابات المانعة المنطبقة على وظيفة مستندٍ معيّنة. */
export function blockingGatesFor(fn: string): JudicialQualityGate[] {
  return JUDICIAL_QUALITY_GATES.filter(
    (g) => g.severity === "BLOCKING" && (g.appliesToFunctions === "ALL" || g.appliesToFunctions.includes(fn as never)),
  );
}
