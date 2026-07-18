import Link from "next/link";
import type { PlanDefinition, PlanInterval } from "@/config/pricing";
import { formatSar } from "@/config/pricing";

export function PlanCard({
  plan,
  interval = "monthly",
  current = false,
  ctaHref,
}: {
  plan: PlanDefinition;
  interval?: PlanInterval;
  current?: boolean;
  /** إن وُجد يُستخدم بدل سلوك الـ CTA الافتراضي. */
  ctaHref?: string;
}) {
  const price =
    plan.monthlySar === null
      ? null
      : interval === "yearly" && plan.yearlySar !== null
        ? plan.yearlySar
        : plan.monthlySar;
  const period =
    plan.monthlySar === null ? "" : interval === "yearly" ? "/ سنة" : "/ شهر";

  const href =
    ctaHref ??
    (plan.id === "free"
      ? "/register"
      : plan.checkoutEnabled
        ? `/api/billing/checkout?plan=${plan.id}&interval=${interval}`
        : "/dashboard/subscribe");

  const isExternalCheckout = Boolean(plan.checkoutEnabled && plan.id !== "free");

  return (
    <article
      className={`relative flex h-full flex-col rounded-[var(--r-xl)] border p-6 ${
        plan.highlighted
          ? "border-[var(--gold)] bg-ivory shadow-[var(--sh-md)]"
          : "border-[var(--ink-08)] bg-ivory/90"
      }`}
    >
      {plan.highlighted ? (
        <span className="absolute -top-3 start-6 rounded-full bg-[var(--navy)] px-3 py-1 text-[11px] font-semibold text-[var(--gold-pale)]">
          الأنسب للمحامي
        </span>
      ) : null}

      <header>
        <p className="font-judicial text-sm font-semibold text-[var(--gold-dark)]">{plan.nameAr}</p>
        <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">{plan.tagline}</p>
        <p className="mt-4 font-display-ar text-3xl font-bold text-[var(--navy)]">
          {formatSar(price)}
          {period ? <span className="ms-1 text-sm font-normal text-[var(--ink-40)]">{period}</span> : null}
        </p>
        {current ? (
          <p className="mt-2 inline-flex rounded-full border border-[var(--emerald)]/30 bg-[var(--emerald-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald)]">
            خطتك الحالية
          </p>
        ) : null}
      </header>

      <ul className="mt-5 flex-1 space-y-2.5 text-sm leading-7 text-[var(--ink-70)]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-[var(--gold)]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {plan.id === "free" || !plan.checkoutEnabled ? (
        <Link
          href={href}
          className={`focus-ring mt-6 inline-flex items-center justify-center rounded-[var(--r-md)] px-4 py-3 text-sm font-semibold transition ${
            plan.highlighted
              ? "bg-[var(--navy)] text-white hover:bg-[var(--navy-mid)]"
              : "border border-[var(--gold-border)] bg-[var(--gold-ghost)] text-[var(--navy)] hover:border-[var(--gold)]"
          }`}
        >
          {plan.ctaLabel}
        </Link>
      ) : (
        <a
          href={href}
          className="focus-ring mt-6 inline-flex items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white"
          {...(isExternalCheckout ? {} : {})}
        >
          {plan.ctaLabel}
        </a>
      )}
    </article>
  );
}
