"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AdminBillingUserActions({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function run(action: "activate" | "revoke" | "reset_quota") {
    startTransition(async () => {
      setMsg("");
      try {
        const res = await fetch("/api/admin/billing/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!res.ok || data.ok === false) {
          setMsg(data.message || "فشلت العملية");
          return;
        }
        setMsg("تم.");
        router.refresh();
      } catch {
        setMsg("خطأ شبكة");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1.5">
        {isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("revoke")}
            className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2.5 py-1 text-xs font-semibold text-[#0E3435] disabled:opacity-50"
          >
            إلغاء الاشتراك
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("activate")}
            className="rounded-md bg-[#0E3435] px-2.5 py-1 text-xs font-semibold text-[#FFFcf7] disabled:opacity-50"
          >
            تفعيل اشتراك
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reset_quota")}
          className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-2.5 py-1 text-xs font-semibold text-[#0E3435] disabled:opacity-50"
        >
          تصفير الحصّة
        </button>
      </div>
      {msg ? <span className="text-[11px] text-[rgba(14,52,53,0.6)]">{msg}</span> : null}
    </div>
  );
}
