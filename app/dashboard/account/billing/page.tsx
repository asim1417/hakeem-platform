import Link from "next/link";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import {
  getWalletSummary,
  estimateServiceCost,
  type WalletSummary,
} from "@/lib/modules/billing/credit-engine";
import { getActiveSubscription } from "@/lib/modules/billing/subscriptions";
import { PointPackages } from "@/components/billing/PointPackages";
import { Hero, SectionTitle } from "@/components/ui/design-system";
import type { CreditSourceType } from "@/lib/modules/credits/bucket-allocation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الرصيد والمحفظة — حكيم",
};

const SOURCE_LABELS: Record<CreditSourceType, string> = {
  TRIAL: "تجربة",
  SUBSCRIPTION: "اشتراك",
  PURCHASE: "نقاط مشتراة",
  PROMOTION: "ترويجية",
  REFUND: "استرداد",
  ADMIN_GRANT: "منح إداري",
  LEGACY_MIGRATION: "ترحيل",
};

const ar = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("ar-SA");

function StatBox({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white p-4">
      <p className="text-xs text-[var(--ink-60)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--navy)]">
        {ar(value)}
        <span className="mr-1 text-sm font-semibold text-[var(--ink-60)]">نقطة</span>
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--ink-60)]">{hint}</p> : null}
    </div>
  );
}

export default async function WalletPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser();
  const userId = user?.id ?? "";

  const [summary, sub, askCost, consultCost] = await Promise.all([
    getWalletSummary(userId).catch<WalletSummary | null>(() => null),
    userId ? getActiveSubscription(userId).catch(() => null) : Promise.resolve(null),
    estimateServiceCost("ASK_SOURCED").catch(() => null),
    estimateServiceCost("LEGAL_CONSULTATION").catch(() => null),
  ]);

  const renewal = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("ar-SA")
    : null;

  if (!summary || !summary.enabled) {
    return (
      <div dir="rtl">
        <Hero eyebrow="حسابك" title="الرصيد والمحفظة" />
        <section className="mt-6 rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-5">
          <p className="text-sm leading-7 text-[var(--ink-60)]">
            نظام النقاط جاهز للرولأوت ولم يُفعَّل بعد على حسابك — الاستخدام الحالي مستمر دون تعطيل.
          </p>
        </section>
      </div>
    );
  }

  const available = summary.availablePoints;
  const askRemaining = askCost && askCost.points > 0 ? Math.floor(available / askCost.points) : 0;
  const consultRemaining =
    consultCost && consultCost.points > 0 ? Math.floor(available / consultCost.points) : 0;

  const sources = (Object.entries(summary.bySource) as Array<[CreditSourceType, number]>).filter(
    ([, v]) => v > 0
  );

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="الرصيد والمحفظة"
        lede="رصيدك بالنقاط، المتاح للاستخدام، وتوزيعه حسب المصدر."
      />

      <section className="mt-6 rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatBox label="إجمالي الرصيد" value={summary.balancePoints} />
          <StatBox label="محجوز مؤقتًا" value={summary.reservedPoints} hint="يُفرَج عنه عند اكتمال العملية أو فشلها" />
          <StatBox label="المتاح للاستخدام" value={summary.availablePoints} />
        </div>
        {renewal ? (
          <p className="mt-4 text-sm text-[var(--ink-70)]">
            تاريخ التجديد القادم: <span className="font-semibold text-[var(--navy)]">{renewal}</span>
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="#packages"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            اشحن الرصيد
          </Link>
          <Link
            href="/dashboard/account/subscription"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            ترقية الباقة
          </Link>
        </div>
      </section>

      <SectionTitle>استخداماتك المتوقّعة برصيدك الحالي</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--navy)]">سؤال مُسنَد</p>
          <p className="mt-1 text-xs text-[var(--ink-60)]">
            {askCost ? `${ar(askCost.points)} نقطة لكل مرّة` : "—"}
          </p>
          <p className="mt-2 text-xl font-bold text-[var(--petrol)]">
            ≈ {ar(askRemaining)} <span className="text-sm font-semibold text-[var(--ink-60)]">مرّة</span>
          </p>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--navy)]">استشارة قانونية</p>
          <p className="mt-1 text-xs text-[var(--ink-60)]">
            {consultCost ? `${ar(consultCost.points)} نقطة لكل مرّة` : "—"}
          </p>
          <p className="mt-2 text-xl font-bold text-[var(--petrol)]">
            ≈ {ar(consultRemaining)}{" "}
            <span className="text-sm font-semibold text-[var(--ink-60)]">مرّة</span>
          </p>
        </div>
      </div>

      <SectionTitle>توزيع الرصيد حسب المصدر</SectionTitle>
      {sources.length === 0 ? (
        <p className="text-sm text-[var(--ink-60)]">لا رصيد موزّع حاليًا.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-[var(--ink-08)] text-right text-[var(--ink-60)]">
                <th className="px-4 py-3 font-semibold">المصدر</th>
                <th className="px-4 py-3 font-semibold">النقاط</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([src, val]) => (
                <tr key={src} className="border-b border-[var(--ink-04)] last:border-0">
                  <td className="px-4 py-3 text-[var(--navy)]">{SOURCE_LABELS[src]}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--navy)]">{ar(val)} نقطة</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle id="packages">شحن الرصيد — باقات النقاط</SectionTitle>
      <PointPackages />

      <p className="mt-6 text-sm text-[var(--ink-60)]">
        بحاجة إلى خطة اشتراك بدل الباقات؟{" "}
        <Link href="/pricing" className="font-semibold text-[var(--petrol)] underline">
          استعرض الخطط والأسعار
        </Link>
        .
      </p>
    </div>
  );
}
