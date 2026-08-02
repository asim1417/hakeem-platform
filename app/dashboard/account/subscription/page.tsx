import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { getActiveSubscription } from "@/lib/modules/billing/subscriptions";
import { Hero } from "@/components/ui/design-system";
import { SubscriptionControls } from "./SubscriptionControls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الاشتراك — حكيم",
};

export default async function SubscriptionPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser();
  const sub = user ? await getActiveSubscription(user.id).catch(() => null) : null;

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="الاشتراك"
        lede="خطتك الحالية وتاريخ التجديد وخيارات التغيير والإلغاء — بوضوح تام."
      />
      <div className="mt-6">
        <SubscriptionControls
          planCode={sub?.planCode ?? null}
          status={sub?.status ?? null}
          periodEndIso={sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null}
          cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
          hasSubscription={Boolean(sub)}
        />
      </div>
    </div>
  );
}
