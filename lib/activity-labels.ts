// ─────────────────────────────────────────────────────────────────────────────
// خريطة ترجمة رموز الأنشطة والحالات إلى عبارات عربية مفهومة — طبقة عرض فقط.
// الرمز يبقى في القاعدة كما هو (CONSULTATION_GENERATED…) للنظام والتدقيق؛
// وتُترجَم عند العرض للمستخدم. أي رمز غير مُترجَم يسقط لنفسه (لا كسر).
// ─────────────────────────────────────────────────────────────────────────────

/** رمز حدث التدقيق (action) → عبارة عربية مفهومة. */
export const ACTIVITY_LABELS: Record<string, string> = {
  // المصادقة والوصول
  LOGIN_SUCCESS: "تسجيل دخول ناجح",
  LOGIN_FAILED: "فشل تسجيل الدخول",
  LOGOUT: "تسجيل خروج",
  ACCESS_DENIED: "رُفض الوصول",

  // الذكاء والاستشارات
  AI_LIVE_COMPLETED: "اكتمل تحليل ذكيّ",
  AI_OFFLINE_COMPLETED: "اكتمل تحليل (دون اتصال)",
  AI_KEY_REVEALED: "كُشف مفتاح الذكاء",
  CONSULTATION_GENERATED: "أُنشئت استشارة",
  CONSULTATION_BLOCKED: "حُجبت استشارة",
  ORIGINAL_HAKEEM_AI_COMPLETED: "اكتمل تحليل حكيم",
  ORIGINAL_HAKEEM_AI_OFFLINE: "تحليل حكيم (دون اتصال)",
  LEGAL_CHAT_TURN: "جولة محادثة قانونية",

  // القضايا والمرفقات
  CASE_CREATED: "أُنشئت قضية",
  ATTACHMENT_UPLOADED: "رُفِع مرفق",
  ATTACHMENT_DOWNLOADED: "نُزِّل مرفق",
  ATTACHMENT_DELETED: "حُذف مرفق",

  // القاضي التفاعلي / المحاكاة
  SIMULATION_SESSION_CREATED: "بدأت جلسة محاكاة",
  SIMULATION_MESSAGE_CREATED: "أُضيفت مداخلة",
  SIMULATION_MESSAGE_REJECTED_BY_TURN: "رُفضت مداخلة (خارج الدور)",
  SIMULATION_DECISION_CREATED: "صدر قرار إجرائيّ",
  SIMULATION_REASONED_JUDGMENT_DRAFT_CREATED: "أُنشئت مسوّدة حكم مسبَّب",
  SIMULATION_DOCUMENT_EXPORTED: "صُدِّر مستند محاكاة",
  HAKEEM_CLAIM_FILED: "قُيِّدت دعوى",
  HAKEEM_HEARING_RECORD_CREATED: "أُنشئ ضبط جلسة",
  HAKEEM_JUDGE_TURN: "مداخلة القاضي",
  HAKEEM_STRENGTH_SCORE_CREATED: "قُدِّرت قوة الدعوى",
  HAKEEM_SETTLEMENT_DRAFT_CREATED: "أُنشئت مسوّدة صلح",
  HAKEEM_POST_JUDGMENT_CREATED: "أُنشئ إجراء ما بعد الحكم",

  // النواة والتدريب
  PRINCIPLE_REVIEWED: "روجِع مبدأ قضائيّ",
  TRAINING_ATTEMPT_CREATED: "سُجِّلت محاولة تدريب",
  BUG_REPORT_FILED: "سُجِّل بلاغ خلل",

  // الإدارة والصلاحيات
  USER_CREATED: "أُضيف مستخدم",
  USER_UPDATED: "حُدِّث مستخدم",
  SETTINGS_UPDATED: "حُدِّثت الإعدادات",
  ROLE_PERMISSION_GRANTED: "مُنحت صلاحية دور",
  ROLE_PERMISSION_REVOKED: "سُحبت صلاحية دور",
  API_KEY_CREATED: "أُنشئ مفتاح API",
  API_KEY_UPDATED: "حُدِّث مفتاح API",
  API_KEY_REVOKED: "أُلغي مفتاح API",
  DOC_OCR_KEY_SAVED: "حُفظ مفتاح القراءة الضوئية",
  DOC_OCR_KEY_REMOVED: "أُزيل مفتاح القراءة الضوئية",
};

/** رمز حالة (status) → عبارة عربية. يشمل حالات الاستشارة والقضية. */
export const STATUS_LABELS: Record<string, string> = {
  // الاستشارات
  GENERATED: "مُنشأة",
  BLOCKED: "محجوبة",
  DRAFT: "مسوّدة",
  // القضايا
  OPEN: "مفتوحة",
  UNDER_REVIEW: "قيد المراجعة",
  CLOSED: "مغلقة",
};

/** يترجم رمز نشاط إلى عبارة عربية؛ يسقط للرمز نفسه إن لم يُعرَف (لا كسر). */
export function activityLabel(code: string): string {
  return ACTIVITY_LABELS[code] ?? code;
}

/** يترجم رمز حالة إلى عبارة عربية؛ يسقط للرمز نفسه إن لم يُعرَف. */
export function statusLabel(code: string): string {
  return STATUS_LABELS[code] ?? code;
}
