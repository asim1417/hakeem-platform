import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getAiStatus } from "@/lib/modules/ai/ai-config";
import { sharePointConfigured, storageBackend } from "@/lib/modules/attachments/blob-storage";

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
  const ai = await getAiStatus().catch(() => null);

  return {
    database,
    aiProvider: process.env.AI_PROVIDER || "offline",
    aiLive: Boolean(ai && ai.provider !== "offline" && ai.configured),
    aiProviderName: ai?.provider ?? "offline",
    storage: storageBackend(),
    sharePoint: sharePointConfigured(),
    legalSystems,
    legalArticles,
    auditLogs,
    users,
    roles,
    permissions,
    attachments
  };
}

type ServiceState = "live" | "config" | "tenant";

export default async function AdminPage() {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const status = await getAdminStatus();

  const services: { label: string; state: ServiceState; detail: string; href?: string }[] = [
    { label: "إدارة المستخدمين", state: "live", detail: "إنشاء/تعديل دور/تفعيل — مُفعّلة", href: "/admin/users" },
    { label: "الصلاحيات المتقدمة (RBAC)", state: "live", detail: "محرّر مصفوفة الأدوار×الصلاحيات — مُفعّل", href: "/admin/roles" },
    { label: "مفاتيح API (البوابة الخارجية)", state: "live", detail: "إنشاء مفاتيح للأطراف الخارجية وأنظمة الذكاء — مُفعّلة", href: "/admin/api-keys" },
    {
      label: "تفعيل الذكاء الحقيقي",
      state: status.aiLive ? "live" : "config",
      detail: status.aiLive ? `مُفعّل عبر ${status.aiProviderName}` : "جاهز — اضبط المزوّد والمفتاح من إعدادات الذكاء",
      href: "/admin/ai"
    },
    {
      label: "رفع المرفقات",
      state: status.storage === "metadata-only" ? "config" : "live",
      detail: status.storage === "metadata-only" ? "يعمل بوضع metadata — اضبط Azure أو SharePoint لتخزين الملفات" : `مُفعّل عبر ${status.storage}`,
      href: "/dashboard/attachments"
    },
    {
      label: "ربط SharePoint",
      state: status.sharePoint ? "live" : "config",
      detail: status.sharePoint ? "متصل عبر Microsoft Graph" : "يتطلب ضبط SHAREPOINT_DRIVE_ID + اعتماد التطبيق"
    },
    { label: "ربط Microsoft 365 (تسجيل دخول SSO)", state: "tenant", detail: "يتطلب مستأجر Entra ID وتطبيق OAuth (تكامل مصادقة منفصل)" }
  ];

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">الإدارة والتقارير</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">لوحة الإدارة</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        لوحة حالة فعلية لخدمات المنصة وتكاملاتها. الحالة محسوبة من الإعداد الفعلي لا من نصّ ثابت.
      </p>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="قاعدة البيانات" value={status.database} />
        <StatusCard label="مزوّد الذكاء" value={status.aiLive ? status.aiProviderName : "offline/mock"} />
        <StatusCard label="تخزين المرفقات" value={status.storage} />
        <StatusCard label="المستخدمون" value={status.users.toLocaleString("ar-SA")} />
        <StatusCard label="الأدوار" value={status.roles.toLocaleString("ar-SA")} />
        <StatusCard label="الصلاحيات" value={status.permissions.toLocaleString("ar-SA")} />
        <StatusCard label="الأنظمة" value={status.legalSystems.toLocaleString("ar-SA")} />
        <StatusCard label="المواد" value={status.legalArticles.toLocaleString("ar-SA")} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-black/10 bg-white p-5 xl:col-span-2">
          <h2 className="text-xl font-bold text-olive">حالة الخدمات والتكاملات</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {services.map((s) => (
              <ServiceRow key={s.label} {...s} />
            ))}
          </div>
        </div>

        <div className="rounded-md border border-black/10 bg-white p-5">
          <h2 className="text-xl font-bold text-olive">روابط الإدارة</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AdminLink href="/admin/users" label="إدارة المستخدمين" />
            <AdminLink href="/admin/roles" label="الأدوار والصلاحيات" />
            <AdminLink href="/admin/api-keys" label="مفاتيح API" />
            <AdminLink href="/admin/ai" label="إعدادات الذكاء" />
            <AdminLink href="/admin/settings" label="مفاتيح التكامل (البحث/الذكاء/Google)" />
            <AdminLink href="/dashboard/attachments" label="المرفقات" />
            <AdminLink href="/audit-logs" label="سجل التدقيق" />
            <AdminLink href="/settings" label="إعدادات المنصة" />
          </div>
        </div>

        <div className="rounded-md border border-gold bg-sand p-5">
          <h2 className="text-xl font-bold text-olive">تنبيه MVP</h2>
          <p className="mt-3 leading-8 text-gray-700">
            المخرجات القانونية والتدريبية مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو حكمًا فعليًا. التكاملات المعلّمة بـ«يتطلب ضبط» تُفعَّل
            تلقائيًا عند إضافة متغيّرات البيئة المقابلة.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

const STATE_BADGE: Record<ServiceState, { text: string; cls: string }> = {
  live: { text: "مُفعّلة", cls: "bg-emerald-50 text-emerald-700" },
  config: { text: "تتطلب ضبطًا", cls: "bg-amber-50 text-amber-700" },
  tenant: { text: "تتطلب مستأجرًا", cls: "bg-gray-100 text-gray-500" }
};

function ServiceRow({ label, state, detail, href }: { label: string; state: ServiceState; detail: string; href?: string }) {
  const badge = STATE_BADGE[state];
  const body = (
    <div className="flex h-full flex-col rounded-md border border-black/10 bg-sand p-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-olive">{label}</span>
        <span className={`ms-auto rounded px-2 py-0.5 text-xs ${badge.cls}`}>{badge.text}</span>
      </div>
      <p className="mt-2 text-sm leading-7 text-gray-600">{detail}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="focus-ring block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
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
