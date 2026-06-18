// إدارة الأدوار والصلاحيات المتقدمة (RBAC editor).
// يبني مصفوفة الأدوار×الصلاحيات: الأساس الثابت (rbac) + المنح الإضافية من القاعدة
// (RolePermission التي يحترمها canUser). المنح إضافي فقط — لا يمكن سحب صلاحية أساسية.
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "./rbac";

export const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "محامٍ",
  TRAINER: "مدرّب",
  TRAINEE: "متدرّب",
};

export const ROLE_ORDER: UserRole[] = ["SYSTEM_ADMIN", "LAWYER", "TRAINER", "TRAINEE"];

export const PERMISSION_CATALOG: { key: Permission; label: string }[] = [
  { key: "CONSULTATIONS_FULL", label: "الاستشارات (كامل)" },
  { key: "CONSULTATIONS_LIMITED", label: "الاستشارات (محدود)" },
  { key: "SIMULATIONS_USE", label: "المحاكاة القضائية" },
  { key: "TRAINING_USE", label: "استخدام التدريب" },
  { key: "TRAINING_MANAGE", label: "إدارة التدريب" },
  { key: "LIBRARY_READ", label: "قراءة المكتبة" },
  { key: "LEGAL_CORE_VIEW", label: "عرض النواة القانونية" },
  { key: "LEGAL_CORE_EDIT", label: "تعديل النواة القانونية" },
  { key: "LEGAL_CORE_ADMIN", label: "إدارة النواة القانونية" },
  { key: "ATTACHMENTS_FULL", label: "المرفقات (كامل)" },
  { key: "ATTACHMENTS_LIMITED", label: "المرفقات (محدود)" },
  { key: "USERS_MANAGE", label: "إدارة المستخدمين" },
  { key: "ADMIN_REPORTS_VIEW", label: "تقارير الإدارة" },
  { key: "GOVERNANCE_AUDIT_VIEW", label: "سجل التدقيق والحوكمة" },
];

function labelFor(permission: Permission): string {
  return PERMISSION_CATALOG.find((p) => p.key === permission)?.label ?? permission;
}

export interface MatrixCell {
  permission: Permission;
  label: string;
  baseline: boolean; // صلاحية أساسية للدور (ثابتة، مقفلة)
  granted: boolean; // مَنح إضافي من القاعدة
  effective: boolean; // الفعّالة فعلاً (يحترمها canUser)
  locked: boolean; // لا يمكن تغييرها (أساسية)
}
export interface RoleMatrix {
  role: UserRole;
  label: string;
  cells: MatrixCell[];
}

/** مصفوفة الأساس فقط (بلا قاعدة) — للاختبار والسقوط الآمن. */
export function buildBaselineMatrix(): RoleMatrix[] {
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    cells: PERMISSION_CATALOG.map((p) => {
      const baseline = hasPermission(role, p.key);
      return { permission: p.key, label: p.label, baseline, granted: false, effective: baseline, locked: baseline };
    }),
  }));
}

/** المصفوفة الكاملة من القاعدة (أساس + منح RolePermission). سقوط آمن إلى الأساس. */
export async function buildPermissionMatrix(): Promise<RoleMatrix[]> {
  try {
    const records = await prisma.roleRecord.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    const grantedByRole = new Map<string, Set<string>>();
    for (const r of records) grantedByRole.set(r.key, new Set(r.permissions.map((x) => x.permission.key)));
    return ROLE_ORDER.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      cells: PERMISSION_CATALOG.map((p) => {
        const baseline = hasPermission(role, p.key);
        const granted = grantedByRole.get(role)?.has(p.key) ?? false;
        return { permission: p.key, label: p.label, baseline, granted, effective: baseline || granted, locked: baseline };
      }),
    }));
  } catch {
    return buildBaselineMatrix();
  }
}

/** يمنح/يسحب صلاحية إضافية لدور. لا يمكن سحب صلاحية أساسية (يحميها canUser أصلاً). */
export async function setRolePermission(
  role: UserRole,
  permission: Permission,
  grant: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (!grant && hasPermission(role, permission)) {
    return { ok: false, message: "هذه صلاحية أساسية للدور ولا يمكن سحبها." };
  }
  if (grant && hasPermission(role, permission)) {
    return { ok: true, message: "الصلاحية أساسية للدور أصلاً." };
  }
  try {
    const roleRec = await prisma.roleRecord.upsert({
      where: { key: role },
      create: { key: role, name: ROLE_LABELS[role] },
      update: {},
    });
    const permRec = await prisma.permissionRecord.upsert({
      where: { key: permission },
      create: { key: permission, name: labelFor(permission) },
      update: {},
    });
    if (grant) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleRec.id, permissionId: permRec.id } },
        create: { roleId: roleRec.id, permissionId: permRec.id },
        update: {},
      });
    } else {
      await prisma.rolePermission.deleteMany({ where: { roleId: roleRec.id, permissionId: permRec.id } });
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "تعذّر الحفظ (قد تكون جداول الأدوار غير مهيأة في القاعدة)." };
  }
}

export function isPermission(value: string): value is Permission {
  return PERMISSION_CATALOG.some((p) => p.key === value);
}
export function isRole(value: string): value is UserRole {
  return ROLE_ORDER.includes(value as UserRole);
}
