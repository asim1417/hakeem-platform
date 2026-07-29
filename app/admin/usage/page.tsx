import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getUsageReport } from "@/lib/modules/billing/usage-report";

export const dynamic = "force-dynamic";

type Search = { status?: string; q?: string; sort?: string };

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const status = (searchParams?.status || "all").trim();
  const q = (searchParams?.q || "").trim();
  const sort = (searchParams?.sort || "activity").trim();
  const report = await getUsageReport({ status, q, sort, limit: 500 });
  const { summary, users } = report;

  const exportQs = new URLSearchParams();
  if (status && status !== "all") exportQs.set("status", status);
  if (q) exportQs.set("q", q);
  if (sort) exportQs.set("sort", sort);
  exportQs.set("limit", "2000");
  const exportHref = `/api/admin/usage/export?${exportQs.toString()}`;

  return (
    <AdminPageShell currentPath="/admin/usage">
      <p className="text-sm font-semibold text-[#8B6914]">الإدارة والتقارير</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">لوحة الاستهلاك</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        نظرة كاملة على الاستخدام الفعلي: الحصّة المجانية، النقاط، الاستشارات، المحاكاة، اسأل حكيم،
        وأحداث الذكاء. لرصد{" "}
        <Link href="/admin/usage/week" className="font-semibold text-[#8B6914] underline underline-offset-4">
          الأسبوع الماضي ببيانات مؤكّدة فقط
        </Link>
        ، أو اضغط على مستخدم للتفاصيل. حد التجربة:{" "}
        {summary.freeQuotaDefault.toLocaleString("ar-SA")} (
        <code className="text-xs">FREE_QUOTA</code>).
      </p>

      {!summary.quotaColumnsReady ? (
        <p className="mt-4 rounded-md border border-[#B42318]/25 bg-[#FFF5F5] px-4 py-3 text-sm text-[#B42318]">
          أعمدة الحصّة غير جاهزة في القاعدة بعد — أرقام الحصّة قد تكون صفرًا.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="المستخدمون" value={summary.usersTotal} />
        <Stat label="نشطون (حساب)" value={summary.activeUsers} />
        <Stat label="لديهم نشاط" value={summary.usersWithActivity} />
        <Stat label="مشتركون" value={summary.subscribedActive} />
        <Stat label="تجربة مجانية" value={summary.freeUsers} />
        <Stat label="حصّة مستنفدة" value={summary.quotaExhausted} />
        <Stat label="مجموع الحصّة" value={summary.totalQuotaUsed} />
        <Stat label="رصيد النقاط" value={summary.totalCreditsBalance} />
        <Stat label="نقاط مخصومة" value={summary.totalCreditsSpent} />
        <Stat label="استشارات" value={summary.totalConsultations} />
        <Stat label="محاكاة" value={summary.totalSimulations} />
        <Stat label="محادثات اسأل" value={summary.totalAskConversations} />
        <Stat label="أحداث ذكاء" value={summary.totalAiEvents} />
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
            <option value="active_users">نشاط فعلي فقط</option>
            <option value="free">تجربة مجانية</option>
            <option value="active">مشتركون</option>
            <option value="exhausted">حصّة مستنفدة</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[#0E3435]">ترتيب</span>
          <select
            name="sort"
            defaultValue={sort}
            className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.14)] bg-white px-3 text-[#0E3435]"
          >
            <option value="activity">الأكثر نشاطًا</option>
            <option value="quota">الحصّة</option>
            <option value="credits">النقاط المخصومة</option>
            <option value="recent">آخر نشاط</option>
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-semibold text-[#0E3435]">بحث (اسم أو بريد)</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="user@example.com"
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
          className="inline-flex min-h-[44px] items-center rounded-md border border-[#C9A84C] bg-white px-4 text-sm font-semibold text-[#0E3435]"
        >
          تصدير CSV
        </a>
      </form>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">الاستخدام الفعلي لكل مستخدم</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            اضغط الصف لفتح لوحة التفاصيل · أقصى 500 في الصفحة · التصدير حتى 2000
          </p>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا مستخدمين مطابقين.</p>
        ) : (
          <div className="table-scroll overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:font-semibold">
                  <th>المستخدم</th>
                  <th>الحصّة</th>
                  <th>النقاط</th>
                  <th>استشارات</th>
                  <th>محاكاة</th>
                  <th>اسأل</th>
                  <th>ذكاء</th>
                  <th>النشاط</th>
                  <th>آخر نشاط</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[rgba(14,52,53,0.06)] hover:bg-[#F7F2EA]/50">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/usage/${encodeURIComponent(u.id)}`}
                        className="font-semibold text-[#0E3435] underline-offset-2 hover:underline"
                      >
                        {u.name || "—"}
                      </Link>
                      <p className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                        {u.email || u.id}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {u.freeQuotaUsed.toLocaleString("ar-SA")} /{" "}
                      {u.freeQuotaTotal.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-3">
                      <span>{u.creditsBalance.toLocaleString("ar-SA")}</span>
                      {u.creditsSpent > 0 ? (
                        <span className="mt-0.5 block text-xs text-[rgba(14,52,53,0.5)]">
                          خُصم {u.creditsSpent.toLocaleString("ar-SA")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{u.consultations.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3">{u.simulations.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3">{u.askConversations.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3">{u.aiEvents.toLocaleString("ar-SA")}</td>
                    <td className="px-3 py-3 font-semibold text-[#0E3435]">
                      {u.activityScore.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {u.lastActiveAt
                        ? new Date(u.lastActiveAt).toLocaleString("ar-SA")
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {u.subscriptionStatus === "active" ? (
                        <span className="font-semibold">مشترك</span>
                      ) : u.exhausted ? (
                        <span className="font-semibold text-[#B42318]">مستنفد</span>
                      ) : (
                        <span>مجاني</span>
                      )}
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
