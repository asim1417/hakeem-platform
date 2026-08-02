import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { formatSar } from "@/config/pricing";
import { SEED_PLANS } from "@/config/billing-plans";

export const dynamic = "force-dynamic";

const sar = (halalas: number | null | undefined) =>
  halalas == null ? "عرض سعر" : formatSar(halalas / 100);

export default async function AdminPlansPage() {
  await requireSuperAdminPage();

  const { prisma } = await import("@/lib/prisma");
  const plans = await prisma.plan
    .findMany({
      include: { prices: { where: { isActive: true } } },
      orderBy: { sortOrder: "asc" },
    })
    .catch(() => []);

  return (
    <AdminPageShell currentPath="/admin/billing/plans">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن · الفوترة</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">الخطط والأسعار</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        عرض الخطط الحيّة وأسعارها النشطة (شامل الضريبة). تعديل الخطط والأسعار مهمة لاحقة — هذه الصفحة
        للاطلاع فقط. للعودة إلى{" "}
        <Link href="/admin/billing" className="font-semibold text-[#8B6914]">
          نظرة الفوترة
        </Link>
        .
      </p>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">الخطط الحيّة (قاعدة البيانات)</h2>
        </div>
        {plans.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">
            لا خطط مبذورة بعد في قاعدة البيانات — راجع بذر الخطط أدناه.
          </p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>نقاط شهرية</th>
                  <th>مقاعد</th>
                  <th>شهري</th>
                  <th>سنوي</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const monthly = p.prices.find((x) => x.billingPeriod === "MONTHLY");
                  const yearly = p.prices.find((x) => x.billingPeriod === "YEARLY");
                  return (
                    <tr key={p.id} className="border-t border-[rgba(14,52,53,0.06)]">
                      <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                        {p.code}
                      </td>
                      <td className="px-4 py-3 text-[#0E3435]">{p.nameAr}</td>
                      <td className="px-4 py-3">{p.monthlyPoints.toLocaleString("ar-SA")}</td>
                      <td className="px-4 py-3">{p.includedSeats.toLocaleString("ar-SA")}</td>
                      <td className="px-4 py-3">
                        {monthly ? sar(monthly.totalHalalas) : "—"}
                        {monthly ? (
                          <span className="mr-1 text-xs text-[rgba(14,52,53,0.5)]">شامل الضريبة</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {yearly ? sar(yearly.totalHalalas) : "—"}
                        {yearly ? (
                          <span className="mr-1 text-xs text-[rgba(14,52,53,0.5)]">شامل الضريبة</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {p.isActive ? (
                          <span className="text-[#0E3435]">مفعّلة</span>
                        ) : (
                          <span className="text-[rgba(14,52,53,0.5)]">معطّلة</span>
                        )}
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
          <h2 className="text-lg font-bold text-[#0E3435]">مرجع بذر الخطط (مصدر الحقيقة)</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            من <code dir="ltr">config/billing-plans.ts</code> — القيم الأولية التي تُبذر بها الخطط.
          </p>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-right text-sm">
            <thead className="bg-[#F7F2EA]">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                <th>الرمز</th>
                <th>الاسم</th>
                <th>نقاط شهرية</th>
                <th>مقاعد</th>
                <th>شهري</th>
                <th>سنوي</th>
              </tr>
            </thead>
            <tbody>
              {SEED_PLANS.map((p) => (
                <tr key={p.code} className="border-t border-[rgba(14,52,53,0.06)]">
                  <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                    {p.code}
                  </td>
                  <td className="px-4 py-3 text-[#0E3435]">{p.nameAr}</td>
                  <td className="px-4 py-3">{p.monthlyPoints.toLocaleString("ar-SA")}</td>
                  <td className="px-4 py-3">{p.includedSeats.toLocaleString("ar-SA")}</td>
                  <td className="px-4 py-3">
                    {p.isQuoteOnly ? "عرض سعر" : sar(p.monthlyTotalHalalas)}
                  </td>
                  <td className="px-4 py-3">
                    {p.isQuoteOnly ? "عرض سعر" : sar(p.yearlyTotalHalalas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageShell>
  );
}
