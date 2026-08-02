import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { getServiceProfitability } from "@/lib/modules/billing/profitability";
import { formatSar } from "@/config/pricing";

export const dynamic = "force-dynamic";

export default async function AdminProfitabilityPage() {
  await requireSuperAdminPage();
  const overview = await getServiceProfitability();

  const fmtInt = (n: number) => Math.round(n).toLocaleString("ar-SA");
  const fmtPct = (fraction: number) => `${(fraction * 100).toFixed(1)}٪`;

  return (
    <AdminPageShell currentPath="/admin/billing/profitability">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن · الفوترة</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">ربحية الخدمات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        مقارنة تكلفة Claude الفعلية بالنقاط المحصّلة لكل خدمة، مع الطلبات ومتوسطات التوكنات والزمن ونسبة
        الأخطاء. للعودة إلى{" "}
        <Link href="/admin/billing" className="font-semibold text-[#8B6914]">
          نظرة الفوترة
        </Link>
        .
      </p>

      <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        أرقام داخلية — لا تُعرض للمستخدم.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
          <p className="text-sm text-[rgba(14,52,53,0.55)]">إجمالي تكلفة Claude</p>
          <p className="mt-2 text-xl font-bold text-[#0E3435]">{formatSar(overview.totalProviderCostSar)}</p>
        </div>
        <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
          <p className="text-sm text-[rgba(14,52,53,0.55)]">إجمالي النقاط المحصّلة</p>
          <p className="mt-2 text-xl font-bold text-[#0E3435]">
            {overview.totalChargedPoints.toLocaleString("ar-SA")}
          </p>
        </div>
        <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
          <p className="text-sm text-[rgba(14,52,53,0.55)]">عدد الخدمات المرصودة</p>
          <p className="mt-2 text-xl font-bold text-[#0E3435]">
            {overview.services.length.toLocaleString("ar-SA")}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">التفصيل لكل خدمة</h2>
        </div>
        {overview.services.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">
            لا بيانات استخدام بعد، أو جدول ai_usage_events غير مهيّأ.
          </p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>الخدمة</th>
                  <th>الطلبات</th>
                  <th>متوسط التوكنات</th>
                  <th>متوسط الزمن (م.ث)</th>
                  <th>نسبة الأخطاء</th>
                  <th>تكلفة Claude</th>
                  <th>النقاط المحصّلة</th>
                </tr>
              </thead>
              <tbody>
                {overview.services.map((s) => (
                  <tr key={s.serviceKey} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                      {s.serviceKey}
                    </td>
                    <td className="px-4 py-3">{fmtInt(s.requests)}</td>
                    <td className="px-4 py-3">{fmtInt(s.avgTokens)}</td>
                    <td className="px-4 py-3">{fmtInt(s.avgLatencyMs)}</td>
                    <td className="px-4 py-3">
                      <span className={s.errorRate > 0.05 ? "font-semibold text-[#8B1A1A]" : ""}>
                        {fmtPct(s.errorRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatSar(s.providerCostSar)}</td>
                    <td className="px-4 py-3 font-semibold text-[#0E3435]">
                      {s.chargedPoints.toLocaleString("ar-SA")}
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
