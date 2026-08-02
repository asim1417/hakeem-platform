import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { milliToPoints } from "@/lib/modules/credits/points";
import { SEED_SERVICE_RATES } from "@/config/billing-plans";
import { ServiceRateEditor } from "./ServiceRateEditor";

export const dynamic = "force-dynamic";

type RateRow = {
  serviceCode: string;
  milliUnits: bigint | number;
  active: boolean;
  version: number | null;
  displayNameAr: string | null;
};

const SEED_LABELS = new Map(SEED_SERVICE_RATES.map((r) => [r.serviceCode, r.displayNameAr]));

export default async function AdminServiceRatesPage() {
  await requireSuperAdminPage();

  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma
    .$queryRawUnsafe<RateRow[]>(
      `SELECT "serviceCode","milliUnits","active","version","displayNameAr"
         FROM "usage_service_prices" ORDER BY "serviceCode"`
    )
    .catch(() => [] as RateRow[]);

  return (
    <AdminPageShell currentPath="/admin/billing/service-rates">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن · الفوترة</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">أسعار الخدمات بالنقاط</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        سعر كل خدمة بالنقاط (النقطة = ١٠٠٠ وحدة). عدّل السعر بسبب إلزامي؛{" "}
        <span className="font-semibold text-[#0E3435]">التعديل لا يؤثر رجعيًا</span> — السجلات السابقة
        تحفظ إصدار سعرها. للعودة إلى{" "}
        <Link href="/admin/billing" className="font-semibold text-[#8B6914]">
          نظرة الفوترة
        </Link>
        .
      </p>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">جدول الأسعار الحيّة</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.55)]">
            المصدر: جدول <code dir="ltr">usage_service_prices</code>.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">
            لا أسعار خدمات بعد، أو جدول usage_service_prices غير مهيّأ.
          </p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>رمز الخدمة</th>
                  <th>الاسم</th>
                  <th>النقاط الحالية</th>
                  <th>الإصدار</th>
                  <th>الحالة</th>
                  <th>تعديل</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const points = milliToPoints(Number(r.milliUnits));
                  const label = r.displayNameAr || SEED_LABELS.get(r.serviceCode) || r.serviceCode;
                  return (
                    <tr key={r.serviceCode} className="border-t border-[rgba(14,52,53,0.06)] align-top">
                      <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                        {r.serviceCode}
                      </td>
                      <td className="px-4 py-3 text-[#0E3435]">{label}</td>
                      <td className="px-4 py-3 font-semibold text-[#0E3435]">
                        {points.toLocaleString("ar-SA")}
                      </td>
                      <td className="px-4 py-3 text-[rgba(14,52,53,0.65)]">
                        {Number(r.version ?? 1).toLocaleString("ar-SA")}
                      </td>
                      <td className="px-4 py-3">
                        {r.active ? (
                          <span className="text-[#0E3435]">مفعّلة</span>
                        ) : (
                          <span className="text-[rgba(14,52,53,0.5)]">معطّلة</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ServiceRateEditor serviceCode={r.serviceCode} currentPoints={points} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        ملاحظة: تعديل السعر يرفع الإصدار ويُسجَّل في سجل التدقيق. لا يؤثر رجعيًا على أي استهلاك سابق.
      </p>
    </AdminPageShell>
  );
}
