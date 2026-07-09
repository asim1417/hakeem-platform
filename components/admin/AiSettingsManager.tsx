"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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

// النموذج الموصى به لكل مزوّد (يُقترح كـ placeholder ويُملأ تلقائياً إن تُرك فارغاً).
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
  custom: ""
};

// تلميح صيغة المفتاح لكل مزوّد.
const KEY_HINTS: Record<string, string> = {
  anthropic: "مفتاح Anthropic يبدأ بـ sk-ant-api… (وليس sk-ant-admin…). أنشئه من console.anthropic.com ← Settings ← API Keys.",
  openai: "مفتاح OpenAI يبدأ بـ sk-… من platform.openai.com.",
  gemini: "مفتاح Google AI Studio.",
  custom: "مفتاح المزوّد المخصّص حسب توثيقه."
};

export function AiSettingsManager({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [provider, setProvider] = useState(initialStatus.provider === "offline" ? "openai" : initialStatus.provider);
  const [model, setModel] = useState(initialStatus.model ?? "");
  const [baseUrl, setBaseUrl] = useState(initialStatus.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [busy, setBusy] = useState(false);

  // كشف المفتاح المحفوظ — خلف تأكيد صريح، ويُسجَّل في سجلّ التدقيق.
  async function revealStored() {
    if (!window.confirm("سيُعرض المفتاح المحفوظ كاملاً مرّة واحدة، وستُسجَّل العملية في سجلّ التدقيق. هل تريد المتابعة؟")) return;
    setRevealing(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal: true })
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload?.message ?? "تعذّر كشف المفتاح.");
      if (!payload.revealedKey) {
        setMsg({ tone: "info", text: "لا يوجد مفتاح محفوظ لكشفه." });
      } else {
        setRevealedKey(payload.revealedKey as string);
      }
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "تعذّر كشف المفتاح." });
    } finally {
      setRevealing(false);
    }
  }

  // عند تغيير المزوّد: اقترح نموذجه الموصى به إن لم يُدخِل المستخدم نموذجاً.
  function onProviderChange(next: string) {
    setProvider(next);
    setModel((prev) => (prev.trim() ? prev : DEFAULT_MODELS[next] ?? ""));
    setShowKey(false);
  }
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
          <div dir="ltr" className="text-right">
            <span dir="rtl">المفتاح: </span>
            <span className="select-all break-all font-mono-legal">{revealedKey ?? status.keyMasked ?? "—"}</span>
          </div>
        </div>
        {status.configured ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {revealedKey ? (
              <>
                <button type="button" onClick={() => setRevealedKey(null)} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--navy)]">
                  <EyeOff size={14} aria-hidden /> إخفاء
                </button>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(revealedKey)} className="focus-ring rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--navy)]">
                  نسخ
                </button>
                <span className="text-[11px] text-[var(--amber)]">سُجِّلت عملية الكشف في سجلّ التدقيق.</span>
              </>
            ) : (
              <button type="button" onClick={() => void revealStored()} disabled={revealing} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[rgba(184,114,26,.35)] bg-[var(--amber-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--amber)] hover:opacity-90 disabled:opacity-50">
                <Eye size={14} aria-hidden /> {revealing ? "جارٍ…" : "كشف المفتاح المحفوظ"}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* النموذج */}
      <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-5 shadow-[var(--sh-xs)]">
        <h2 className="t-head text-base font-bold text-[var(--navy)]">تعديل الإعداد</h2>
        <p className="mt-1 text-sm text-[var(--ink-60)]">يُحفظ المفتاح مشفّراً في قاعدة البيانات ولا يظهر بعد الحفظ. يرثه «اسأل حكيم» والقاضي التفاعلي.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">المزوّد</span>
            <select value={provider} onChange={(e) => onProviderChange(e.target.value)} className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3">
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">النموذج (اختياري)</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} dir="ltr" placeholder={DEFAULT_MODELS[provider] || "اسم النموذج"} className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 py-3 text-left font-mono-legal text-sm" />
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
          <div className="relative mt-2">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              dir="ltr"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={status.configured ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : DEFAULT_MODELS[provider] !== undefined && provider === "anthropic" ? "sk-ant-api03-..." : "sk-..."}
              className="focus-ring w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white py-3 pe-4 ps-12 text-left font-mono-legal text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              aria-pressed={showKey}
              title={showKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              className="focus-ring absolute inset-y-0 left-0 my-1.5 ms-1.5 grid w-9 place-items-center rounded-[var(--r-sm)] text-[var(--ink-60)] hover:bg-[var(--ink-04)] hover:text-[var(--navy)]"
            >
              {showKey ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-[var(--ink-50)]">{KEY_HINTS[provider] ?? ""}</p>
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
        يُنشأ جدول <span className="font-mono-legal">app_settings</span> تلقائياً عند أول حفظ (لا حاجة لأي أمر يدوي)، ويُخزَّن المفتاح
        مشفّراً ولا يُعاد للمتصفح أبداً. إن تعذّر الحفظ في القاعدة يعمل التطبيق بمتغيرات البيئة دون تعطّل. زرّ
        «حفظ واختبار الاتصال» يتحقّق من المفتاح فعلياً بنداء تجريبي للمزوّد.
      </p>
    </div>
  );
}
