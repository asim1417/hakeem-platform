// خرائط التسمية العربية للقيم المعدودة (enums) والرموز الخام المعروضة للمستخدم.
// القاعدة: لا تُظهر أي قيمة enum إنجليزية خام في الواجهة — مرّرها دائماً بإحدى
// دوال التعريب أدناه. عند غياب المفتاح تُنسَّق القيمة بلُطف (شُرَط سفلية → مسافات)
// بدل عرض الرمز الخام.

/**
 * تنسيق لطيف لأي قيمة enum غير معروفة: يستبدل الشُرَط السفلية بمسافات
 * ويحوّل الحروف لصيغة مقروءة، بدل إظهار الكود الخام (مثل AI_KEY_REVEALED).
 */
export function humanizeEnum(raw: string | null | undefined): string {
  if (!raw) return "غير محدّد";
  const cleaned = String(raw)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return "غير محدّد";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** دالّة مساعدة عامّة: تُرجع تسمية الخريطة إن وُجدت، وإلا fallback مُنسَّق. */
function labelFrom(map: Record<string, string>, raw: string | null | undefined, fallback?: string): string {
  if (!raw) return fallback ?? "غير محدّد";
  return map[raw] ?? map[String(raw).toLowerCase()] ?? map[String(raw).toUpperCase()] ?? humanizeEnum(raw);
}

// ── أدوار المستخدمين (UserRole) — منسوخة من components/AppShell.tsx ──
export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "سوبر أدمن (مالك المنصة)",
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "حساب محام - تدريبي",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب",
  JUDGE: "قاضٍ"
};

export function roleLabel(role: string | null | undefined): string {
  return labelFrom(roleLabels, role, "حساب محام - تدريبي");
}

// ── وحدات سجل التدقيق (AuditSubject) ──
export const auditSubjectLabels: Record<string, string> = {
  AUTH: "المصادقة والدخول",
  LIBRARY: "المكتبة القانونية",
  CASE: "القضايا",
  CONSULTATION: "الاستشارات",
  SIMULATION: "المحاكاة القضائية",
  TRAINING: "التدريب",
  AI_GATEWAY: "بوابة الذكاء الاصطناعي",
  ADMIN: "الإدارة"
};

export function auditSubjectLabel(subject: string | null | undefined): string {
  return labelFrom(auditSubjectLabels, subject);
}

// ── أنواع عمليات سجل التدقيق (action) — حقل نصّي حرّ، نحصر القيم المعروفة ──
export const auditActionLabels: Record<string, string> = {
  // المصادقة والدخول
  LOGIN_SUCCESS: "تسجيل دخول ناجح",
  ACCESS_DENIED: "رفض وصول",
  // فحوص الجودة
  QA_CONSULTATION_TEST_STARTED: "بدء اختبار جودة الاستشارة",
  QA_CONSULTATION_TEST_COMPLETED: "اكتمال اختبار جودة الاستشارة",
  QA_SIMULATION_TEST_STARTED: "بدء اختبار جودة المحاكاة",
  QA_SIMULATION_TEST_COMPLETED: "اكتمال اختبار جودة المحاكاة",
  QA_GATE_COMPLETED: "اكتمال بوابة ضبط الجودة",
  // أداة المستندات / OCR
  DOC_OCR_KEY_SAVED: "حفظ مفتاح المعالجة الضوئية",
  DOC_OCR_KEY_REMOVED: "إزالة مفتاح المعالجة الضوئية",
  // المساعد القضائي (JA)
  JA_DETERMINISTIC_ACTION: "إجراء قضائي محدَّد",
  JA_OUTPUT_APPROVED: "اعتماد مخرَج المساعد القضائي",
  JA_WORK_GENERATED: "توليد عمل المساعد القضائي",
  JA_ATTACHMENT_ADDED: "إضافة مرفق للقضية",
  JA_ATTACHMENT_REMOVED: "إزالة مرفق من القضية",
  JA_MAP_CONFIRMED: "تأكيد خريطة القضية",
  JA_MAP_EXTRACTED: "استخراج خريطة القضية",
  JA_EXPORTED: "تصدير ملف المساعد القضائي",
  JA_CASE_CREATED: "إنشاء قضية (المساعد القضائي)",
  JA_CASE_UPDATED: "تعديل قضية (المساعد القضائي)",
  JA_CASE_DELETED: "حذف قضية (المساعد القضائي)",
  // المرفقات
  ATTACHMENT_UPLOADED: "رفع مرفق",
  ATTACHMENT_DOWNLOADED: "تنزيل مرفق",
  ATTACHMENT_DELETED: "حذف مرفق",
  // بلاغات وأخطاء
  BUG_REPORT_FILED: "تسجيل بلاغ خلل",
  // المحادثة القانونية
  LEGAL_CHAT_TURN: "جولة محادثة قانونية",
  // التدريب
  TRAINING_ATTEMPT_CREATED: "إنشاء محاولة تدريب",
  // النواة القانونية
  PRINCIPLE_REVIEWED: "مراجعة مبدأ قضائي",
  LEGAL_CORE_REINDEXED: "إعادة فهرسة النواة القانونية",
  // القضايا
  CASE_CREATED: "إنشاء قضية",
  // المحاكاة القضائية (حكيم)
  HAKEEM_CLAIM_FILED: "قيد لائحة الدعوى",
  HAKEEM_JUDGE_TURN: "دور القاضي (حكيم)",
  HAKEEM_HEARING_RECORD_CREATED: "إنشاء ضبط جلسة",
  HAKEEM_POST_JUDGMENT_CREATED: "إنشاء إجراء بعد الحكم",
  HAKEEM_SETTLEMENT_DRAFT_CREATED: "إنشاء مسودّة صلح",
  HAKEEM_STRENGTH_SCORE_CREATED: "احتساب درجة قوة القضية",
  SIMULATION_SESSION_CREATED: "إنشاء جلسة محاكاة",
  SIMULATION_MESSAGE_CREATED: "إضافة مداخلة في المحاكاة",
  SIMULATION_MESSAGE_REJECTED_BY_TURN: "رفض مداخلة لعدم الدور",
  SIMULATION_DECISION_CREATED: "إصدار قرار في المحاكاة",
  SIMULATION_REASONED_JUDGMENT_DRAFT_CREATED: "إنشاء مسودّة حكم مُسبَّب",
  SIMULATION_DOCUMENT_EXPORTED: "تصدير مستند المحاكاة",
  // الإدارة والإعدادات
  AI_KEY_REVEALED: "كشف مفتاح الذكاء الاصطناعي",
  AI_PROVIDER_DIAGNOSED: "تشخيص مزوّد الذكاء الاصطناعي",
  API_KEY_CREATED: "إنشاء مفتاح واجهة برمجية",
  API_KEY_UPDATED: "تعديل مفتاح واجهة برمجية",
  API_KEY_REVOKED: "إبطال مفتاح واجهة برمجية",
  SETTINGS_UPDATED: "تحديث الإعدادات",
  USER_CREATED: "إنشاء مستخدم",
  USER_UPDATED: "تعديل مستخدم",
  FEATURE_TOGGLE_UPDATED: "تحديث راية خدمة"
};

export function auditActionLabel(action: string | null | undefined): string {
  return labelFrom(auditActionLabels, action);
}

// ── حالة المراجعة (reviewStatus) — حقل نصّي حرّ في نماذج النواة القانونية ──
export const reviewStatusLabels: Record<string, string> = {
  draft: "مسودّة",
  needs_review: "بحاجة إلى مراجعة",
  reviewed: "تمّت المراجعة",
  approved: "معتمَد",
  published: "منشور",
  verified: "موثّق رسميًا",
  rejected: "مرفوض",
  ai_extracted: "مسترجَع آليًا"
};

export function reviewStatusLabel(status: string | null | undefined): string {
  return labelFrom(reviewStatusLabels, status);
}

// ── نوع العلاقة (relationType) ──
// يغطّي القيم الحرّة في LegalArticleCaseLink (بأحرف صغيرة) وقيم enum RelationType
// المعياري (بأحرف كبيرة) على حدٍّ سواء.
export const relationTypeLabels: Record<string, string> = {
  // قيم روابط المادة↔الحكم (نصّية حرّة)
  applied: "أساس الحكم",
  cited: "استشهاد",
  procedural: "إجرائي",
  procedural_reference: "إحالة إجرائية",
  supporting_authority: "مرجع مؤيد",
  supportive: "سند داعم",
  direct: "أساس مباشر",
  evidentiary: "متعلّق بالإثبات",
  interpretive: "تفسيري",
  unclear: "غير محدّد",
  // قيم enum RelationType المعيارية
  SUPPORTS: "يدعم",
  CONTRADICTS: "يعارض",
  INTERPRETS: "يفسّر",
  IMPLEMENTS: "ينفّذ",
  SUPERSEDES: "يَنسخ",
  RELATED_TO: "متعلّق"
};

export function relationTypeLabel(type: string | null | undefined): string {
  return labelFrom(relationTypeLabels, type);
}
