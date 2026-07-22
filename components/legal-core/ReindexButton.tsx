"use client";

import { useState } from "react";

// زرّ إدارة: إعادة فهرسة بحث النواة (يملأ search_norm) كي تُطابِق الخدمات موادَّ المكتبة.
export function ReindexButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(all: boolean) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/legal-core/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "تعذّرت الفهرسة.");
      setMsg({ ok: true, text: data.message });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذّرت الفهرسة." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--navy)]">فهرسة بحث النواة</p>
          <p className="mt-0.5 text-xs leading-6 text-[var(--ink-60)]">
            بعد استيراد الأنظمة، شغّل هذا مرّةً كي تُطابِق خدمات المعاون و«اسأل حكيم» موادَّ المكتبة (يملأ عمود البحث المُفهرَس).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => void run(false)} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:opacity-50">
            {busy ? "جارٍ الفهرسة…" : "فهرسة الجديد"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-4 py-2 text-sm font-semibold text-[var(--navy)] transition hover:border-[var(--navy)] disabled:opacity-50">
            إعادة بناء الكلّ
          </button>
        </div>
      </div>
      {msg ? (
        <div className="mt-3 rounded-[var(--r-sm)] p-2.5 text-xs leading-6" style={msg.ok ? { color: "var(--emerald)", background: "var(--emerald-soft)" } : { color: "var(--ruby)", background: "var(--ruby-soft)" }}>
          {msg.ok ? "✓ " : "✕ "}{msg.text}
        </div>
      ) : null}
    </div>
  );
}
