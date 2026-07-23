import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/modules/auth/role-permissions";

export type { Permission };

const rolePermissions = ROLE_PERMISSIONS as Record<UserRole, Permission[]>;

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
  // مدير النظام ومالك المنصة يتجاوزان مصفوفة المنح الإضافية.
  if (user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN") return true;

  const role = await prisma.roleRecord.findUnique({
    where: { key: user.role },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!role) return hasPermission(user.role, permission);
  const keys = role.permissions.map((item) => item.permission.key);
  if (permission === "CONSULTATIONS_LIMITED" && keys.includes("CONSULTATIONS_FULL")) return true;
  if (permission === "ATTACHMENTS_LIMITED" && keys.includes("ATTACHMENTS_FULL")) return true;
  if (!keys.includes(permission) && hasPermission(user.role, permission)) return true;
  return keys.includes(permission);
}

export async function requirePermission(userId: string | undefined, permission: Permission) {
  const allowed = await canUser(userId, permission);
  if (!allowed) {
    throw new Error(`لا يملك المستخدم صلاحية ${permission}`);
  }
}

export { rolePermissions };
