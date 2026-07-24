import Link from "next/link";
import { PlansGrid } from "@/components/billing/PlansGrid";
import { PRICING } from "@/config/pricing";
import { assertBuiltinPageEnabled } from "@/lib/modules/site/page-gate";

export const metadata = {
  title: "الأسعار والخطط — حكيم",
  description: "أسعار معلنة للمحامي الفرد والمكتب — تجربة مجانية ثم اشتراك.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await assertBuiltinPageEnabled("pricing");
  const ar = (n: number) => n.toLocaleString("ar-SA");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--hakeem-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-[0.07]"
        style={{
          background:
            "radial-gradient(55% 90% at 50% 0%, var(--navy) 0%, transparent 70%), radial-gradient(35% 70% at 80% 0%, var(--gold) 0%, transparent 65%)",
        }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-xl font-bold text-[var(--gold-bright)]">
            ح
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold text-[var(--navy)]">حكيم</p>
            <p className="text-[11px] text-[var(--ink-60)]">الأسعار والخطط</p>
          </div>
        </Link>
        <div className="flex gap-2">
          <Link
            href="/sign-in"
            className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/sign-up"
            className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            سجّل مجانًا
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-10 text-center">
        <p className="font-judicial text-sm font-semibold text-[var(--gold-dark)]">حكيم</p>
        <h1 className="mt-2 font-judicial text-4xl font-bold text-[var(--navy)] md:text-5xl">
          أسعار معلنة — بلا غموض
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[var(--ink-60)]">
          ابدأ بـ {ar(PRICING.freeQuota)} استخدامًا مجانيًا للوحدات المتقدّمة. تصفّح الأنظمة والمواد يبقى مجانيًا
          دائمًا. الاشتراك المدفوع يُفعَّل عبر الدفع السعودي عند جاهزية البوابة.
        </p>

        <div className="mt-12 text-start">
          <PlansGrid currentPlanId="none" freeCtaHref="/register" paidCtaHref="/register?next=/dashboard/subscribe" />
        </div>

        <p className="mx-auto mt-10 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
          الدفع الإلكتروني (Moyasar) قيد الربط — الواجهة جاهزة والأسعار قابلة للتعديل من إعدادات التسعير دون إعادة
          بناء التجربة.
        </p>
      </section>
    </main>
  );
}
