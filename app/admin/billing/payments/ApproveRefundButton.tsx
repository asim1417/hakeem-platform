"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * اعتماد استرداد معلّق. POST /api/admin/billing/refunds/[id]/approve.
 * ينفّذ عبر البوابة، يعكس النقاط ما أمكن، ثم يعيد التحميل.
 */
export function ApproveRefundButton({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);

  function approve() {
    startTransition(async () => {
      setMsg("");
      try {
        const res = await fetch(`/api/admin/billing/refunds/${encodeURIComponent(refundId)}/approve`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!res.ok || data.ok === false) {
          setMsg(data.message || "تعذّر الاعتماد.");
          return;
        }
        setMsg("تم الاعتماد.");
        router.refresh();
      } catch {
        setMsg("خطأ شبكة.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {confirming ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={approve}
            className="rounded-md bg-[#8B1A1A] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "…" : "تأكيد الاعتماد"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2.5 py-1 text-xs font-semibold text-[#0E3435]"
          >
            إلغاء
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md bg-[#0E3435] px-2.5 py-1 text-xs font-semibold text-[#FFFcf7]"
        >
          اعتماد الاسترداد
        </button>
      )}
      {msg ? <span className="text-[11px] text-[rgba(14,52,53,0.6)]">{msg}</span> : null}
    </div>
  );
}
