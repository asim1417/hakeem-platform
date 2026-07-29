import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { getUsageReport } from "@/lib/modules/billing/usage-report";

export const dynamic = "force-dynamic";

type Search = { status?: string; q?: string };

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  await requireSuperAdminPage();
  const status = (searchParams?.status || "all").trim();
  const q = (searchParams?.q || "").trim();
  const report = await getUsageReport({ status, q, limit: 500 });
  const { summary, users } = report;

  const exportQs = new URLSearchParams();
  if (status && status !== "all") exportQs.set("status", status);
  if (q) exportQs.set("q", q);
  exportQs.set("limit", "2000");
  const exportHref = `/api/admin/usage/export?${exportQs.toString()}`;

  return (
    <AdminPageShell currentPath="/admin/usage">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">تقرير الاستهلاك</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        حصر استهلاك جميع المستخدمين من الحصّة المجانية ورصيد النقاط وحالة الاشتراك. الحد الافتراضي
        للتجربة المجانية: {summary.freeQuotaDefault.toLocaleString("ar-SA")} استخدامًا (
        <code className="text-xs">FREE_QUOTA</code>).
      </p>

      {!summary.quotaColumnsReady ? (
        <p className="mt-4 rounded-md border border-[#B42318]/25 bg-[#FFF5F5] px-4 py-3 text-sm text-[#B42318]">
          أعمدة الحصّة غير جاهزة في القاعدة بعد — يُعرض المستخدمون بلا أرقام استهلاك دقيقة.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي المستخدمين" value={summary.usersTotal} />
        <Stat label="نشطون" value={summary.activeUsers} />
        <Stat label="مشتركون" value={summary.subscribedActive} />
        <Stat label="تجربة مجانية" value={summary.freeUsers} />
        <Stat label="حصّة مستنفدة" value={summary.quotaExhausted} />
        <Stat label="مجموع الاستهلاك" value={summary.totalQuotaUsed} />
        <Stat label="رصيد النقاط الكلي" value={summary.totalCreditsBalance} />
        <Stat label="صفوف في الجدول" value={users.length} />
      </section>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[#0E3435]">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.14)] bg-white px-3 text-[#0E3435]"
          >
            <option value="all">الكل</option>
            <option value="free">تجربة مجانية</option>
            <option value="active">مشتركون</option>
            <option value="exhausted">حصّة مستنفدة</option>
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-semibold text-[#0E3435]">بحث (اسم أو بريد)</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="مثال: user@example.com"
            className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.14)] bg-white px-3 text-[#0E3435]"
            dir="ltr"
          />
        </label>
        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-[#0E3435] px-4 text-sm font-semibold text-[#FFFcf7]"
        >
          تطبيق
        </button>
        <a
          href={exportHref}
          className="min-h-[44px] rounded-md border border-[#C9A84C] bg-white px-4 text-sm font-semibold text-[#0E3435] inline-flex items-center"
        >
          تصدير CSV
        </a>
        <Link
          href="/admin/billing"
          className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[#8B6914]"
        >
          ← الفوترة
        </Link>
      </form>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">المستخدمون حسب الاستهلاك</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            مرتّبون تنازليًا حسب استخدام الحصّة · أقصى 500 صف في الصفحة (التصدير حتى 2000)
          </p>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا مستخدمين مطابقين للمرشّح.</p>
        ) : (
          <div className="table-scroll overflow-auto">
            <table className="w-full min-w-[880px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الاشتراك</th>
                  <th>الحصّة</th>
                  <th>النقاط</th>
                  <th>الحساب</th>
                  <th>تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0E3435]">{u.name || "—"}</p>
                      <p className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                        {u.email || u.id}
                      </p>
                    </td>
                    <td className="px-4 py-3">{u.role || "—"}</td>
                    <td className="px-4 py-3">
                      {u.subscriptionStatus === "active" ? (
                        <span className="font-semibold text-[#0E3435]">مشترك</span>
                      ) : u.exhausted ? (
                        <span className="font-semibold text-[#B42318]">مستنفد</span>
                      ) : (
                        <span>مجاني</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.freeQuotaUsed.toLocaleString("ar-SA")} /{" "}
                      {u.freeQuotaTotal.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-3">{u.creditsBalance.toLocaleString("ar-SA")}</td>
                    <td className="px-4 py-3">{u.isActive ? "نشط" : "موقوف"}</td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
      <p className="text-sm text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#0E3435]">{value.toLocaleString("ar-SA")}</p>
    </div>
  );
}
