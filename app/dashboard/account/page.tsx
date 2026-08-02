import { Wallet, ReceiptText, BarChart3, CreditCard, RefreshCw } from "lucide-react";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { getActiveSubscription } from "@/lib/modules/billing/subscriptions";
import { Card, CardGrid, Hero, SectionTitle } from "@/components/ui/design-system";
import { SEED_PLANS } from "@/config/billing-plans";
import { roleLabel } from "@/lib/i18n/enum-labels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الحساب — حكيم",
};

function planNameAr(planCode: string | null): string {
  if (!planCode) return "التجربة المجانية";
  const plan = SEED_PLANS.find((p) => p.code === planCode.toUpperCase());
  return plan?.nameAr ?? planCode;
}

export default async function AccountHubPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser();
  const sub = user ? await getActiveSubscription(user.id).catch(() => null) : null;

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="مركز الحساب"
        lede="رصيدك بالنقاط، سجل الاستخدام، الفواتير، الاشتراك، ووسائل الدفع — كلّها من مكان واحد."
      />

      <section className="mt-6 rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]">
        <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">تفاصيل الحساب</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الاسم</dt>
            <dd className="font-semibold text-[var(--navy)]">{user?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">البريد</dt>
            <dd className="font-mono-legal text-xs" dir="ltr">
              {user?.email ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الدور</dt>
            <dd className="font-semibold text-[var(--navy)]">{roleLabel(user?.role)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الباقة الحالية</dt>
            <dd className="font-semibold text-[var(--navy)]">{planNameAr(sub?.planCode ?? null)}</dd>
          </div>
        </dl>
      </section>

      <SectionTitle>إدارة الحساب</SectionTitle>
      <CardGrid>
        <Card
          href="/dashboard/account/billing"
          icon={Wallet}
          title="الرصيد والمحفظة"
          description="إجمالي النقاط، المتاح منها، وتوزيعها حسب المصدر، مع الشحن والترقية."
        />
        <Card
          href="/dashboard/account/usage"
          icon={BarChart3}
          title="سجل الاستخدام"
          description="حركات الخصم والإضافة مع التصفية والتصدير إلى CSV."
        />
        <Card
          href="/dashboard/account/invoices"
          icon={ReceiptText}
          title="الفواتير"
          description="فواتيرك الضريبية مع الحالة ورابط النسخة PDF."
        />
        <Card
          href="/dashboard/account/subscription"
          icon={RefreshCw}
          title="الاشتراك"
          description="خطتك الحالية وتاريخ التجديد وخيارات التغيير والإلغاء."
          badge={planNameAr(sub?.planCode ?? null)}
        />
        <Card
          href="/dashboard/account/payment-methods"
          icon={CreditCard}
          title="وسائل الدفع"
          description="بطاقاتك المحفوظة، تعيين الافتراضية، وحذف ما لا تحتاجه."
        />
      </CardGrid>
    </div>
  );
}
