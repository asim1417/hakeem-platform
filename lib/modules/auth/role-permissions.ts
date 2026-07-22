// خريطة الأدوار×الصلاحيات الأساسية — بلا اعتماد على Prisma (آمن للواجهة والخادم).

export type AppRole = "SYSTEM_ADMIN" | "LAWYER" | "TRAINER" | "TRAINEE" | "JUDGE";

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
  | "USERS_MANAGE"
  | "ADMIN_REPORTS_VIEW"
  | "GOVERNANCE_AUDIT_VIEW"
  // المعاون القضائي (المرحلة 1ب): استخدام مساحة القضية وأعمالها.
  | "JUDICIAL_ASSISTANT_USE";

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SYSTEM_ADMIN: [
    "CONSULTATIONS_FULL",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "TRAINING_MANAGE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "LEGAL_CORE_EDIT",
    "LEGAL_CORE_ADMIN",
    "ATTACHMENTS_FULL",
    "USERS_MANAGE",
    "ADMIN_REPORTS_VIEW",
    "GOVERNANCE_AUDIT_VIEW",
    "JUDICIAL_ASSISTANT_USE",
  ],
  // القاضي: المعاون القضائي + النواة والاستشارة للاطّلاع.
  JUDGE: [
    "JUDICIAL_ASSISTANT_USE",
    "CONSULTATIONS_FULL",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "GOVERNANCE_AUDIT_VIEW",
  ],
  LAWYER: [
    "CONSULTATIONS_FULL",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "JUDICIAL_ASSISTANT_USE",
  ],
  TRAINER: [
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "TRAINING_MANAGE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_FULL",
    "ADMIN_REPORTS_VIEW",
    // المعاون القضائي متاحٌ للمدرّب أيضًا (تدريبٌ عمليّ على مساحة القضية).
    "JUDICIAL_ASSISTANT_USE",
  ],
  TRAINEE: [
    "CONSULTATIONS_LIMITED",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "LIBRARY_READ",
    "LEGAL_CORE_VIEW",
    "ATTACHMENTS_LIMITED",
    // جمهور حكيم يشمل القضاة المتدربين وطلاب القانون — فالمعاون القضائي متاحٌ لهم.
    "JUDICIAL_ASSISTANT_USE",
  ],
};
