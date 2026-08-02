"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * محرّر سعر خدمة واحدة (بالنقاط) مع سبب إلزامي.
 * POST /api/admin/billing/service-rates ثم إعادة تحميل. لا تأثير رجعي على السجلات.
 */
export function ServiceRateEditor({
  serviceCode,
  currentPoints,
}: {
  serviceCode: string;
  currentPoints: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [points, setPoints] = useState(String(currentPoints));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts < 0) {
      setMsg("قيمة نقاط غير صحيحة.");
      return;
    }
    if (reason.trim().length < 3) {
      setMsg("السبب إلزامي.");
      return;
    }
    startTransition(async () => {
      setMsg("");
      try {
        const res = await fetch("/api/admin/billing/service-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceCode, points: pts, reason: reason.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!res.ok || data.ok === false) {
          setMsg(data.message || "فشل التعديل.");
          return;
        }
        setMsg("تم.");
        setReason("");
        router.refresh();
      } catch {
        setMsg("خطأ شبكة.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          aria-label={`نقاط ${serviceCode}`}
          className="w-20 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2 py-1 text-sm text-[#0E3435]"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (إلزامي)"
          aria-label={`سبب تعديل ${serviceCode}`}
          className="w-40 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2 py-1 text-sm text-[#0E3435]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#0E3435] px-2.5 py-1 text-xs font-semibold text-[#FFFcf7] disabled:opacity-50"
        >
          {pending ? "…" : "حفظ"}
        </button>
      </div>
      {msg ? <span className="text-[11px] text-[rgba(14,52,53,0.6)]">{msg}</span> : null}
    </form>
  );
}
