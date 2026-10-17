import { AdminPageShell } from "@/components/admin/AdminPageShell";
import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { buildPermissionMatrix } from "@/lib/modules/auth/role-admin";
import { RolePermissionsEditor } from "@/components/admin/RolePermissionsEditor";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requirePagePermission("USERS_MANAGE");
  const matrix = await buildPermissionMatrix();

  return (
    <AdminPageShell currentPath="/admin/roles">
      <p className="text-sm font-semibold text-gold">RBAC — صلاحيات متقدمة</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">الأدوار والصلاحيات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        محرّر فعّال لمصفوفة الأدوار×الصلاحيات. المنح الإضافي يُحفظ في القاعدة ويحترمه التحقق الخادمي مباشرةً عبر <code>canUser</code>.
      </p>
      <div className="mt-6">
        <Link href="/admin/legal/settings" className="mb-6 block rounded-lg border p-4">إدارة أدوار التحرير والاعتماد والنشر وتكليف المستخدمين</Link>
        <RolePermissionsEditor initialMatrix={matrix} />
      </div>
    </AdminPageShell>
  );
}
