"use client";

import { useState } from "react";
import { SEED_PLANS } from "@/config/billing-plans";

// ضوابط الاشتراك — إلغاء (حتى نهاية الفترة) · استئناف · تغيير الباقة.
// بلا أنماط مضلّلة: نُبيّن بوضوح ما يفقده المستخدم عند الإلغاء.

type BillingPeriod = "MONTHLY" | "YEARLY";

export function SubscriptionControls({
  planCode,
  status,
  periodEndIso,
  cancelAtPeriodEnd,
  hasSubscription,
}: {
  planCode: string | null;
  status: string | null;
  periodEndIso: string | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");

  const currentPlan = planCode
    ? SEED_PLANS.find((p) => p.code === planCode.toUpperCase())
    : undefined;
  const periodEnd = periodEndIso ? new Date(periodEndIso).toLocaleDateString("ar-SA") : null;

  async function post(url: string, body?: unknown): Promise<{ ok: boolean; data: unknown }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function doCancel() {
    setBusy("cancel");
    setMessage(null);
    const { ok } = await post("/api/billing/subscription/cancel");
    setBusy(null);
    setConfirmCancel(false);
    if (ok) {
      setMessage({
        kind: "ok",
        text: "أُلغي التجديد — يبقى اشتراكك فعّالًا حتى نهاية الفترة الحالية.",
      });
    } else {
      setMessage({ kind: "err", text: "تعذّر الإلغاء — حاول مجددًا." });
    }
  }

  async function doResume() {
    setBusy("resume");
    setMessage(null);
    const { ok } = await post("/api/billing/subscription/resume");
    setBusy(null);
    if (ok) {
      setMessage({ kind: "ok", text: "استُؤنف اشتراكك — سيُجدّد تلقائيًّا كالمعتاد." });
    } else {
      setMessage({ kind: "err", text: "تعذّر الاستئناف — حاول مجددًا." });
    }
  }

  async function doChangePlan(newCode: string) {
    setBusy(`change-${newCode}`);
    setMessage(null);
    const { ok, data } = await post("/api/billing/subscription/change-plan", {
      planCode: newCode,
      period,
    });
    setBusy(null);
    const d = data as { url?: string; message?: string };
    if (ok && d.url) {
      window.location.href = d.url;
      return;
    }
    if (ok) {
      setMessage({
        kind: "ok",
        text: d.message ?? "تم تحديث طلب تغيير الباقة.",
      });
    } else {
      setMessage({ kind: "err", text: d.message ?? "تعذّر تغيير الباقة — حاول مجددًا." });
    }
  }

  return (
    <div dir="rtl">
      {message ? (
        <p
          role="status"
          className={`mb-4 rounded-[var(--r-lg)] border px-4 py-3 text-sm font-semibold ${
            message.kind === "ok"
              ? "border-[var(--gold-border)] bg-[var(--gold-ghost)] text-[var(--navy)]"
              : "border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] text-[var(--ruby)]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]">
        <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">اشتراكك الحالي</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الباقة</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {currentPlan?.nameAr ?? (hasSubscription ? planCode : "التجربة المجانية")}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الحالة</dt>
            <dd className="font-semibold text-[var(--navy)]">
              {cancelAtPeriodEnd ? "مجدولة للإلغاء" : status ?? "—"}
            </dd>
          </div>
          {periodEnd ? (
            <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
              <dt className="text-[var(--ink-60)]">
                {cancelAtPeriodEnd ? "ينتهي في" : "يتجدّد في"}
              </dt>
              <dd className="font-semibold text-[var(--navy)]">{periodEnd}</dd>
            </div>
          ) : null}
        </dl>

        {hasSubscription ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={doResume}
                disabled={busy === "resume"}
                className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "resume" ? "جارٍ…" : "استئناف الاشتراك"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[rgba(140,34,51,0.3)] px-5 py-2.5 text-sm font-semibold text-[var(--ruby)]"
              >
                إلغاء التجديد
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-7 text-[var(--ink-60)]">
            لا اشتراك فعّال حاليًا — يمكنك اختيار باقة من الخطط أدناه.
          </p>
        )}
      </section>

      {confirmCancel ? (
        <section className="mt-4 rounded-[var(--r-xl)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-5">
          <h3 className="font-display-ar text-base font-bold text-[var(--ruby)]">
            قبل الإلغاء — ما الذي يتغيّر؟
          </h3>
          <ul className="mt-3 list-disc space-y-1 pr-5 text-sm leading-7 text-[var(--ink-70)]">
            <li>يبقى اشتراكك فعّالًا حتى {periodEnd ?? "نهاية الفترة الحالية"} — لا خصم فوري.</li>
            <li>بعد نهاية الفترة تتوقّف نقاط الاشتراك الشهرية المتجدّدة.</li>
            <li>النقاط المشتراة أو الترويجية المتبقية لا تتأثّر بالإلغاء.</li>
            <li>يمكنك الاستئناف في أي وقت قبل نهاية الفترة دون فقدان شيء.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              الاحتفاظ بالاشتراك
            </button>
            <button
              type="button"
              onClick={doCancel}
              disabled={busy === "cancel"}
              className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ruby)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "cancel" ? "جارٍ…" : "تأكيد الإلغاء"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">تغيير الباقة</h2>
          <div className="inline-flex rounded-full border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-1">
            <button
              type="button"
              onClick={() => setPeriod("MONTHLY")}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
                period === "MONTHLY" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)]"
              }`}
            >
              شهري
            </button>
            <button
              type="button"
              onClick={() => setPeriod("YEARLY")}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
                period === "YEARLY" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)]"
              }`}
            >
              سنوي
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEED_PLANS.filter((p) => p.code !== "FREE").map((plan) => {
            const isCurrent = planCode?.toUpperCase() === plan.code;
            const total =
              period === "YEARLY" ? plan.yearlyTotalHalalas : plan.monthlyTotalHalalas;
            return (
              <div
                key={plan.code}
                className="flex flex-col rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5"
              >
                <p className="font-display-ar text-base font-bold text-[var(--navy)]">
                  {plan.nameAr}
                </p>
                <p className="mt-1 text-sm text-[var(--ink-60)]">
                  {plan.monthlyPoints.toLocaleString("ar-SA")} نقطة شهريًا
                </p>
                <p className="mt-2 text-lg font-bold text-[var(--petrol)]">
                  {plan.isQuoteOnly || total == null
                    ? "عرض سعر"
                    : `${(total / 100).toLocaleString("ar-SA")} ر.س`}
                </p>
                {!plan.isQuoteOnly && total != null ? (
                  <p className="text-xs text-[var(--ink-60)]">شامل الضريبة</p>
                ) : null}
                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]">
                      باقتك الحالية
                    </span>
                  ) : plan.isQuoteOnly ? (
                    <a
                      href="/pricing"
                      className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--petrol)] px-5 py-2.5 text-sm font-semibold text-[var(--petrol)]"
                    >
                      تواصل معنا
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => doChangePlan(plan.code)}
                      disabled={busy === `change-${plan.code}`}
                      className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === `change-${plan.code}` ? "جارٍ…" : "اختيار هذه الباقة"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-6 text-[var(--ink-60)]">
          الترقية تُطبَّق فورًا بفارق متناسب؛ التخفيض يُجدوَل للدورة التالية دون فقدان نقاطك الحالية.
        </p>
      </section>
    </div>
  );
}

export default SubscriptionControls;
