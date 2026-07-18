import Link from "next/link";
import { CreditCard, Sparkles, Gavel, MessageSquareText } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { BillingStatusCard } from "@/components/billing/BillingStatusCard";
import { Card, CardGrid, Hero, SectionTitle } from "@/components/ui/design-system";
import { PRICING } from "@/config/pricing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الفوترة والحساب — حكيم",
};

export default async function BillingDashboardPage() {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
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
        title="الفوترة والاشتراك"
        lede="تابع رصيد التجربة المجانية، خطتك الحالية، ومسار الترقية — ضمن تصميم حكيم الموحّد."
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
        <Card
          href="/dashboard/subscribe"
          icon={CreditCard}
          title="ترقية الخطة"
          description="عرض الخطط والأسعار المعلنة — الدفع عبر Moyasar عند التفعيل."
          badge={status.isSubscribed ? "مشترك" : "مجاني"}
        />
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
            <dd className="font-semibold text-[var(--navy)]">{user.role}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">حالة الاشتراك</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {status.unknown ? "غير مفعّل بعد" : status.isSubscribed ? "نشط" : "تجربة مجانية"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/subscribe"
            className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            إدارة الخطة
          </Link>
          <Link
            href="/pricing"
            className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            صفحة الأسعار العامة
          </Link>
        </div>
      </section>
    </div>
  );
}
