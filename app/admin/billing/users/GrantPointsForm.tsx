"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * منح أو سحب نقاط لمستخدم بسبب إلزامي (§12).
 * موجب = منح، سالب = سحب. POST /api/admin/billing/users/[id]/grant.
 */
export function GrantPointsForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts === 0) {
      setMsg("أدخل قيمة نقاط غير صفرية (موجب=منح، سالب=سحب).");
      return;
    }
    if (reason.trim().length < 3) {
      setMsg("السبب إلزامي.");
      return;
    }
    startTransition(async () => {
      setMsg("");
      try {
        const res = await fetch(`/api/admin/billing/users/${encodeURIComponent(userId)}/grant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: pts, reason: reason.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!res.ok || data.ok === false) {
          setMsg(data.message || "فشلت العملية.");
          return;
        }
        setMsg(pts > 0 ? "تم المنح." : "تم السحب.");
        setPoints("");
        setReason("");
        router.refresh();
      } catch {
        setMsg("خطأ شبكة.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-[rgba(14,52,53,0.1)] bg-white p-4">
      <h3 className="font-bold text-[#0E3435]">منح أو سحب نقاط</h3>
      <input
        type="number"
        step="1"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        placeholder="موجب للمنح، سالب للسحب"
        aria-label="عدد النقاط"
        className="mt-3 w-full rounded-md border border-[rgba(14,52,53,0.15)] p-2 text-sm text-[#0E3435]"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="سبب التعديل (إلزامي)"
        aria-label="سبب التعديل"
        className="mt-3 w-full rounded-md border border-[rgba(14,52,53,0.15)] p-2 text-sm text-[#0E3435]"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "…" : "تسجيل التعديل"}
      </button>
      {msg ? <p className="mt-2 text-[11px] text-[rgba(14,52,53,0.6)]">{msg}</p> : null}
    </form>
  );
}
