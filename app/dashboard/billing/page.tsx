import Link from "next/link";
import { CreditCard, Sparkles, Gavel, MessageSquareText } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { isPaidCheckoutUiEnabled } from "@/lib/modules/billing/checkout-visibility";
import { BillingStatusCard } from "@/components/billing/BillingStatusCard";
import { Card, CardGrid, Hero, SectionTitle } from "@/components/ui/design-system";
import { PRICING } from "@/config/pricing";
import { roleLabel } from "@/lib/i18n/enum-labels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الحساب والرصيد — حكيم",
};

export default async function BillingDashboardPage() {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
  const paidUi = isPaidCheckoutUiEnabled();
  const status = await getStatus(user.id).catch(() => ({
    total: PRICING.freeQuota,
    used: 0,
    remaining: PRICING.freeQuota,
    isSubscribed: false,
    unknown: true as const,
  }));

  return (
    <div>
      <Hero
        eyebrow="حسابك"
        title={paidUi ? "الفوترة والاشتراك" : "الحساب والرصيد"}
        lede={
          paidUi
            ? "تابع رصيد التجربة، خطتك الحالية، ومسار الترقية."
            : "تابع رصيد التجربة المجانية واستخدامك الحالي وحد المسموح — الاشتراك المدفوع يُعلن عند إتاحته."
        }
      />

      <div className="mt-6">
        <BillingStatusCard status={status} userName={user.name} />
      </div>

      <SectionTitle>الوحدات المشمولة بالحصّة</SectionTitle>
      <CardGrid>
        <Card
          href="/dashboard/ask"
          icon={Sparkles}
          title="اسأل حكيم"
          description="يستهلك استخدامًا واحدًا من الحصّة المجانية عند كل تحليل ناجح."
        />
        <Card
          href="/dashboard/consultations"
          icon={MessageSquareText}
          title="الاستشارات"
          description="توليد الاستشارة المؤصّلة ضمن رصيد التجربة أو الاشتراك."
        />
        <Card
          href="/dashboard/simulations"
          icon={Gavel}
          title="القاضي التفاعلي"
          description="إنشاء جلسة مرافعة يخصم من الحصّة عند التفعيل."
        />
        {paidUi ? (
          <Card
            href="/dashboard/subscribe"
            icon={CreditCard}
            title="ترقية الخطة"
            description="عرض الخطط والأسعار المعلنة والاشتراك عند التفعيل."
            badge={status.isSubscribed ? "مشترك" : "مجاني"}
          />
        ) : (
          <Card
            href="/dashboard/ask"
            icon={CreditCard}
            title="الخطة الحالية"
            description="تجربة مجانية ضمن الحصّة أعلاه. الخطط المدفوعة ستتاح قريبًا."
            badge={status.isSubscribed ? "مشترك" : "تجربة"}
          />
        )}
      </CardGrid>

      <section className="mt-8 rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-5">
        <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">تفاصيل الحساب</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الاسم</dt>
            <dd className="font-semibold text-[var(--navy)]">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">البريد</dt>
            <dd className="font-mono-legal text-xs" dir="ltr">
              {user.email}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الدور</dt>
            <dd className="font-semibold text-[var(--navy)]">{roleLabel(user.role)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">حالة الخطة</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {status.unknown ? "غير مفعّل بعد" : status.isSubscribed ? "نشط" : "تجربة مجانية"}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">حد التجربة</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {PRICING.freeQuota.toLocaleString("ar-SA")} استخدامًا
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">المتبقي</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {status.remaining.toLocaleString("ar-SA")}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          {paidUi ? (
            <Link
              href="/dashboard/subscribe"
              className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              إدارة الخطة
            </Link>
          ) : (
            <p className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-60)]">
              الخطط المدفوعة ستتاح قريبًا
            </p>
          )}
          <Link
            href="/dashboard"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            العودة إلى لوحة التحكم
          </Link>
        </div>
      </section>
    </div>
  );
}
