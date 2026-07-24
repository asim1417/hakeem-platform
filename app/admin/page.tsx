import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import {
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";
import { getPlatformOverview } from "@/lib/modules/admin/platform-overview";
import { getAiStatus } from "@/lib/modules/ai/ai-config";
import { sharePointConfigured, storageBackend } from "@/lib/modules/attachments/blob-storage";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/modules/auth/role-admin";
import { auditSubjectLabel, auditActionLabel } from "@/lib/i18n/enum-labels";

export const dynamic = "force-dynamic";

async function getLegacyAdminStatus() {
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
    prisma.attachment.count().catch(() => 0),
  ]);
  const ai = await getAiStatus().catch(() => null);
  return {
    database,
    aiLive: Boolean(ai && ai.provider !== "offline" && ai.configured),
    aiProviderName: ai?.provider ?? "offline",
    storage: storageBackend(),
    sharePoint: sharePointConfigured(),
    microsoftSso: isMicrosoftOAuthConfigured(),
    googleSso: isGoogleOAuthConfigured(),
    legalSystems,
    legalArticles,
    auditLogs,
    users,
    roles,
    permissions,
    attachments,
  };
}

const AI_PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  offline: "غير متّصل",
};
const STORAGE_LABELS: Record<string, string> = {
  "metadata-only": "بيانات وصفيّة فقط",
  azure: "تخزين Azure",
  sharepoint: "SharePoint",
};

export default async function AdminPage() {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const user = await getCurrentUser();
  const showSuper = Boolean(user && isSuperAdmin(user) && isSuperAdminPanelEnabled());

  if (showSuper) {
    const overview = await getPlatformOverview();
    return (
      <AdminPageShell currentPath="/admin">
        <p className="text-sm font-semibold text-[#8B6914]">تشغيل المنصة</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">مركز الإدارة</h1>
        <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.75)]">
          هنا تدير المستخدمين والفوترة والتواصل والإعدادات. لتجربة العميل استخدم «نافذة المنصة» من الشريط العلوي.
        </p>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminLink href="/admin/inbox" label="صندوق المراسلات" />
          <AdminLink href="/admin/users" label="المستخدمون والأدوار" />
          <AdminLink href="/admin/billing" label="الفوترة والاشتراكات" />
          <AdminLink href="/admin/settings" label="إعدادات التشغيل" />
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="قاعدة البيانات" value={overview.database} />
          <Stat label="المستخدمون النشطون" value={`${overview.counts.usersActive} / ${overview.counts.usersTotal}`} />
          <Stat label="الذكاء" value={overview.ai.live ? AI_PROVIDER_LABELS[overview.ai.provider] ?? overview.ai.provider : "غير متّصل"} />
          <Stat label="المهام الجارية" value={String(overview.jobs.running)} />
          <Stat label="الأنظمة" value={overview.counts.legalSystems.toLocaleString("ar-SA")} />
          <Stat label="المواد" value={overview.counts.legalArticles.toLocaleString("ar-SA")} />
          <Stat label="الأحكام" value={overview.counts.judgments.toLocaleString("ar-SA")} />
          <Stat label="المبادئ" value={overview.counts.principles.toLocaleString("ar-SA")} />
          <Stat label="القضايا" value={overview.counts.cases.toLocaleString("ar-SA")} />
          <Stat label="الاستشارات" value={overview.counts.consultations.toLocaleString("ar-SA")} />
          <Stat label="المحاكاة" value={overview.counts.simulations.toLocaleString("ar-SA")} />
          <Stat label="أحداث التدقيق" value={overview.counts.auditLogs.toLocaleString("ar-SA")} />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
            <h2 className="text-xl font-bold text-[#0E3435]">توزيع الأدوار</h2>
            <ul className="mt-4 space-y-2">
              {Object.entries(overview.counts.roleCounts).map(([role, count]) => (
                <li key={role} className="flex justify-between text-sm text-[#0E3435]">
                  <span>{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</span>
                  <span className="font-semibold">{Number(count).toLocaleString("ar-SA")}</span>
                </li>
              ))}
              {Object.keys(overview.counts.roleCounts).length === 0 ? (
                <li className="text-sm text-[rgba(14,52,53,0.55)]">لا بيانات أدوار بعد.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
            <h2 className="text-xl font-bold text-[#0E3435]">المهام الخلفية</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="الإجمالي" value={String(overview.jobs.total)} />
              <Stat label="جارية" value={String(overview.jobs.running)} />
              <Stat label="مكتملة" value={String(overview.jobs.done)} />
              <Stat label="فاشلة" value={String(overview.jobs.error)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/admin/jobs" className="text-sm font-semibold text-[#8B6914] hover:text-[#0E3435]">
                تشغيل المهام ←
              </Link>
              <Link href="/admin/billing" className="text-sm font-semibold text-[#8B6914] hover:text-[#0E3435]">
                الفوترة ←
              </Link>
            </div>
          </div>

          <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-[#0E3435]">آخر أحداث التدقيق</h2>
              <Link href="/admin/audit" className="text-sm font-semibold text-[#8B6914]">
                عرض المزيد
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-[rgba(14,52,53,0.08)]">
              {overview.recentAudit.length === 0 ? (
                <li className="py-3 text-sm text-[rgba(14,52,53,0.55)]">لا أحداث بعد.</li>
              ) : (
                overview.recentAudit.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                    <span className="font-semibold text-[#0E3435]">
                      {auditSubjectLabel(ev.subject)} · {auditActionLabel(ev.action)}
                    </span>
                    <span className="text-[rgba(14,52,53,0.55)]">
                      {ev.actor?.name || "نظام"} · {new Date(ev.createdAt).toLocaleString("ar-SA")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-[#0E3435]">أدوات إضافية</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminLink href="/admin/services" label="ظهور الخدمات للعملاء" />
            <AdminLink href="/admin/jobs" label="المهام الخلفية" />
            <AdminLink href="/admin/reports" label="بلاغات الأخطاء" />
            <AdminLink href="/admin/ai" label="إعدادات الذكاء" />
            <AdminLink href="/dashboard/legal-core/admin" label="المحتوى القانوني" />
            <AdminLink href="/admin/api-keys" label="مفاتيح API" />
            <AdminLink href="/admin/roles" label="مصفوفة الصلاحيات" />
            <AdminLink href="/admin/audit" label="سجل التدقيق" />
          </div>
        </section>
      </AdminPageShell>
    );
  }

  // مدير النظام / من يملك ADMIN_REPORTS_VIEW — اللوحة القائمة دون أقسام السوبر
  const status = await getLegacyAdminStatus();
  return (
    <AdminPageShell currentPath="/admin">
      <p className="text-sm font-semibold text-gold">الإدارة والتقارير</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">لوحة الإدارة</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        لوحة حالة فعلية لخدمات المنصة وتكاملاتها. الحالة محسوبة من الإعداد الفعلي لا من نصّ ثابت.
      </p>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="قاعدة البيانات" value={status.database} />
        <Stat label="مزوّد الذكاء" value={status.aiLive ? AI_PROVIDER_LABELS[status.aiProviderName] ?? status.aiProviderName : "غير متّصل"} />
        <Stat label="تخزين المرفقات" value={STORAGE_LABELS[status.storage] ?? status.storage} />
        <Stat label="المستخدمون" value={status.users.toLocaleString("ar-SA")} />
        <Stat label="الأدوار" value={status.roles.toLocaleString("ar-SA")} />
        <Stat label="الصلاحيات" value={status.permissions.toLocaleString("ar-SA")} />
        <Stat label="الأنظمة" value={status.legalSystems.toLocaleString("ar-SA")} />
        <Stat label="المواد" value={status.legalArticles.toLocaleString("ar-SA")} />
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminLink href="/admin/users" label="إدارة المستخدمين" />
        <AdminLink href="/admin/roles" label="الأدوار والصلاحيات" />
        <AdminLink href="/admin/api-keys" label="مفاتيح API" />
        <AdminLink href="/admin/owner" label="المدراء" />
        <AdminLink href="/audit-logs" label="سجل التدقيق" />
        <AdminLink href="/dashboard/legal-core/admin" label="إدارة المحتوى القانوني" />
        <AdminLink href="/dashboard/attachments" label="المرفقات" />
      </section>
    </AdminPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
      <p className="text-sm text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-[#0E3435]">{value}</p>
    </div>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="focus-ring rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] px-4 py-3 font-semibold text-[#0E3435] hover:bg-[#F7F2EA]"
    >
      {label}
    </Link>
  );
}
