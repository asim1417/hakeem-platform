"use client";

import { useState } from "react";
import type { CreditSpendId } from "@/config/credits";
import { CREDIT_SPENDS } from "@/config/credits";

export function SpendCreditsButton({
  use,
  targetId,
  label,
  onSuccess,
}: {
  use: CreditSpendId;
  targetId?: string;
  label?: string;
  onSuccess?: () => void;
}) {
  const def = CREDIT_SPENDS[use];
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function spend() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/credits/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use, targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "رصيد غير كافٍ.");
      setMsg(`تم خصم ${data.spent} — المتبقي ${data.balance}`);
      onSuccess?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "تعذّر الخصم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void spend()}
        className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--navy)]"
      >
        {loading ? "…" : label || `${def.label} (${def.points} نقطة)`}
      </button>
      {msg ? <span className="text-xs text-[var(--ink-60)]">{msg}</span> : null}
    </div>
  );
}
