"use client";

import { useState } from "react";
import { GoldButton, LegalAlert, LegalCard, NavyButton } from "@/components/ui/legal";

type Connection = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  active: boolean;
  userEmail?: string;
  userName?: string;
};

type PersonalKey = {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

const REASONS: Record<string, string> = {
  user: "ألغيته أنت",
  admin: "ألغاه المشرف",
  relinked: "أُعيد الربط",
  refresh_reuse: "أُوقف احترازيًا",
  code_reuse: "أُوقف احترازيًا",
  idle: "انتهى لعدم الاستخدام",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={
        active
          ? { color: "var(--emerald)", background: "var(--emerald-soft)", border: "1px solid rgba(26,92,65,0.30)" }
          : { color: "var(--ink-60)", background: "var(--hakeem-bg-soft)", border: "1px solid var(--ink-08)" }
      }
    >
      {label}
    </span>
  );
}

/** «التطبيقات المرتبطة» للمستخدم، أو قائمة الروابط النشطة للمشرف (admin). */
export function ConnectionsManager({
  initialConnections,
  initialKeys = [],
  mcpUrl,
  admin = false,
}: {
  initialConnections: Connection[];
  initialKeys?: PersonalKey[];
  mcpUrl: string;
  admin?: boolean;
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [keys, setKeys] = useState(initialKeys);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revokeConnection(id: string) {
    setError("");
    const url = admin ? `/api/admin/mcp-grants/${id}` : `/api/connections/${id}`;
    const res = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body?.error ?? "تعذّر إلغاء الربط.");
      return;
    }
    setConnections((list) =>
      admin
        ? list.filter((c) => c.id !== id)
        : list.map((c) => (c.id === id ? { ...c, active: false, revokedAt: new Date().toISOString(), revokedReason: "user" } : c))
    );
  }

  async function createKey() {
    setBusy(true);
    setError("");
    setNewKey("");
    setCopied(false);
    try {
      const res = await fetch("/api/connections/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: keyName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "تعذّر إنشاء المفتاح.");
      setKeys((list) => [body.key as PersonalKey, ...list]);
      setNewKey(body.apiKey as string);
      setKeyName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إنشاء المفتاح.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setError("");
    const res = await fetch(`/api/connections/keys/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body?.error ?? "تعذّر إيقاف المفتاح.");
      return;
    }
    setKeys((list) => list.map((k) => (k.id === id ? { ...k, active: false } : k)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {!admin ? (
        <LegalCard title="اربط Claude أو ChatGPT بحسابك" eyebrow="موصل حكيم">
          <ol className="list-decimal space-y-2 pr-5 leading-8 text-[var(--ink)]">
            <li>في Claude أو ChatGPT أضف موصلًا جديدًا بهذا الرابط:</li>
          </ol>
          <div className="mt-2 flex items-center gap-2">
            <code dir="ltr" className="flex-1 select-all break-all rounded-md border border-[var(--gold-border)] bg-ivory px-3 py-2 font-mono-legal text-sm text-[var(--navy)]">
              {mcpUrl}
            </code>
            <NavyButton type="button" className="px-3 py-2 text-xs" onClick={() => void copy(mcpUrl)}>
              نسخ
            </NavyButton>
          </div>
          <ol start={2} className="mt-2 list-decimal space-y-2 pr-5 leading-8 text-[var(--ink)]">
            <li>اضغط «Connect»، وسجّل الدخول بحساب حكيم إن طُلب منك.</li>
            <li>وافق على الطلب، فيظهر الربط هنا.</li>
          </ol>
        </LegalCard>
      ) : null}

      {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

      <LegalCard title={admin ? "الروابط النشطة" : "التطبيقات المرتبطة"}>
        {connections.length === 0 ? (
          <LegalAlert>{admin ? "لا توجد روابط نشطة." : "لم تربط أي تطبيق بعد."}</LegalAlert>
        ) : (
          <ul className="divide-y divide-[var(--ink-08)]">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--navy)]">
                    {c.clientName}
                    {admin && c.userEmail ? (
                      <span dir="ltr" className="mr-2 font-mono-legal text-xs font-normal text-[var(--ink-60)]">
                        {c.userEmail}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-[var(--ink-60)]">
                    رُبط {fmt(c.createdAt)} · آخر استخدام {fmt(c.lastUsedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill active={c.active} label={c.active ? "مرتبط" : REASONS[c.revokedReason ?? ""] ?? "ملغى"} />
                  {c.active ? (
                    <NavyButton type="button" className="px-3 py-2 text-xs" onClick={() => void revokeConnection(c.id)}>
                      إلغاء الربط
                    </NavyButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </LegalCard>

      {!admin ? (
        <LegalCard title="المفاتيح الشخصية" eyebrow="للمطوّرين">
          <p className="mb-4 text-sm leading-7 text-[var(--ink-70)]">
            لأدوات تتصل بحكيم بمفتاح بدل زر Connect. يُرسل في ترويسة <code className="font-mono-legal">Authorization: Bearer</code>،
            ويُحسب استهلاكه على حسابك. يظهر المفتاح <b>مرة واحدة فقط</b>.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm text-[var(--ink-70)]">
              اسم المفتاح
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="مثال: أداة المكتب"
                className="rounded-md border border-[var(--ink-08)] bg-ivory px-3 py-2 text-[var(--ink)]"
              />
            </label>
            <GoldButton type="button" disabled={busy || keyName.trim().length < 2} onClick={() => void createKey()}>
              {busy ? "جار الإنشاء..." : "إنشاء مفتاح"}
            </GoldButton>
          </div>

          {newKey ? (
            <div className="mt-4">
              <LegalAlert tone="success">
                <span className="block font-semibold">انسخ المفتاح الآن، لن يظهر مرة أخرى:</span>
                <span className="mt-2 flex items-center gap-2">
                  <code dir="ltr" className="flex-1 select-all break-all rounded-md border border-[var(--gold-border)] bg-ivory px-3 py-2 font-mono-legal text-sm text-[var(--navy)]">
                    {newKey}
                  </code>
                  <NavyButton type="button" className="px-3 py-2 text-xs" onClick={() => void copy(newKey)}>
                    {copied ? "تم النسخ" : "نسخ"}
                  </NavyButton>
                </span>
              </LegalAlert>
            </div>
          ) : null}

          {keys.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--ink-08)]">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--navy)]">{k.name}</p>
                    <p className="text-sm text-[var(--ink-60)]">
                      <span dir="ltr" className="font-mono-legal">{k.keyPrefix}…</span> · أُنشئ {fmt(k.createdAt)} · آخر استخدام{" "}
                      {fmt(k.lastUsedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill active={k.active} label={k.active ? "نشط" : "موقوف"} />
                    {k.active ? (
                      <NavyButton type="button" className="px-3 py-2 text-xs" onClick={() => void revokeKey(k.id)}>
                        إيقاف
                      </NavyButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </LegalCard>
      ) : null}
    </div>
  );
}
