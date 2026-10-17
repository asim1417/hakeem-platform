// خريطة الأدوار×الصلاحيات الأساسية — بلا اعتماد على Prisma (آمن للواجهة والخادم).

export type AppRole =
  | "SUPER_ADMIN"
  | "SYSTEM_ADMIN"
  | "LAWYER"
  | "TRAINER"
  | "TRAINEE"
  | "JUDGE";

export type Permission =
  | "CONSULTATIONS_FULL"
  | "CONSULTATIONS_LIMITED"
  | "SIMULATIONS_USE"
  | "TRAINING_USE"
  | "TRAINING_MANAGE"
  | "LIBRARY_READ"
  | "LEGAL_CORE_VIEW"
  | "LEGAL_CORE_EDIT"
  | "LEGAL_CORE_ADMIN"
  | "ATTACHMENTS_FULL"
  | "ATTACHMENTS_LIMITED"
  /** رفع مرفقات Ask اليتيمة فقط — أدق من LIMITED (عرض/تنزيل). */
  | "ASK_ATTACHMENT_UPLOAD"
  | "USERS_MANAGE"
  | "ADMIN_REPORTS_VIEW"
  | "GOVERNANCE_AUDIT_VIEW"
  // المعاون القضائي (المرحلة 1ب): استخدام مساحة القضية وأعمالها.
  | "JUDICIAL_ASSISTANT_USE"
  // مركز المراجعة (المخطط السيادي §12): جلسات مراجعة، ملاحظات، واقتراحات بموافقة بشرية.
  | "REVIEW_USE"
  /** حصرية لمالك المنصة — لا تُمنح عبر مصفوفة SYSTEM_ADMIN. */
  | "SUPER_ADMIN_ACCESS"
  // مكتب التحرير التشريعي: مصدرها الوحيد تكليفات إعدادات المكتب (editorial_config) التي يحررها المالك.
  // لا تُمنح من صفحة الأدوار (setRolePermission يرفضها)، ولا يمنحها canUser لغير SUPER_ADMIN،
  // فلا يتجاوزها SYSTEM_ADMIN ولا ضيف المعاينة.
  | "LEGAL_EDITOR_LAWS"
  | "LEGAL_EDITOR_RULINGS"
  | "LEGAL_REVIEWER"
  /** النشر منفصل عن الاعتماد (ق-٣). */
  | "LEGAL_PUBLISHER"
  | "LEGAL_QA_VIEW"
  /** حساب وكيل آلي: يقترح فقط، ويُرفض منه أي اعتماد أو نشر. */
  | "LEGAL_AGENT_PROPOSE";

export const EDITORIAL_PERMISSIONS = [
  "LEGAL_EDITOR_LAWS",
  "LEGAL_EDITOR_RULINGS",
  "LEGAL_REVIEWER",
  "LEGAL_PUBLISHER",
  "LEGAL_QA_VIEW",
  "LEGAL_AGENT_PROPOSE",
] as const satisfies readonly Permission[];

export type EditorialPermission = (typeof EDITORIAL_PERMISSIONS)[number];

export const EDITORIAL_PERMISSION_LABELS: Record<EditorialPermission, string> = {
  LEGAL_EDITOR_LAWS: "مكتب التحرير: محرر الأنظمة",
  LEGAL_EDITOR_RULINGS: "مكتب التحرير: محرر الأحكام",
  LEGAL_REVIEWER: "مكتب التحرير: معتمِد",
  LEGAL_PUBLISHER: "مكتب التحرير: ناشر",
  LEGAL_QA_VIEW: "مكتب التحرير: عرض الجودة والسجل",
  LEGAL_AGENT_PROPOSE: "مكتب التحرير: وكيل آلي (اقتراح فقط)",
};

export function isEditorialPermission(permission: string): permission is EditorialPermission {
  return (EDITORIAL_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * حكم canUser في صلاحيات المكتب: للمالك وحده. غيره يُحكم في المكتب بتكليفه (lib/modules/editorial/policy.ts)
 * لا بـ canUser، حتى لا يرث SYSTEM_ADMIN صلاحيات المكتب من سطر التجاوز العام.
 */
export function editorialPermissionViaCanUser(role: string): boolean {
  return role === "SUPER_ADMIN";
}

const PLATFORM_ADMIN_PERMISSIONS: Permission[] = [
  "CONSULTATIONS_FULL",
  "SIMULATIONS_USE",
  "TRAINING_USE",
  "TRAINING_MANAGE",
  "LIBRARY_READ",
  "LEGAL_CORE_VIEW",
  "LEGAL_CORE_EDIT",
  "LEGAL_CORE_ADMIN",
  "ATTACHMENTS_FULL",
  "ASK_ATTACHMENT_UPLOAD",
  "USERS_MANAGE",
  "ADMIN_REPORTS_VIEW",
  "GOVERNANCE_AUDIT_VIEW",
  "JUDICIAL_ASSISTANT_USE",
  "REVIEW_USE",
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: [...PLATFORM_ADMIN_PERMISSIONS, "SUPER_ADMIN_ACCESS", ...EDITORIAL_PERMISSIONS],
  SYSTEM_ADMIN: [...PLATFORM_ADMIN_PERMISSIONS],
  // القاضي: المعاون القضائي + النواة والاستشارة للاطّلاع.
  JUDGE: [
    "JUDICIAL_ASSISTANT_USE",
    "CONSULTATIONS_FULL",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "ASK_ATTACHMENT_UPLOAD",
    "GOVERNANCE_AUDIT_VIEW",
    "REVIEW_USE",
  ],
  LAWYER: [
    "CONSULTATIONS_FULL",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "ASK_ATTACHMENT_UPLOAD",
    "JUDICIAL_ASSISTANT_USE",
    "REVIEW_USE",
  ],
  TRAINER: [
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "TRAINING_MANAGE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "ASK_ATTACHMENT_UPLOAD",
    "ADMIN_REPORTS_VIEW",
    // المعاون القضائي متاحٌ للمدرّب أيضًا (تدريبٌ عمليّ على مساحة القضية).
    "JUDICIAL_ASSISTANT_USE",
    "REVIEW_USE",
  ],
  TRAINEE: [
    "CONSULTATIONS_LIMITED",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_LIMITED",
    "ASK_ATTACHMENT_UPLOAD",
    // جمهور حكيم يشمل القضاة المتدربين وطلاب القانون — فالمعاون القضائي متاحٌ لهم.
    "JUDICIAL_ASSISTANT_USE",
    "REVIEW_USE",
  ],
};
