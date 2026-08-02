import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { formatSar } from "@/config/pricing";
import { ApproveRefundButton } from "./ApproveRefundButton";

export const dynamic = "force-dynamic";

const sar = (halalas: number) => formatSar(halalas / 100);

export default async function AdminPaymentsPage() {
  await requireSuperAdminPage();

  const { prisma } = await import("@/lib/prisma");
  const [payments, orders, pendingRefunds] = await Promise.all([
    prisma.payment
      .findMany({ include: { order: true }, orderBy: { createdAt: "desc" }, take: 40 })
      .catch(() => []),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 40 }).catch(() => []),
    prisma.refund
      .findMany({
        where: { status: "PENDING" },
        include: { payment: { include: { order: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      })
      .catch(() => []),
  ]);

  return (
    <AdminPageShell currentPath="/admin/billing/payments">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن · الفوترة</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">المدفوعات والطلبات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        أحدث المدفوعات والطلبات المالية، والاستردادات المعلّقة بانتظار الاعتماد. المبالغ بالريال شاملة
        الضريبة. للعودة إلى{" "}
        <Link href="/admin/billing" className="font-semibold text-[#8B6914]">
          نظرة الفوترة
        </Link>
        .
      </p>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">استردادات معلّقة</h2>
        </div>
        {pendingRefunds.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا استردادات معلّقة.</p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>المبلغ</th>
                  <th>السبب</th>
                  <th>الطلب</th>
                  <th>التاريخ</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {pendingRefunds.map((r) => (
                  <tr key={r.id} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3 font-semibold text-[#0E3435]">{sar(r.amountHalalas)}</td>
                    <td className="px-4 py-3 text-[rgba(14,52,53,0.7)]">{r.reason || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                      {r.payment?.order?.id?.slice(0, 12) || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {new Date(r.createdAt).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-3">
                      <ApproveRefundButton refundId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">أحدث المدفوعات</h2>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا مدفوعات بعد.</p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>الحالة</th>
                  <th>المبلغ</th>
                  <th>البوابة</th>
                  <th>معرّف الدفعة</th>
                  <th>الطلب</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                      {p.status}
                    </td>
                    <td className="px-4 py-3">{sar(p.amountHalalas)}</td>
                    <td className="px-4 py-3 text-[rgba(14,52,53,0.7)]" dir="ltr">
                      {p.provider}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                      {p.providerPaymentId || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                      {p.order?.type || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {new Date(p.createdAt).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">أحدث الطلبات</h2>
        </div>
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا طلبات بعد.</p>
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead className="bg-[#F7F2EA]">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>الإجمالي</th>
                  <th>نقاط ممنوحة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3 font-semibold text-[#0E3435]" dir="ltr">
                      {o.type}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {o.status}
                    </td>
                    <td className="px-4 py-3">{sar(o.totalHalalas)}</td>
                    <td className="px-4 py-3">
                      {o.pointsGranted != null ? o.pointsGranted.toLocaleString("ar-SA") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {new Date(o.createdAt).toLocaleString("ar-SA")}
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
