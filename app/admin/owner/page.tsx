import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "حساب المالك — حكيم",
  description: "إنشاء حساب المالك وتوليد اسم مستخدم وكلمة مرور مع الصلاحيات.",
};

export default async function OwnerAdminPage() {
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
        status: item.isActive ? "ACTIVE" : "INACTIVE",
        createdAt: item.createdAt.toISOString(),
      }))
    )
    .catch(() => []);

  const owners = users.filter((u) => u.role === "SYSTEM_ADMIN");

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">إعدادات المالك</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">حساب المالك وبيانات الدخول</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        من هنا تنشئ حساب المالك (مدير النظام) أو أي مستخدم، مع توليد{" "}
        <strong>اسم مستخدم</strong> و<strong>كلمة مرور سهلة</strong>، وتعيين الدور والصلاحيات. بعد الإنشاء استخدم{" "}
        <Link href="/sign-in" className="font-semibold text-[var(--gold-dark)] underline underline-offset-4">
          صفحة تسجيل الدخول
        </Link>{" "}
        بالبيانات المُولَّدة.
      </p>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-ivory p-4">
          <p className="text-xs font-semibold text-[var(--ink-60)]">حسابات المدراء</p>
          <p className="mt-1 font-display-ar text-2xl font-bold text-[var(--navy)]">
            {owners.length.toLocaleString("ar-SA")}
          </p>
        </div>
        <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-ivory p-4">
          <p className="text-xs font-semibold text-[var(--ink-60)]">إجمالي المستخدمين</p>
          <p className="mt-1 font-display-ar text-2xl font-bold text-[var(--navy)]">
            {users.length.toLocaleString("ar-SA")}
          </p>
        </div>
        <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-ivory p-4">
          <p className="text-xs font-semibold text-[var(--ink-60)]">صفحة الدخول</p>
          <Link href="/sign-in" className="mt-2 inline-block text-sm font-semibold text-[var(--navy)] underline underline-offset-4">
            /login — منشورة ومتاحة
          </Link>
        </div>
      </section>

      <div className="mt-8">
        <AdminUsersManager
          initialUsers={users}
          defaultRole="SYSTEM_ADMIN"
          title="إنشاء حساب المالك / مستخدم"
          eyebrow="توليد بيانات الدخول والصلاحيات"
        />
      </div>

      <p className="mt-6 text-sm leading-7 text-[var(--ink-60)]">
        لإدارة مصفوفة الصلاحيات المتقدمة لكل دور، انتقل إلى{" "}
        <Link href="/admin/roles" className="font-semibold text-[var(--navy)] underline underline-offset-4">
          الأدوار والصلاحيات
        </Link>
        . ولإعدادات Google / Microsoft:{" "}
        <Link href="/admin/settings" className="font-semibold text-[var(--navy)] underline underline-offset-4">
          إعدادات المنصة
        </Link>
        .
      </p>
    </AppShell>
  );
}
