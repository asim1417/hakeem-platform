"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SEED_PACKAGES, type SeedPackage } from "@/config/billing-plans";

// نافذة «الرصيد غير كافٍ» — تُوضّح العجز وتقترح أصغر باقة كافية للشحن.
// «شحن الرصيد» يبدأ checkout لباقة نقاط · «ترقية الباقة» يفتح صفحة الاشتراك.
// returnHint يحفظ سياق العملية المعلّقة كي لا يضيع على المستخدم.

function smallestSufficientPackage(shortfallPoints: number): SeedPackage | null {
  const sorted = [...SEED_PACKAGES].sort((a, b) => a.points - b.points);
  return sorted.find((p) => p.points >= shortfallPoints) ?? sorted[sorted.length - 1] ?? null;
}

export function InsufficientBalanceDialog({
  open,
  costPoints,
  balancePoints,
  returnHint,
  onClose,
}: {
  open: boolean;
  costPoints: number;
  balancePoints: number;
  returnHint?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ar = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("ar-SA");
  const shortfall = Math.max(0, Math.ceil(costPoints - balancePoints));
  const pkg = smallestSufficientPackage(shortfall);

  async function topUp() {
    if (!pkg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PACKAGE", packageCode: pkg.code }),
      });
      if (res.status === 403) {
        setError("الشراء غير مفعّل حاليًا.");
        return;
      }
      if (!res.ok) {
        setError("تعذّر بدء الشحن — حاول مجددًا.");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("تعذّر بدء الشحن — حاول مجددًا.");
    } catch {
      setError("تعذّر بدء الشحن — حاول مجددًا.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,28,32,0.55)] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insufficient-title"
        className="w-full max-w-md rounded-[var(--r-xl)] border border-[rgba(140,34,51,0.3)] bg-ivory p-5 shadow-[var(--sh-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="insufficient-title" className="font-display-ar text-lg font-bold text-[var(--ruby)]">
          الرصيد غير كافٍ
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-70)]">
          هذه العملية تحتاج {ar(costPoints)} نقطة ورصيدك الحالي {ar(balancePoints)} نقطة — ينقصك{" "}
          <span className="font-semibold text-[var(--navy)]">{ar(shortfall)} نقطة</span>.
        </p>

        {returnHint ? (
          <p className="mt-3 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-[var(--surface)] px-3 py-2 text-xs leading-6 text-[var(--ink-60)]">
            سنُبقي عمليتك جاهزة: {returnHint}
          </p>
        ) : null}

        {pkg ? (
          <div className="mt-4 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-3">
            <p className="text-xs text-[var(--ink-60)]">أصغر باقة كافية</p>
            <p className="mt-1 font-display-ar text-base font-bold text-[var(--navy)]">
              {pkg.nameAr} — {(pkg.priceHalalas / 100).toLocaleString("ar-SA")} ر.س
              <span className="mr-1 text-xs font-normal text-[var(--ink-60)]"> (شامل الضريبة)</span>
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs leading-6 text-[var(--ruby)]" role="status">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            لاحقًا
          </button>
          <Link
            href="/dashboard/account/subscription"
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--petrol)] px-5 py-2.5 text-sm font-semibold text-[var(--petrol)]"
          >
            ترقية الباقة
          </Link>
          <button
            type="button"
            onClick={topUp}
            disabled={loading || !pkg}
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "جارٍ التحويل…" : "شحن الرصيد"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InsufficientBalanceDialog;
