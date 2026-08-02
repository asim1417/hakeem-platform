"use client";

import { useState } from "react";
import { SEED_PACKAGES } from "@/config/billing-plans";

// بطاقات باقات النقاط — شراء رصيد لمرّة واحدة (شامل الضريبة).
// «شراء» يبدأ checkout لباقة؛ إن رُدّ 403 (الشراء معطّل) نعرض رسالة واضحة.

export function PointPackages() {
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [disabledMsg, setDisabledMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packages = [...SEED_PACKAGES].sort((a, b) => a.sortOrder - b.sortOrder);

  async function buy(code: string) {
    setBusyCode(code);
    setError(null);
    setDisabledMsg(null);
    try {
      const res = await fetch("/api/billing/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PACKAGE", packageCode: code }),
      });
      if (res.status === 403) {
        setDisabledMsg("الشراء غير مفعّل حاليًا.");
        return;
      }
      if (!res.ok) {
        setError("تعذّر بدء الشراء — حاول مجددًا.");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("تعذّر بدء الشراء — حاول مجددًا.");
    } catch {
      setError("تعذّر بدء الشراء — حاول مجددًا.");
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div dir="rtl">
      {disabledMsg ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink-60)]"
        >
          {disabledMsg}
        </p>
      ) : null}
      {error ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] px-4 py-3 text-sm font-semibold text-[var(--ruby)]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.code}
            className="flex flex-col rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]"
          >
            <p className="font-display-ar text-2xl font-bold text-[var(--navy)]">
              {pkg.points.toLocaleString("ar-SA")}
              <span className="mr-1 text-base font-semibold text-[var(--ink-60)]">نقطة</span>
            </p>
            <p className="mt-2 text-lg font-bold text-[var(--petrol)]">
              {(pkg.priceHalalas / 100).toLocaleString("ar-SA")} ر.س
            </p>
            <p className="mt-1 text-xs text-[var(--ink-60)]">شامل الضريبة</p>
            <button
              type="button"
              onClick={() => buy(pkg.code)}
              disabled={busyCode === pkg.code}
              className="focus-ring mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyCode === pkg.code ? "جارٍ التحويل…" : "شراء"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PointPackages;
