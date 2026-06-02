import { AppShell } from "@/components/AppShell";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    })
    .then((items) =>
      items.map((item) => ({
        ...item,
        role: item.role,
        status: "ACTIVE",
        createdAt: item.createdAt.toISOString()
      }))
    )
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">إدارة المستخدمين</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المستخدمون</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        إدارة تنظيمية مبدئية للمستخدمين والأدوار دون تفعيل تسجيل دخول حقيقي أو كلمات مرور.
      </p>
      <div className="mt-6">
        <AdminUsersManager initialUsers={users} />
      </div>
    </AppShell>
  );
}
