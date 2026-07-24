import Link from "next/link";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { isPaidCheckoutUiEnabled } from "@/lib/modules/billing/checkout-visibility";
import { PlansGrid } from "@/components/billing/PlansGrid";
import { BillingStatusCard } from "@/components/billing/BillingStatusCard";
import { PRICING } from "@/config/pricing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "خطط الاشتراك — حكيم",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams?: { checkout?: string; msg?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser().catch(() => null);
  const paidUi = isPaidCheckoutUiEnabled();
  const status = user ? await getStatus(user.id).catch(() => null) : null;
  const currentPlanId = status?.isSubscribed ? "pro" : "free";
  const checkoutPending = searchParams?.checkout === "pending";
  const checkoutError = searchParams?.checkout === "error";
  const checkoutCancel = searchParams?.checkout === "cancel";

  return (
    <div dir="rtl" className="mx-auto max-w-5xl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">الاشتراك والخطط</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">خطط حكيم</h1>
        <p className="mt-3 max-w-2xl leading-8 text-white/85">
          الوحدات المتقدّمة (اسأل حكيم · القاضي التفاعلي · الاستشارات) ضمن حصّة مجانية ثم بالاشتراك. تصفّح
          النواة القانونية مجاني دائمًا.
        </p>
      </header>

      {paidUi && checkoutPending ? (
        <div className="mt-6 rounded-[var(--r-lg)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
          جارٍ إكمال الدفع — إن تأخر التأكيد حدّث الصفحة بعد لحظات.
        </div>
      ) : null}
      {paidUi && checkoutError ? (
        <div className="mt-6 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] px-4 py-3 text-sm leading-7 text-[var(--ruby)]">
          تعذّر بدء الدفع{searchParams?.msg ? `: ${searchParams.msg}` : "."}
        </div>
      ) : null}
      {paidUi && checkoutCancel ? (
        <div className="mt-6 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-3 text-sm leading-7 text-[var(--ink-60)]">
          أُلغي الدفع — يمكنك المحاولة مجددًا في أي وقت.
        </div>
      ) : null}

      {!paidUi ? (
        <div
          className="mt-6 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-3 text-sm leading-7 text-[var(--ink-60)]"
          role="status"
        >
          الخطط المدفوعة ستتاح قريبًا. يمكنك متابعة رصيد التجربة من صفحة الحساب والرصيد.
        </div>
      ) : null}

      {status ? (
        <div className="mt-6">
          <BillingStatusCard status={status} userName={user?.name} />
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display-ar text-xl font-bold text-[var(--navy)]">
          {paidUi ? "اختر خطتك" : "الخطط المتاحة للعرض"}
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
          {paidUi
            ? "الأسعار معلنة للمحامي الفرد والمكتب. اختر الخطة المناسبة لك."
            : "نعرض الأسعار للشفافية. التحصيل الإلكتروني يُفعَّل عند الإطلاق الرسمي للاشتراك."}
        </p>
        <div className="mt-6">
          <PlansGrid
            currentPlanId={currentPlanId}
            freeCtaHref="/dashboard"
            paidCtaHref="/dashboard/billing"
            paidUiEnabled={paidUi}
          />
        </div>
      </section>

      <p className="mt-8 rounded-[var(--r-lg)] border border-dashed border-[var(--copper)] bg-[var(--copper-soft)] p-4 text-sm leading-7 text-[var(--copper-deep)]">
        تشمل التجربة المجانيّة {PRICING.freeQuota.toLocaleString("ar-SA")} استشارة من الوحدات المتقدّمة، ثم
        يمكنك المتابعة بالاشتراك عند إتاحته.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/billing"
          className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
        >
          الحساب والرصيد
        </Link>
        <Link
          href="/dashboard"
          className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--petrol)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
