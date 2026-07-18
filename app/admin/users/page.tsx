import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePagePermission("USERS_MANAGE");
  const users = await prisma.user
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
    .then((items) =>
      items.map((item) => ({
        ...item,
        role: item.role,
        status: item.isActive ? "ACTIVE" : "INACTIVE",
        createdAt: item.createdAt.toISOString(),
      }))
    )
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">إدارة المستخدمين</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المستخدمون</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        أنشئ مستخدمين بتوليد اسم مستخدم وكلمة مرور سهلة، وعيّن الدور لضبط الصلاحيات. لحساب المالك استخدم{" "}
        <Link href="/admin/owner" className="font-semibold text-[var(--gold-dark)] underline underline-offset-4">
          صفحة المالك
        </Link>
        .
      </p>
      <div className="mt-6">
        <AdminUsersManager initialUsers={users} />
      </div>
    </AppShell>
  );
}
