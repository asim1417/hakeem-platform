"use client";

import { useState } from "react";
import { GoldButton, LegalAlert, LegalCard, NavyButton } from "@/components/ui/legal";

type KeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  active: boolean;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export function AdminApiKeysManager({ initialKeys, scopes }: { initialKeys: KeyItem[]; scopes: string[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string>(""); // المفتاح الخام يُعرض مرة واحدة
  const [copied, setCopied] = useState(false);

  async function createKey() {
    setLoading(true);
    setError("");
    setNewKey("");
    setCopied(false);
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, scopes: ["legal:read"], rateLimit: Number(rateLimit) || 60 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "تعذر إنشاء المفتاح.");
      setKeys((current) => [{ ...payload.key, active: true } as KeyItem, ...current]);
      setNewKey(payload.apiKey as string);
      setName("");
      setRateLimit("60");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المفتاح.");
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    setError("");
    const response = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error ?? "تعذر إيقاف المفتاح.");
      return;
    }
    setKeys((current) => current.map((k) => (k.id === id ? { ...k, active: false } : k)));
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <LegalCard title="إنشاء مفتاح API" eyebrow="بوابة خارجية">
        <p className="mb-4 text-sm leading-7 text-[var(--ink-70)]">
          يُنشئ مفتاحًا بنطاق <code className="font-mono-legal">legal:read</code> للوصول إلى واجهات <code className="font-mono-legal">/api/legal/*</code>.
          المفتاح يظهر <b>مرة واحدة فقط</b> عند الإنشاء — احفظه فورًا.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="اسم المفتاح (لمن/لماذا)" value={name} onChange={setName} placeholder="مثال: شريك خارجي / تطبيق كذا" />
          <Field label="حدّ المعدّل (طلب/دقيقة)" value={rateLimit} onChange={setRateLimit} dir="ltr" placeholder="60" />
          <div className="flex items-end">
            <GoldButton type="button" onClick={() => void createKey()} disabled={loading || name.trim().length < 2}>
              {loading ? "جار الإنشاء..." : "إنشاء مفتاح"}
            </GoldButton>
          </div>
        </div>

        {newKey ? (
          <div className="mt-4">
            <LegalAlert tone="success">
              <div className="space-y-2">
                <p className="font-semibold">تم إنشاء المفتاح — انسخه الآن، لن يظهر مرة أخرى:</p>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 select-all break-all rounded-md border border-[var(--gold-border)] bg-ivory px-3 py-2 font-mono-legal text-sm text-[var(--navy)]">
                    {newKey}
                  </code>
                  <NavyButton type="button" onClick={() => void copyKey()} className="px-3 py-2 text-xs">
                    {copied ? "تم النسخ ✓" : "نسخ"}
                  </NavyButton>
                </div>
              </div>
            </LegalAlert>
          </div>
        ) : null}
        {error ? <div className="mt-4"><LegalAlert tone="danger">{error}</LegalAlert></div> : null}
      </LegalCard>

      <LegalCard title="المفاتيح">
        {keys.length === 0 ? (
          <LegalAlert>لا توجد مفاتيح بعد. أنشئ مفتاحًا من الأعلى.</LegalAlert>
        ) : (
          <div className="max-h-[64vh] overflow-auto rounded-[var(--r-lg)] border border-[var(--ink-08)]">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] text-[var(--navy)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th scope="col">الاسم</th>
                  <th scope="col">البادئة</th>
                  <th scope="col">النطاقات</th>
                  <th scope="col">الحدّ</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">آخر استخدام</th>
                  <th scope="col">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-[var(--ink-04)] transition odd:bg-ivory even:bg-[var(--hakeem-bg-soft)] hover:bg-[var(--gold-ghost)]">
                    <td className="px-4 py-3 font-semibold text-[var(--navy)]">{k.name}</td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-70)]" dir="ltr">{k.keyPrefix}…</td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-60)]" dir="ltr">{k.scopes.join(", ")}</td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-70)]">{k.rateLimit}/دقيقة</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={
                          k.active
                            ? { color: "var(--emerald)", background: "var(--emerald-soft)", border: "1px solid rgba(26,92,65,0.30)" }
                            : { color: "var(--ruby)", background: "var(--ruby-soft)", border: "1px solid rgba(140,34,51,0.30)" }
                        }
                      >
                        <span aria-hidden>{k.active ? "●" : "○"}</span>
                        {k.active ? "فعّال" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-60)]">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ar-SA") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {k.active ? (
                        <NavyButton type="button" onClick={() => void revokeKey(k.id)} className="px-3 py-2 text-xs">
                          إيقاف
                        </NavyButton>
                      ) : (
                        <span className="text-xs text-[var(--ink-40)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LegalCard>
    </div>
  );
}

function Field({ label, value, onChange, dir = "rtl", placeholder }: { label: string; value: string; onChange: (value: string) => void; dir?: "rtl" | "ltr"; placeholder?: string }) {
  return (
    <label>
      <span className="text-sm font-semibold text-[var(--navy)]">{label}</span>
      <input value={value} dir={dir} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C69763]/25 px-4 py-3" />
    </label>
  );
}
