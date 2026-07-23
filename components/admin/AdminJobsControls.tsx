"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** شريط أدوات المهام + أزرار صف. */
export function AdminJobsToolbar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function reap() {
    startTransition(async () => {
      setMessage("");
      try {
        const res = await fetch("/api/admin/jobs/reap-stale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxAgeMinutes: 30 }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          reaped?: number;
        };
        if (!res.ok || data.ok === false) {
          setMessage(data.message || "تعذّر الحصاد.");
          return;
        }
        setMessage(`تم حصاد ${data.reaped ?? 0} مهمة متوقفة.`);
        router.refresh();
      } catch {
        setMessage("تعذّر الاتصال بالخادم.");
      }
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={reap}
        className="inline-flex min-h-[44px] items-center rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-4 text-sm font-semibold text-[#0E3435] hover:bg-[#F7F2EA] disabled:opacity-50"
      >
        حصاد المهام المتوقفة (+30 د)
      </button>
      {message ? (
        <p className="text-sm text-[rgba(14,52,53,0.7)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminJobRowActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  function act(path: string) {
    startTransition(async () => {
      setErr("");
      try {
        const res = await fetch(path, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!res.ok || data.ok === false) {
          setErr(data.message || "فشلت العملية");
          return;
        }
        router.refresh();
      } catch {
        setErr("خطأ شبكة");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        {status === "running" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(`/api/admin/jobs/${jobId}/cancel`)}
            className="rounded-md bg-[#0E3435] px-3 py-1.5 text-xs font-semibold text-[#FFFcf7] disabled:opacity-50"
          >
            إيقاف
          </button>
        ) : null}
        {status === "error" || status === "cancelled" || status === "done" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(`/api/admin/jobs/${jobId}/retry`)}
            className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#0E3435] disabled:opacity-50"
            title="يسجّل مهمة بانتظار إعادة التنفيذ — أكمل من واجهة المستخدم"
          >
            تسجيل إعادة
          </button>
        ) : null}
      </div>
      {err ? <span className="text-[11px] text-[#B42318]">{err}</span> : null}
    </div>
  );
}
