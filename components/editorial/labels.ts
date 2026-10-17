// تسميات المكتب العربية (نقية، تُستورد في العميل والخادم والاختبارات). لا رمز تقني يظهر للمستخدم بلا تسمية.

export const OP_LABELS: Record<string, string> = {
  replace_article_text: "استبدال نص مادة",
  replace_paragraph_text: "استبدال نص فقرة",
  insert_paragraph: "إضافة فقرة",
  insert_article: "إضافة مادة",
  append_text: "إضافة عبارة",
  delete_paragraph: "حذف فقرة",
  repeal_article: "إلغاء مادة",
  substitute_phrase: "إحلال عبارة",
  replace_definition: "استبدال تعريف",
  replace_definition_entry: "استبدال بند تعريف",
  replace_law: "إحلال نظام",
  repeal_law: "إلغاء نظام",
  rename_law: "تعديل اسم نظام",
};

/** الأفعال الهدّامة (ق٦-٢): شارة نصية بأيقونة، لا بلون وحده. */
export const DESTRUCTIVE_OPS: Record<string, string> = {
  repeal_article: "يلغي مادة سارية",
  delete_paragraph: "يحذف فقرة سارية",
  repeal_law: "يلغي نظامًا",
  replace_law: "يحلّ نظامًا محل نظام",
};

/** عمليات تعرض «النص الساري الآن» بجانب الجديد (استبدال وإلغاء وحذف وإحلال كامل). */
export const COMPARE_OPS = new Set([
  "replace_article_text",
  "replace_paragraph_text",
  "replace_definition",
  "replace_definition_entry",
  "repeal_article",
  "delete_paragraph",
  "replace_law",
  "repeal_law",
]);

/** عمليات لا يبقى بعدها نص ساري. */
export const REMOVAL_OPS = new Set(["repeal_article", "delete_paragraph", "repeal_law"]);

export const INSTRUMENT_LABELS: Record<string, string> = {
  royal_decree: "مرسوم ملكي",
  cabinet_decision: "قرار مجلس الوزراء",
  royal_order: "أمر ملكي",
  royal_circular: "تعميم ملكي",
};

/** اسم الأداة: رمز نوعها الإنجليزي في أول النص (كما تخزّنه دفعات الاستقبال) يُعرض بتسميته العربية. */
export function instrumentText(value: string): string {
  return value.replace(/^(royal_decree|cabinet_decision|royal_order|royal_circular)\b\s*/, (_m, code: string) => `${INSTRUMENT_LABELS[code]} `).trim();
}

export const CHANGE_SET_STATUS: Record<string, string> = {
  draft: "مسودة",
  checks_failed: "فشلت الفحوص",
  pending: "في الطابور",
  approved: "معتمدة",
  rejected: "مرفوضة",
  published: "منشورة",
  reverted: "متراجع عنها",
};

export type BadgeTone = "neutral" | "info" | "success" | "danger" | "risk" | "destructive";

export const CHANGE_SET_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  checks_failed: "danger",
  pending: "info",
  approved: "success",
  rejected: "danger",
  published: "success",
  reverted: "neutral",
};

/** الحقول القابلة للتصحيح بتسمياتها (مطابقة لـ CORRECTABLE_FIELDS في الخادم). */
export const CORRECTION_FIELDS: Array<{ key: CorrectionKey; label: string; multiline?: boolean; ltr?: boolean; hint?: string }> = [
  { key: "new_text", label: "النص الجديد", multiline: true },
  { key: "article_number", label: "رقم المادة", ltr: true },
  { key: "paragraph_label", label: "الفقرة" },
  { key: "old_phrase", label: "العبارة الحالية" },
  { key: "new_phrase", label: "العبارة الجديدة" },
  { key: "effective_from_hijri", label: "يسري من (هـ)", ltr: true, hint: "مثل 1447/05/17" },
  { key: "effective_from_gregorian", label: "يسري من (م)", ltr: true, hint: "مثل 2026/10/17" },
  { key: "target_law_title", label: "النظام المستهدف" },
  { key: "op_type", label: "نوع العملية" },
];

export type CorrectionKey =
  | "article_number"
  | "paragraph_label"
  | "effective_from_hijri"
  | "effective_from_gregorian"
  | "new_text"
  | "op_type"
  | "old_phrase"
  | "new_phrase"
  | "target_law_title";

export const CORRECTION_LABEL: Record<string, string> = Object.fromEntries(CORRECTION_FIELDS.map((f) => [f.key, f.label]));

/** الحقول التي تخص نوع العملية؛ تظهر أولًا، والبقية تحت «حقول أخرى». */
export function primaryCorrectionFields(opType: string): CorrectionKey[] {
  switch (opType) {
    case "substitute_phrase":
      return ["old_phrase", "new_phrase", "article_number"];
    case "replace_paragraph_text":
    case "insert_paragraph":
      return ["new_text", "article_number", "paragraph_label"];
    case "delete_paragraph":
      return ["article_number", "paragraph_label"];
    case "repeal_article":
      return ["article_number"];
    case "replace_law":
    case "repeal_law":
    case "rename_law":
      return ["target_law_title", "new_text"];
    default:
      return ["new_text", "article_number"];
  }
}

/** أفعال السجل بأسمائها العربية (القيمة بادئة الرمز في المرشح). */
export const AUDIT_ACTIONS: Array<{ value: string; label: string }> = [
  { value: "intake.amendment.decide", label: "قرار على عملية تعديل" },
  { value: "intake.principle.decide", label: "قرار على مبدأ" },
  { value: "intake.proposal.open", label: "فتح مقترح قرار يحتاج موافقات" },
  { value: "intake.proposal.approve", label: "موافقة على مقترح قرار" },
  { value: "intake.proposal.reject", label: "رفض مقترح قرار" },
  { value: "change_set.create", label: "إنشاء دفعة" },
  { value: "change_set.submit", label: "إرسال دفعة إلى الطابور" },
  { value: "change_set.checks_failed", label: "فشل فحوص دفعة" },
  { value: "change_set.approve_partial", label: "موافقة جزئية على دفعة" },
  { value: "change_set.approve", label: "اعتماد دفعة" },
  { value: "change_set.reject", label: "رفض دفعة" },
  { value: "change_set.publish", label: "نشر دفعة" },
  { value: "change_set.withdraw", label: "سحب دفعة" },
  { value: "change_set.revert_requested", label: "طلب تراجع" },
  { value: "change_set.emergency_revert", label: "تراجع عاجل" },
  { value: "change.create", label: "إضافة تغيير" },
  { value: "change.publish", label: "نشر تغيير" },
  { value: "config.save", label: "حفظ إعدادات المكتب" },
  { value: "access.denied", label: "رفض صلاحية" },
];

/** مجموعات المرشح: بادئة الرمز وتسميتها. */
export const AUDIT_ACTION_GROUPS: Array<{ value: string; label: string }> = [
  { value: "intake.", label: "قرارات مقترحات الذكاء الاصطناعي" },
  { value: "change_set.", label: "أفعال الدفعات" },
  { value: "change.", label: "أفعال التغييرات" },
  { value: "config.", label: "إعدادات المكتب" },
  { value: "access.", label: "الصلاحيات" },
];

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS.find((a) => a.value === action)?.label ?? "حدث في المكتب";
}

export const AUDIT_OBJECT_TYPES: Array<{ value: string; label: string }> = [
  { value: "change_set", label: "دفعة" },
  { value: "work", label: "نظام" },
  { value: "amendment_op", label: "عملية تعديل" },
  { value: "principle", label: "مبدأ" },
  { value: "editorial_config", label: "إعدادات المكتب" },
  { value: "route", label: "مسار" },
];

export function objectTypeLabel(type: string): string {
  return AUDIT_OBJECT_TYPES.find((t) => t.value === type)?.label ?? "هدف";
}

export const ACTOR_KIND_LABEL: Record<string, string> = { human: "بشري", agent: "وكيل", system: "النظام" };

// ── الإعدادات ───────────────────────────────────────────────────────────────

export const DESK_ROLE_OPTIONS: Array<{ value: DeskRoleValue; title: string; description: string }> = [
  { value: "editor_laws", title: "محرر الأنظمة", description: "يقترح تغييرات الأنظمة" },
  { value: "editor_rulings", title: "محرر الأحكام", description: "يقترح تغييرات الأحكام" },
  { value: "reviewer", title: "مراجع", description: "يعتمد أو يرفض" },
  { value: "publisher", title: "ناشر", description: "ينشر المعتمد" },
  { value: "qa_view", title: "مشاهد الجودة", description: "يقرأ السجل" },
];
export type DeskRoleValue = "editor_laws" | "editor_rulings" | "reviewer" | "publisher" | "qa_view";
export const AGENT_FORBIDDEN: readonly DeskRoleValue[] = ["reviewer", "publisher"];

export type ItemKindValue = "set_work_status" | "review_amendment_op" | "review_principle" | "revert";
export const ITEM_KIND_OPTIONS: Array<{ value: ItemKindValue; title: string; description: string }> = [
  { value: "set_work_status", title: "تغيير حالة نظام", description: "دفعات المحررين على حالة النظام" },
  { value: "review_amendment_op", title: "قرار عملية تعديل", description: "مقترحات تعديل الأنظمة" },
  { value: "review_principle", title: "مراجعة مبدأ", description: "المبادئ المستخرجة من الأحكام" },
  { value: "revert", title: "تراجع", description: "طلبات التراجع عن المنشور" },
];

/** المجالات بأسمائها (مطابقة لمصنّف المجال في legal-core/saudi-systems). لا مسار يعيدها من الخادم بعد. */
export const DOMAIN_OPTIONS: Array<{ value: string; title: string }> = [
  { value: "personal_status", title: "الأحوال الشخصية" },
  { value: "civil", title: "المعاملات المدنية" },
  { value: "companies", title: "الشركات" },
  { value: "commercial", title: "القضاء التجاري" },
  { value: "administrative", title: "القضاء الإداري" },
  { value: "criminal", title: "الجزائي" },
  { value: "procedure", title: "المرافعات والإجراءات" },
  { value: "enforcement", title: "التنفيذ" },
  { value: "notarization", title: "التوثيق" },
  { value: "labor", title: "العمل" },
  { value: "arbitration", title: "التحكيم" },
  { value: "bankruptcy", title: "الإفلاس" },
  { value: "other", title: "أنظمة أخرى" },
];

export function domainLabel(value: string): string {
  return DOMAIN_OPTIONS.find((d) => d.value === value)?.title ?? value;
}
