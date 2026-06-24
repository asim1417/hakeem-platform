"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X, RotateCcw } from "lucide-react";

type Decision = "approve" | "reject" | "reset";

/** أزرار اعتماد/رفض/إعادة مبدأ قضائي مستخرَج (لأصحاب صلاحية تعديل النواة). */
export function PrincipleReviewControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState(false);

  async function decide(decision: Decision) {
    setBusy(decision);
    setError(false);
    try {
      const res = await fetch(`/api/legal-core/principles/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision })
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  const reviewed = status === "reviewed";
  const rejected = status === "rejected";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => decide("approve")}
        disabled={busy !== null || reviewed}
        aria-label="اعتماد المبدأ"
        className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[rgba(26,92,65,.3)] bg-[var(--emerald-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--emerald)] transition hover:brightness-95 disabled:opacity-40"
      >
        <Check size={15} aria-hidden /> {reviewed ? "معتمد" : "اعتماد"}
      </button>
      <button
        type="button"
        onClick={() => decide("reject")}
        disabled={busy !== null || rejected}
        aria-label="رفض المبدأ"
        className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[rgba(140,34,51,.3)] bg-[var(--ruby-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--ruby)] transition hover:brightness-95 disabled:opacity-40"
      >
        <X size={15} aria-hidden /> {rejected ? "مرفوض" : "رفض"}
      </button>
      {status !== "needs_review" ? (
        <button
          type="button"
          onClick={() => decide("reset")}
          disabled={busy !== null}
          aria-label="إعادة إلى قيد المراجعة"
          className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-1.5 text-sm text-[var(--ink-60)] transition hover:border-[var(--gold)] disabled:opacity-40"
        >
          <RotateCcw size={14} aria-hidden /> إعادة
        </button>
      ) : null}
      {error ? <span className="text-xs text-[var(--ruby)]">تعذّر الحفظ، حاول مجددًا.</span> : null}
    </div>
  );
}
