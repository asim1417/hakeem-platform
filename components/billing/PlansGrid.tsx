"use client";

import { useState } from "react";
import { getPlans, type PlanId, type PlanInterval } from "@/config/pricing";
import { PlanCard } from "@/components/billing/PlanCard";

export function PlansGrid({
  currentPlanId = "free",
  freeCtaHref = "/register",
  paidCtaHref = "/dashboard/billing",
  paidUiEnabled = false,
}: {
  currentPlanId?: PlanId | "none";
  freeCtaHref?: string;
  paidCtaHref?: string;
  /** يُمرَّر من الخادم — لا تعتمد على السرّ في المتصفح. */
  paidUiEnabled?: boolean;
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
            className={`focus-ring min-h-[44px] rounded-full px-5 py-2 text-sm font-semibold transition ${
              interval === "monthly" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)]"
            }`}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`focus-ring min-h-[44px] rounded-full px-5 py-2 text-sm font-semibold transition ${
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
            plan={{
              ...plan,
              // على العميل لا يُوثق بالسرّ — اعتمد راية الخادم
              checkoutEnabled: paidUiEnabled && plan.id !== "free",
              ctaLabel:
                plan.id === "free"
                  ? plan.ctaLabel
                  : paidUiEnabled
                    ? plan.id === "pro"
                      ? "اشترك الآن"
                      : "اشترك للمكتب"
                    : "الخطط المدفوعة ستتاح قريبًا",
            }}
            interval={interval}
            current={currentPlanId === plan.id}
            paidUiEnabled={paidUiEnabled}
            ctaHref={
              plan.id === "free"
                ? freeCtaHref
                : paidUiEnabled
                  ? `/api/billing/checkout?plan=${plan.id}&interval=${interval}`
                  : paidCtaHref
            }
          />
        ))}
      </div>
    </div>
  );
}
