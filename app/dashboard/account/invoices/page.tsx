import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { Hero } from "@/components/ui/design-system";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الفواتير — حكيم",
};

const TYPE_LABELS: Record<string, string> = {
  TAX_INVOICE: "فاتورة ضريبية",
  SIMPLIFIED_TAX_INVOICE: "فاتورة ضريبية مبسّطة",
  CREDIT_NOTE: "إشعار دائن",
  DEBIT_NOTE: "إشعار مدين",
};

const ZATCA_LABELS: Record<string, string> = {
  NOT_APPLICABLE: "لا ينطبق",
  PENDING: "قيد المعالجة",
  CLEARED: "مُعتمدة",
  REPORTED: "مُبلَّغة",
  REJECTED: "مرفوضة",
};

const STATUS_LABELS: Record<string, string> = {
  ISSUED: "صادرة",
  PAID: "مدفوعة",
  VOID: "ملغاة",
  REFUNDED: "مستردّة",
};

const ar = (n: number) => n.toLocaleString("ar-SA");

export default async function InvoicesPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser();

  const { prisma } = await import("@/lib/prisma");
  const invoices = user
    ? await prisma.invoice
        .findMany({
          where: { userId: user.id },
          orderBy: { issuedAt: "desc" },
          take: 100,
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            status: true,
            totalHalalas: true,
            issuedAt: true,
            pdfUrl: true,
            zatcaStatus: true,
          },
        })
        .catch(() => [])
    : [];

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="الفواتير"
        lede="فواتيرك الضريبية مع الحالة والمبلغ ورابط النسخة PDF."
      />

      {invoices.length === 0 ? (
        <p className="mt-6 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-60)]">
          لا توجد فواتير بعد — ستظهر هنا بعد أول عملية شراء أو اشتراك.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--ink-08)] text-right text-[var(--ink-60)]">
                <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="px-4 py-3 font-semibold">المبلغ</th>
                <th className="px-4 py-3 font-semibold">التاريخ</th>
                <th className="px-4 py-3 font-semibold">الحالة</th>
                <th className="px-4 py-3 font-semibold">هيئة الزكاة</th>
                <th className="px-4 py-3 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--ink-04)] last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono-legal text-xs text-[var(--navy)]" dir="ltr">
                    {inv.invoiceNumber}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                    {TYPE_LABELS[inv.type] ?? inv.type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--navy)]">
                    {ar(inv.totalHalalas / 100)} ر.س
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                    {new Date(inv.issuedAt).toLocaleDateString("ar-SA")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                    {ZATCA_LABELS[inv.zatcaStatus] ?? inv.zatcaStatus}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring font-semibold text-[var(--petrol)] underline"
                      >
                        تنزيل
                      </a>
                    ) : (
                      <span className="text-[var(--ink-40)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
