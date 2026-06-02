import { UserRole } from "@prisma/client";

export type Permission =
  | "CONSULTATIONS_FULL"
  | "CONSULTATIONS_LIMITED"
  | "SIMULATIONS_USE"
  | "TRAINING_USE"
  | "TRAINING_MANAGE"
  | "LIBRARY_READ"
  | "ATTACHMENTS_FULL"
  | "ATTACHMENTS_LIMITED"
  | "USERS_MANAGE"
  | "ADMIN_REPORTS_VIEW"
  | "GOVERNANCE_AUDIT_VIEW";

const rolePermissions: Record<UserRole, Permission[]> = {
  SYSTEM_ADMIN: [
    "CONSULTATIONS_FULL",
    "SIMULATIONS_USE",
    "TRAINING_USE",
    "TRAINING_MANAGE",
    "LIBRARY_READ",
    "ATTACHMENTS_FULL",
    "USERS_MANAGE",
    "ADMIN_REPORTS_VIEW",
    "GOVERNANCE_AUDIT_VIEW"
  ],
  LAWYER: ["CONSULTATIONS_FULL", "SIMULATIONS_USE", "TRAINING_USE", "LIBRARY_READ", "ATTACHMENTS_FULL"],
  TRAINER: ["SIMULATIONS_USE", "TRAINING_USE", "TRAINING_MANAGE", "LIBRARY_READ", "ATTACHMENTS_FULL", "ADMIN_REPORTS_VIEW"],
  TRAINEE: ["CONSULTATIONS_LIMITED", "SIMULATIONS_USE", "TRAINING_USE", "LIBRARY_READ", "ATTACHMENTS_LIMITED"]
};

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`لا يملك هذا الدور صلاحية ${permission}`);
  }
}

export { rolePermissions };
