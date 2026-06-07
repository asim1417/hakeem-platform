"use client";

import { useState } from "react";

type Status = {
  provider: string;
  model: string | null;
  source: "db" | "env" | "offline";
  configured: boolean;
  keyMasked: string | null;
  baseUrl: string | null;
};

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
  { value: "custom", label: "مزوّد مخصّص" },
  { value: "offline", label: "بدون (offline)" }
];

const sourceLabel: Record<string, string> = {
  db: "إعداد الموقع (قاعدة البيانات)",
  env: "متغيرات البيئة",
  offline: "غير مفعّل"
};

export function AiSettingsManager({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [provider, setProvider] = useState(initialStatus.provider === "offline" ? "openai" : initialStatus.provider);
  const [model, setModel] = useState(initialStatus.model ?? "");
  const [baseUrl, setBaseUrl] = useState(initialStatus.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  async function save(test: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model: model || undefined, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined, test })
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.message ?? "تعذّر الحفظ.");
      setStatus(payload.status);
      setApiKey("");
      if (payload.test) {
        setMsg({ tone: payload.test.ok ? "success" : "danger", text: `${payload.test.ok ? "✓" : "✕"} ${payload.test.message}` });
      } else {
        setMsg({ tone: "success", text: "✓ تم حفظ الإعداد." });
      }
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "تعذّر الحفظ." });
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    status.source === "db" ? "var(--emerald)" : status.source === "env" ? "var(--amber)" : "var(--ruby)";
  const statusBg =
    status.source === "db" ? "var(--emerald-soft)" : status.source === "env" ? "var(--amber-soft)" : "var(--ruby-soft)";

  return (
    <div className="space-y-5">
      {/* الحالة */}
      <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-5 shadow-[var(--sh-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--gold-dark)]">الحالة الحالية</p>
            <p className="mt-1 text-lg font-bold text-[var(--navy)]">
              {status.configured ? `مفعّل · ${PROVIDERS.find((p) => p.value === status.provider)?.label ?? status.provider}` : "غير مفعّل (offline)"}
            </p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: statusTone, background: statusBg }}>
            المصدر: {sourceLabel[status.source]}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-[var(--ink-70)] md:grid-cols-3">
          <div>المزوّد: <span className="font-semibold text-[var(--navy)]">{status.provider}</span></div>
          <div>النموذج: <span className="font-mono-legal">{status.model || "—"}</span></div>
          <div>المفتاح: <span className="font-mono-legal">{status.keyMasked || "—"}</span></div>
        </div>
      </div>

      {/* النموذج */}
      <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-5 shadow-[var(--sh-xs)]">
        <h2 className="t-head text-base font-bold text-[var(--navy)]">تعديل الإعداد</h2>
        <p className="mt-1 text-sm text-[var(--ink-60)]">يُحفظ المفتاح مشفّراً في قاعدة البيانات ولا يظهر بعد الحفظ. يرثه «اسأل حكيم» والقاضي التفاعلي.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">المزوّد</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3">
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">النموذج (اختياري)</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} dir="ltr" placeholder="gpt-4o-mini" className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3 text-left font-mono-legal text-sm" />
          </label>
        </div>

        {provider === "custom" ? (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[var(--navy)]">عنوان المزوّد المخصّص (Base URL)</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} dir="ltr" placeholder="https://..." className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3 text-left font-mono-legal text-sm" />
          </label>
        ) : null}

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-[var(--navy)]">مفتاح الـ API</span>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} dir="ltr" type="password" placeholder={status.configured ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : "sk-..."} className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3 text-left font-mono-legal text-sm" />
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void save(false)} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:opacity-50">
            {busy ? "جارٍ…" : "حفظ"}
          </button>
          <button type="button" onClick={() => void save(true)} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--gold-ghost)] disabled:opacity-50">
            حفظ واختبار الاتصال
          </button>
        </div>

        {msg ? (
          <div
            className="mt-4 rounded-[var(--r-md)] p-3 text-sm leading-7"
            style={
              msg.tone === "success"
                ? { color: "var(--emerald)", background: "var(--emerald-soft)" }
                : msg.tone === "danger"
                ? { color: "var(--ruby)", background: "var(--ruby-soft)" }
                : { color: "var(--ink-70)", background: "var(--ink-04)" }
            }
          >
            {msg.text}
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-6 text-[var(--ink-40)]">
        ملاحظة تشغيل: يتطلب الإعداد في القاعدة تشغيل <span className="font-mono-legal">prisma db push</span> مرة واحدة لإنشاء جدول
        <span className="font-mono-legal"> app_settings</span>. قبلها يعمل التطبيق بمتغيرات البيئة دون تعطّل.
      </p>
    </div>
  );
}
