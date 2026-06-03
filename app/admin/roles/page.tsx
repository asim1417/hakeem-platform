import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const roleOrder = ["SYSTEM_ADMIN", "LAWYER", "TRAINER", "TRAINEE"];

export default async function AdminRolesPage() {
  await requirePagePermission("USERS_MANAGE");
  const roles = await prisma.roleRecord
    .findMany({
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { key: "asc" } }
        }
      }
    })
    .then((items) => items.sort((a, b) => roleOrder.indexOf(a.key) - roleOrder.indexOf(b.key)))
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">RBAC</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">الأدوار والصلاحيات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        عرض مبدئي للأدوار والصلاحيات من قاعدة البيانات، مع تجهيز دوال تحقق server-side لاستخدامها في APIs الحساسة.
      </p>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {roles.length === 0 ? (
          <p className="rounded-md bg-white p-5 text-gray-700">لا توجد أدوار أو صلاحيات مسجلة حتى الآن.</p>
        ) : (
          roles.map((role) => (
            <article key={role.id} className="rounded-md border border-black/10 bg-white p-5">
              <p className="text-sm text-gold">{role.key}</p>
              <h2 className="mt-2 text-xl font-bold text-olive">{role.name}</h2>
              {role.permissions.length === 0 ? (
                <p className="mt-3 rounded-md bg-sand p-3 text-gray-700">لا توجد صلاحيات مرتبطة بهذا الدور.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.permissions.map((item) => (
                    <span key={item.id} className="rounded-md bg-sand px-3 py-2 text-sm text-gray-700">
                      {item.permission.name}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>

      <p className="mt-6 rounded-md border border-gold bg-sand p-4 text-sm leading-7 text-gray-700">
        TODO: تفعيل منع الوصول الكامل لكل صفحة ينتظر تفعيل Auth والجلسات. حاليًا تستخدم APIs الحساسة المستخدم النظامي ودوال `canUser`/`requirePermission`.
      </p>
    </AppShell>
  );
}
