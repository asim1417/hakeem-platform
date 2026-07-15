"use client";

import { useMemo, useState } from "react";

type SettingStatus = {
  key: string;
  label: string;
  secret: boolean;
  group: string;
  placeholder?: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  preview?: string;
};

const SOURCE_LABEL: Record<string, { text: string; tone: string }> = {
  db: { text: "من اللوحة", tone: "#0f766e" },
  env: { text: "من Vercel", tone: "#b45309" },
  none: { text: "غير مضبوط", tone: "#9ca3af" },
};

export function AdminSettingsForm({ initial }: { initial: SettingStatus[] }) {
  const [settings, setSettings] = useState<SettingStatus[]>(initial);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, SettingStatus[]>();
    for (const s of settings) {
      const g = m.get(s.group) ?? [];
      g.push(s);
      m.set(s.group, g);
    }
    return [...m.entries()];
  }, [settings]);

  async function save() {
    const updates = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== ""));
    if (Object.keys(updates).length === 0) {
      setMessage({ tone: "err", text: "لا تغييرات لحفظها." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "تعذّر الحفظ.");
      setSettings(data.settings);
      setEdits({});
      setMessage({ tone: "ok", text: `تم حفظ ${data.updated} مفتاحًا. يعمل فورًا؛ للتعميم الكامل أعد النشر أو انتظر دقائق.` });
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "تعذّر الحفظ." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {groups.map(([group, items]) => (
        <section key={group} className="rounded-[14px] border border-[#C09B5A]/25 bg-white p-5">
          <h3 className="mb-4 font-bold text-[#0B1F3A]">{group}</h3>
          <div className="space-y-4">
            {items.map((s) => {
              const src = SOURCE_LABEL[s.source];
              return (
                <div key={s.key} className="grid gap-2 md:grid-cols-[1fr_1.4fr] md:items-center">
                  <div>
                    <div className="text-sm font-semibold text-[#0B1F3A]">{s.label}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="rounded px-2 py-0.5" style={{ background: `${src.tone}1a`, color: src.tone }}>{src.text}</span>
                      {s.preview ? <span dir="ltr" className="text-[#0B1F3A]/50">{s.preview}</span> : null}
                    </div>
                  </div>
                  <input
                    dir="ltr"
                    type={s.secret ? "password" : "text"} aria-label={s.label}
                    autoComplete="off"
                    placeholder={s.hasValue ? "•••• (اترك فارغًا للإبقاء)" : s.placeholder ?? "أدخل القيمة"}
                    value={edits[s.key] ?? ""}
                    onChange={(e) => setEdits((p) => ({ ...p, [s.key]: e.target.value }))}
                    className="w-full rounded-md border border-[#C09B5A]/30 bg-[#FBF8F1] px-3 py-2 text-left text-sm outline-none focus:border-[#C09B5A]"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {message ? (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{
            background: message.tone === "ok" ? "#0f766e1a" : "#b912221a",
            color: message.tone === "ok" ? "#0f766e" : "#b91222",
          }}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-[#0B1F3A] px-6 py-3 font-semibold text-white transition hover:bg-[#0B1F3A]/90 disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </button>
        <span className="text-xs text-[#0B1F3A]/50">القيم الحسّاسة مُشفّرة في قاعدة البيانات ولا تُعرض.</span>
      </div>
    </div>
  );
}
