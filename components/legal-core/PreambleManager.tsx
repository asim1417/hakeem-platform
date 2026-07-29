"use client";

import { useState } from "react";

// لوحة إدارة الديباجات: تحقّقٌ من وجود النظام/الديباجة، واستيرادُ ديباجةٍ (مادّة رقم صفر) مع
// توليد متجهها وفهرستها — دفعةً واحدة. النصّ يُدخِله المشرف من المصدر الرسميّ (لا يُختلَق).

type SystemStatus = {
  system: string;
  hasPreamble: boolean;
  preambleChars: number;
  embedded: boolean;
};

export function PreambleManager() {
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ list: SystemStatus[]; note?: string } | null>(null);

  const [lawName, setLawName] = useState("");
  const [preamble, setPreamble] = useState("");
  const [decree, setDecree] = useState("");
  const [effective, setEffective] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; suggestions?: string[] } | null>(null);

  async function check() {
    if (checking || !query.trim()) return;
    setChecking(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/legal-core/preambles?system=${encodeURIComponent(query.trim())}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "تعذّر التحقّق.");
      setStatus({ list: data.systems ?? [], note: data.message });
    } catch (e) {
      setStatus({ list: [], note: e instanceof Error ? e.message : "تعذّر التحقّق." });
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    if (saving || !lawName.trim() || !preamble.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/legal-core/preambles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawName: lawName.trim(),
          preamble: preamble.trim(),
          royalDecree: decree.trim() || undefined,
          effectiveFrom: effective.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setResult({ ok: false, text: data?.message ?? "تعذّر الحفظ.", suggestions: data?.suggestions });
        return;
      }
      setResult({ ok: true, text: data.message });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "تعذّر الحفظ." });
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold)]";

  return (
    <div className="space-y-5" dir="rtl">
      {/* تحقّق */}
      <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-4">
        <p className="text-sm font-bold text-[var(--navy)]">تحقّق من نظامٍ وديباجته</p>
        <p className="mt-0.5 mb-3 text-xs leading-6 text-[var(--ink-60)]">
          اكتب اسم النظام (أو جزءًا منه) لتعرف: هل النظام موجود في النواة؟ وله ديباجة؟ ومُضمَّنة للبحث الدلاليّ؟
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className={field + " flex-1 min-w-[220px]"}
            placeholder="مثال: المعاملات المدنية"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void check()}
          />
          <button type="button" onClick={() => void check()} disabled={checking || !query.trim()} className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:opacity-50">
            {checking ? "جارٍ…" : "تحقّق"}
          </button>
        </div>
        {status ? (
          <div className="mt-3 space-y-2">
            {status.list.length ? (
              status.list.map((s) => (
                <div key={s.system} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--ink-08)] bg-white/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--navy)]">{s.system}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge ok tone="emerald">موجود</Badge>
                    <Badge ok={s.hasPreamble} tone={s.hasPreamble ? "emerald" : "amber"}>
                      {s.hasPreamble ? `ديباجة (${s.preambleChars.toLocaleString("ar-SA")} حرف)` : "لا ديباجة"}
                    </Badge>
                    {s.hasPreamble ? (
                      <Badge ok={s.embedded} tone={s.embedded ? "emerald" : "amber"}>{s.embedded ? "مُضمَّنة" : "غير مُضمَّنة"}</Badge>
                    ) : null}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-[var(--r-sm)] bg-[var(--amber-soft)] p-2.5 text-xs leading-6 text-[var(--amber)]">{status.note ?? "لا نتائج."}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* استيراد */}
      <div className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
        <p className="text-sm font-bold text-[var(--navy)]">استيراد/تحديث ديباجة</p>
        <p className="mt-0.5 mb-3 text-xs leading-6 text-[var(--ink-60)]">
          الصق نصّ الديباجة الحرفيّ من مصدره الرسميّ (أمّ القرى/المرسوم). تُخزَّن مادّةً رقمها صفر، وتُولَّد متجهها وتُفهرَس فورًا. لا تُدخِل نصًّا غير موثّق.
        </p>
        <div className="grid gap-2">
          <input className={field} placeholder="اسم النظام كما في النواة (مطابقة حرفيّة)" value={lawName} onChange={(e) => setLawName(e.target.value)} />
          <textarea className={field + " min-h-[140px] resize-y font-judicial leading-8"} placeholder="نصّ الديباجة…" value={preamble} onChange={(e) => setPreamble(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <input className={field + " flex-1 min-w-[150px]"} placeholder="المرسوم الملكيّ (اختياريّ، مثل م/191)" value={decree} onChange={(e) => setDecree(e.target.value)} />
            <input className={field + " flex-1 min-w-[150px]"} type="date" title="تاريخ النفاذ (اختياريّ)" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </div>
          <div>
            <button type="button" onClick={() => void save()} disabled={saving || !lawName.trim() || !preamble.trim()} className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:opacity-50">
              {saving ? "جارٍ الحفظ والتضمين…" : "حفظ الديباجة"}
            </button>
          </div>
        </div>
        {result ? (
          <div className="mt-3 rounded-[var(--r-sm)] p-2.5 text-xs leading-6" style={result.ok ? { color: "var(--emerald)", background: "var(--emerald-soft)" } : { color: "var(--ruby)", background: "var(--ruby-soft)" }}>
            {result.ok ? "✓ " : "✕ "}{result.text}
            {result.suggestions?.length ? (
              <span className="mt-1 block">
                أنظمةٌ قريبة:{" "}
                {result.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setLawName(s)} className="mx-0.5 rounded bg-white/60 px-1.5 py-0.5 font-semibold text-[var(--navy)] underline-offset-2 hover:underline">
                    {s}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Badge({ children, ok, tone }: { children: React.ReactNode; ok?: boolean; tone: "emerald" | "amber" }) {
  const style = tone === "emerald"
    ? { color: "var(--emerald)", background: "var(--emerald-soft)" }
    : { color: "var(--amber)", background: "var(--amber-soft)" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={style}>
      {ok ? "✓" : "—"} {children}
    </span>
  );
}
