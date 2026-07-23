import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminBillingUserActions } from "@/components/admin/AdminBillingActions";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { getBillingAdminOverview } from "@/lib/modules/billing/admin-overview";
import { formatSar } from "@/config/pricing";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  await requireSuperAdminPage();
  const overview = await getBillingAdminOverview();

  return (
    <AdminPageShell currentPath="/admin/billing">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">الفوترة والاشتراكات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        نظرة تشغيلية على الاشتراكات والحصص والنقاط فوق البنية الحالية (Moyasar + quota + credits) — بلا
        مسار دفع موازٍ.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="بوابة Moyasar"
          value={overview.moyasarLive ? "مفعّلة" : "غير مهيّأة"}
        />
        <Card label="مشتركون نشطون" value={overview.counts.subscribedActive.toLocaleString("ar-SA")} />
        <Card label="مجاني / غير مشترك" value={overview.counts.freeOrUnknown.toLocaleString("ar-SA")} />
        <Card label="حصّة مستنفدة" value={overview.counts.quotaExhausted.toLocaleString("ar-SA")} />
        <Card label="إجمالي المستخدمين" value={overview.counts.usersTotal.toLocaleString("ar-SA")} />
        <Card label="رصيد النقاط الكلي" value={overview.credits.totalBalance.toLocaleString("ar-SA")} />
        <Card label="الحصّة الافتراضية" value={String(overview.freeQuotaDefault)} />
        <Card
          label="إعدادات الدفع"
          value="Moyasar"
          href="/admin/settings"
        />
      </section>

      <section className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
        <h2 className="text-xl font-bold text-[#0E3435]">الخطط المعتمدة</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {overview.plans.map((p) => (
            <li key={p.id} className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white p-4">
              <p className="font-semibold text-[#0E3435]">{p.nameAr}</p>
              <p className="mt-1 text-sm text-[rgba(14,52,53,0.65)]">
                شهري: {formatSar(p.monthlySar)} · سنوي: {formatSar(p.yearlySar)}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[rgba(14,52,53,0.55)]">
          صفحة المستخدم:{" "}
          <Link href="/dashboard/subscribe" className="font-semibold text-[#8B6914]">
            /dashboard/subscribe
          </Link>
        </p>
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">أعلى استهلاك للحصّة (غير مشتركين)</h2>
        </div>
        {overview.topQuotaUsers.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا بيانات حصّة بعد (أو الهجرة غير مطبّقة).</p>
        ) : (
          <div className="table-scroll overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>المستخدم</th>
                  <th>الحصّة</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {overview.topQuotaUsers.map((u) => {
                  const total = u.freeQuotaTotal ?? overview.freeQuotaDefault;
                  const active = u.subscriptionStatus === "active";
                  return (
                    <tr key={u.id} className="border-t border-[rgba(14,52,53,0.06)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0E3435]">{u.name || "—"}</p>
                        <p className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {u.freeQuotaUsed.toLocaleString("ar-SA")} / {total.toLocaleString("ar-SA")}
                      </td>
                      <td className="px-4 py-3">{active ? "مشترك" : "مجاني"}</td>
                      <td className="px-4 py-3">
                        <AdminBillingUserActions userId={u.id} isActive={active} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">آخر حركات النقاط</h2>
        </div>
        {overview.credits.recentTx.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا حركات نقاط بعد.</p>
        ) : (
          <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
            {overview.credits.recentTx.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-semibold text-[#0E3435]" dir="ltr">
                  {tx.email || tx.userId.slice(0, 8)}
                </span>
                <span className="text-[rgba(14,52,53,0.65)]">{tx.source}</span>
                <span className="font-semibold text-[#0E3435]">
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </span>
                <span className="text-xs text-[rgba(14,52,53,0.5)]">
                  {new Date(tx.createdAt).toLocaleString("ar-SA")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}

function Card({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-sm text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#0E3435]">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4 transition hover:border-[#C9A84C]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">{inner}</div>
  );
}
