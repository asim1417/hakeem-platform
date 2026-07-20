"use client";

import { useState } from "react";
import { getPlans, type PlanId, type PlanInterval } from "@/config/pricing";
import { PlanCard } from "@/components/billing/PlanCard";

export function PlansGrid({
  currentPlanId = "free",
  freeCtaHref = "/register",
  paidCtaHref = "/dashboard/subscribe",
}: {
  currentPlanId?: PlanId | "none";
  freeCtaHref?: string;
  paidCtaHref?: string;
}) {
  const [interval, setInterval] = useState<PlanInterval>("monthly");
  const plans = getPlans();

  return (
    <div>
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold transition ${
              interval === "monthly" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)]"
            }`}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold transition ${
              interval === "yearly" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)]"
            }`}
          >
            سنوي
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            current={currentPlanId === plan.id}
            ctaHref={
              plan.id === "free"
                ? freeCtaHref
                : plan.checkoutEnabled
                  ? `/api/billing/checkout?plan=${plan.id}&interval=${interval}`
                  : paidCtaHref
            }
          />
        ))}
      </div>
    </div>
  );
}
