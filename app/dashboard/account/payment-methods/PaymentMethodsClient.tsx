"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// إدارة وسائل الدفع — تعيين الافتراضية وحذف البطاقات.

export interface PaymentMethodView {
  id: string;
  brand: string | null;
  network: string | null;
  lastFour: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
}

export function PaymentMethodsClient({ methods }: { methods: PaymentMethodView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setDefault(id: string) {
    setBusy(`default-${id}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/payment-methods/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setError("تعذّر تعيين البطاقة الافتراضية.");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذّر تعيين البطاقة الافتراضية.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(`delete-${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/billing/payment-methods/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("تعذّر حذف البطاقة.");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذّر حذف البطاقة.");
    } finally {
      setBusy(null);
    }
  }

  const brandLabel = (m: PaymentMethodView) => m.brand || m.network || "بطاقة";
  const expiry = (m: PaymentMethodView) =>
    m.expiryMonth && m.expiryYear
      ? `${String(m.expiryMonth).padStart(2, "0")}/${String(m.expiryYear).slice(-2)}`
      : null;

  return (
    <div dir="rtl">
      {error ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] px-4 py-3 text-sm font-semibold text-[var(--ruby)]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {methods.map((m) => (
          <div
            key={m.id}
            className="flex flex-col rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display-ar text-base font-bold text-[var(--navy)]">
                  {brandLabel(m)}
                </p>
                <p className="mt-1 font-mono-legal text-sm text-[var(--ink-70)]" dir="ltr">
                  •••• {m.lastFour ?? "————"}
                </p>
                {expiry(m) ? (
                  <p className="mt-1 text-xs text-[var(--ink-60)]" dir="ltr">
                    {expiry(m)}
                  </p>
                ) : null}
              </div>
              {m.isDefault ? (
                <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-[var(--navy)]">
                  الافتراضية
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!m.isDefault ? (
                <button
                  type="button"
                  onClick={() => setDefault(m.id)}
                  disabled={busy === `default-${m.id}`}
                  className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-4 py-2 text-sm font-semibold text-[var(--navy)] disabled:opacity-50"
                >
                  {busy === `default-${m.id}` ? "جارٍ…" : "تعيين افتراضية"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(m.id)}
                disabled={busy === `delete-${m.id}`}
                className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[rgba(140,34,51,0.3)] px-4 py-2 text-sm font-semibold text-[var(--ruby)] disabled:opacity-50"
              >
                {busy === `delete-${m.id}` ? "جارٍ…" : "حذف"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PaymentMethodsClient;
