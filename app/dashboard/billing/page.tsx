import Link from "next/link";
import { CreditCard, Sparkles, Gavel, MessageSquareText, UserRound, Coins } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { isPaidCheckoutUiEnabled } from "@/lib/modules/billing/checkout-visibility";
import { BillingStatusCard } from "@/components/billing/BillingStatusCard";
import { Card, CardGrid, Hero, SectionTitle } from "@/components/ui/design-system";
import { PRICING } from "@/config/pricing";
import { roleLabel } from "@/lib/i18n/enum-labels";
import { getUsageCreditStatus } from "@/lib/modules/credits/usage-ledger";
import { milliUnitsToUnits } from "@/config/usage-credits";
import { getCreditsStatus } from "@/lib/modules/credits/ledger";
import { getProfile } from "@/lib/modules/onboarding/profile";
import { getReferralInfo } from "@/lib/modules/referrals/codes";
import { ENTITY_TYPE_OPTIONS } from "@/config/entity-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الحساب والرصيد — حكيم",
};

function professionLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return (
    ENTITY_TYPE_OPTIONS.find((o) => o.value === code)?.label ??
    (code === "INDIVIDUAL" ? "محامٍ فرد" : code)
  );
}

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
  const usage = await getUsageCreditStatus(user.id);
  const points = await getCreditsStatus(user.id).catch(() => ({
    balance: 0,
    transactions: [],
    unknown: true as const,
  }));
  const profile = await getProfile(user.id);
  const referral = await getReferralInfo(user.id).catch(() => null);
  const ar = (n: number) => n.toLocaleString("ar-SA");

  return (
    <div>
      <Hero
        eyebrow="حسابك"
        title={paidUi ? "الفوترة والاشتراك" : "الحساب والرصيد"}
        lede={
          paidUi
            ? "تابع رصيد التجربة، خطتك الحالية، ومسار الترقية."
            : "تابع رصيد التجربة المجانية ونقاط حكيم وملفك المهني — الاشتراك المدفوع يُعلن عند إتاحته."
        }
      />

      <div className="mt-6">
        <BillingStatusCard status={status} userName={user.name} showPlansLink={paidUi} />
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-[var(--gold-dark)]" aria-hidden />
            <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">نقاط حكيم</h2>
          </div>
          {points.unknown ? (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">رصيد النقاط غير متاح حاليًا.</p>
          ) : (
            <>
              <p className="mt-3 text-3xl font-bold tabular-nums text-[var(--navy)]">{ar(points.balance)}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
                تُكتسب بإكمال الملف والزيارات اليومية، وتُستخدم لبعض الخدمات عند الحاجة.
              </p>
              {referral?.code ? (
                <p className="mt-3 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-2 text-sm text-[var(--navy)]">
                  رمز الإحالة:{" "}
                  <strong dir="ltr" className="font-mono tracking-wider">
                    {referral.code}
                  </strong>
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5">
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-[var(--navy)]" aria-hidden />
            <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">الملف المهني</h2>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-1.5">
              <dt className="text-[var(--ink-60)]">المهنة</dt>
              <dd className="font-semibold text-[var(--navy)]">{professionLabel(profile.entityType)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-1.5">
              <dt className="text-[var(--ink-60)]">الجوال</dt>
              <dd className="font-semibold text-[var(--navy)]" dir="ltr">
                {profile.phone || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-1.5">
              <dt className="text-[var(--ink-60)]">المدينة</dt>
              <dd className="font-semibold text-[var(--navy)]">{profile.city || "—"}</dd>
            </div>
          </dl>
          <Link
            href="/onboarding"
            className="focus-ring mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-4 py-2 text-sm font-semibold text-[var(--navy)]"
          >
            تعديل الملف المهني
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5">
        <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">وحدات الاستخدام</h2>
        {usage.unknown ? (
          <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">
            النظام الجديد جاهز للرولأوت، ولم تُطبّق هجرته بعد. الاستخدام الحالي مستمر دون تعطيل.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <UsageStat label="الرصيد" value={milliUnitsToUnits(usage.balanceMilliUnits)} />
              <UsageStat label="محجوز مؤقتًا" value={milliUnitsToUnits(usage.reservedMilliUnits)} />
              <UsageStat label="المتاح" value={milliUnitsToUnits(usage.availableMilliUnits)} />
            </div>
            <p className="mt-3 text-xs text-[var(--ink-60)]">
              كل وحدة تعادل قرابة ١٠٠٠ توكن موزون، والخصم لا يثبت إلا بعد نجاح الخدمة.
            </p>
          </>
        )}
      </section>

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
          {!status.unknown && !usage.enabled ? (
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
              <dt className="text-[var(--ink-60)]">حد التجربة</dt>
              <dd className="font-semibold text-[var(--navy)]">
                {PRICING.freeQuota.toLocaleString("ar-SA")} استخدامًا
              </dd>
            </div>
          ) : null}
          {!status.unknown && !usage.enabled ? (
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
              <dt className="text-[var(--ink-60)]">المتبقي</dt>
              <dd className="font-semibold text-[var(--navy)]">
                {status.remaining.toLocaleString("ar-SA")}
              </dd>
            </div>
          ) : null}
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
            href="/onboarding"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            ملفي المهني
          </Link>
          <Link
            href="/dashboard"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </section>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--ink-08)] bg-white p-3">
      <p className="text-xs text-[var(--ink-60)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--navy)]">
        {value.toLocaleString("ar-SA")} وحدة
      </p>
    </div>
  );
}
