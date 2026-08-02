"use client";

import { useEffect, useState } from "react";

// شارة تكلفة صغيرة غير حاجبة — تُقدّر تكلفة الخدمة عند التركيب وتعرض «التكلفة · رصيدك».
// لا تعرض شيئًا عند الخطأ أو أثناء التحميل.

export type DocumentTier = "small" | "medium" | "large" | "xlarge";

export function CostChip({
  serviceCode,
  quantity,
  opus,
  proExport,
  documentTier,
}: {
  serviceCode: string;
  quantity?: number;
  opus?: boolean;
  proExport?: boolean;
  documentTier?: DocumentTier;
}) {
  const [state, setState] = useState<{ cost: number; balance: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceCode, quantity, opus, proExport, documentTier }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { costPoints?: number; balancePoints?: number };
        if (cancelled) return;
        if (typeof data.costPoints === "number") {
          setState({ cost: data.costPoints, balance: data.balancePoints ?? 0 });
        }
      } catch {
        /* غير حاجب — لا شيء عند الخطأ */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceCode, quantity, opus, proExport, documentTier]);

  if (!state) return null;
  const ar = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("ar-SA");

  return (
    <span
      dir="rtl"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--navy)]"
    >
      <span>التكلفة: {ar(state.cost)} نقطة</span>
      <span aria-hidden className="text-[var(--ink-40)]">·</span>
      <span className="text-[var(--ink-60)]">رصيدك {ar(state.balance)}</span>
    </span>
  );
}

export default CostChip;
