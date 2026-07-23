"use client";

import { useState } from "react";

type ToggleItem = {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  uiOnly: boolean;
};

export function FeatureTogglesManager({ initial }: { initial: ToggleItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  async function applyToggle(key: string, enabled: boolean) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/feature-toggles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ key, enabled, confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر تحديث الراية.");
      setItems((prev) => prev.map((t) => (t.key === key ? { ...t, enabled } : t)));
      setMessage(enabled ? `تم تفعيل: ${key}` : `تم إخفاء الواجهة: ${key}`);
      setConfirmKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التحديث.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-[#B42318]">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#0E3435]">{item.label}</p>
                <p className="mt-1 text-sm leading-7 text-[rgba(14,52,53,0.68)]">{item.description}</p>
                <p className="mt-2 text-xs text-[rgba(14,52,53,0.5)]">
                  {item.uiOnly ? "واجهة فقط — لا يوقف المحرك الخلفي" : "يؤثر على التشغيل"} · {item.key}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    item.enabled
                      ? "rounded px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700"
                      : "rounded px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-700"
                  }
                >
                  {item.enabled ? "ظاهر" : "مخفي"}
                </span>
                {confirmKey === item.key ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === item.key}
                      onClick={() => void applyToggle(item.key, !item.enabled)}
                      className="rounded-md bg-[#0E3435] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      تأكيد
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmKey(null)}
                      className="rounded-md border border-[rgba(14,52,53,0.15)] px-3 py-2 text-sm"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setConfirmKey(item.key)}
                    className="rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3 py-2 text-sm font-semibold text-[#0E3435] hover:bg-[#F7F2EA]"
                  >
                    {item.enabled ? "إخفاء" : "إظهار"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
