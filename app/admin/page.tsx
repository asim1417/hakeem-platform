import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAdminStatus() {
  const database = await prisma.$queryRaw`SELECT 1`
    .then(() => "متصلة")
    .catch(() => "تعذر الاتصال");
  const [legalSystems, legalArticles, auditLogs, users, roles, permissions, attachments] = await Promise.all([
    prisma.legalSystem.count().catch(() => 0),
    prisma.legalArticle.count().catch(() => 0),
    prisma.auditEvent.count().catch(() => 0),
    prisma.user.count().catch(() => 0),
    prisma.roleRecord.count().catch(() => 0),
    prisma.permissionRecord.count().catch(() => 0),
    prisma.attachment.count().catch(() => 0)
  ]);

  return {
    database,
    aiProvider: process.env.AI_PROVIDER || "offline",
    legalSystems,
    legalArticles,
    auditLogs,
    users,
    roles,
    permissions,
    attachments
  };
}

const todos = ["ربط Microsoft 365", "ربط SharePoint", "رفع المرفقات", "إدارة المستخدمين", "صلاحيات متقدمة", "تفعيل AI حقيقي لاحقًا"];

export default async function AdminPage() {
  const status = await getAdminStatus();

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">الإدارة والتقارير</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">لوحة الإدارة</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        صفحة حالة مبسطة لمراقبة جاهزية منصة حكيم في وضع MVP دون تفعيل تكاملات خارجية أو صلاحيات متقدمة.
      </p>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="قاعدة البيانات" value={status.database} />
        <StatusCard label="AI_PROVIDER" value={status.aiProvider} />
        <StatusCard label="المستخدمون" value={status.users.toLocaleString("ar-SA")} />
        <StatusCard label="الأدوار" value={status.roles.toLocaleString("ar-SA")} />
        <StatusCard label="الصلاحيات" value={status.permissions.toLocaleString("ar-SA")} />
        <StatusCard label="المرفقات" value={status.attachments.toLocaleString("ar-SA")} />
        <StatusCard label="الأنظمة" value={status.legalSystems.toLocaleString("ar-SA")} />
        <StatusCard label="المواد" value={status.legalArticles.toLocaleString("ar-SA")} />
        <StatusCard label="سجلات التدقيق" value={status.auditLogs.toLocaleString("ar-SA")} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-black/10 bg-white p-5">
          <h2 className="text-xl font-bold text-olive">روابط الإدارة</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AdminLink href="/admin/users" label="إدارة المستخدمين" />
            <AdminLink href="/admin/roles" label="الأدوار والصلاحيات" />
            <AdminLink href="/dashboard/attachments" label="المرفقات" />
            <AdminLink href="/audit-logs" label="سجل التدقيق" />
            <AdminLink href="/settings" label="إعدادات المنصة" />
          </div>
        </div>

        <div className="rounded-md border border-gold bg-sand p-5">
          <h2 className="text-xl font-bold text-olive">تنبيه MVP</h2>
          <p className="mt-3 leading-8 text-gray-700">
            هذه النسخة مخصصة للتجربة والتحقق من تدفق المنتج. المخرجات القانونية والتدريبية مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.
          </p>
        </div>

        <div className="rounded-md border border-black/10 bg-white p-5">
          <h2 className="text-xl font-bold text-olive">TODO القادمة</h2>
          <ul className="mt-3 space-y-2 text-gray-700">
            {todos.map((todo) => (
              <li key={todo} className="rounded-md bg-sand px-3 py-2">
                {todo}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-olive">{value}</p>
    </div>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="focus-ring rounded-md bg-sand px-4 py-3 font-semibold text-olive hover:bg-gold/20">
      {label}
    </Link>
  );
}
