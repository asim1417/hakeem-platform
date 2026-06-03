import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  if (permission === "CONSULTATIONS_LIMITED" && rolePermissions[role].includes("CONSULTATIONS_FULL")) return true;
  if (permission === "ATTACHMENTS_LIMITED" && rolePermissions[role].includes("ATTACHMENTS_FULL")) return true;
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`لا يملك هذا الدور صلاحية ${permission}`);
  }
}

export async function canUser(userId: string | undefined, permission: Permission) {
  if (!userId) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (user.role === "SYSTEM_ADMIN") return true;

  const role = await prisma.roleRecord.findUnique({
    where: { key: user.role },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });

  if (!role) return hasPermission(user.role, permission);
  const keys = role.permissions.map((item) => item.permission.key);
  if (permission === "CONSULTATIONS_LIMITED" && keys.includes("CONSULTATIONS_FULL")) return true;
  if (permission === "ATTACHMENTS_LIMITED" && keys.includes("ATTACHMENTS_FULL")) return true;
  return keys.includes(permission);
}

export async function requirePermission(userId: string | undefined, permission: Permission) {
  const allowed = await canUser(userId, permission);
  if (!allowed) {
    throw new Error(`لا يملك المستخدم صلاحية ${permission}`);
  }
}

export { rolePermissions };
