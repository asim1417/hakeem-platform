"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ENTITY_TYPES = [
  { value: "consultation", label: "استشارة" },
  { value: "judgment", label: "حكم" },
  { value: "document", label: "مستند" },
  { value: "case", label: "قضية" },
  { value: "other", label: "أخرى" },
];

/** إنشاء جلسة مراجعة (§12) — يستدعي POST /api/review/sessions. */
export function CreateReviewSession() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [entityType, setEntityType] = useState("consultation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, entityType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "تعذّر الإنشاء.");
      setTitle("");
      if (data?.session?.id) router.push(`/dashboard/review/${data.session.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[rgba(14,52,53,0.12)] bg-white p-4" dir="rtl">
      <h2 className="mb-3 text-base font-semibold text-[#0E3435]">جلسة مراجعة جديدة</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الجلسة (مثل: مراجعة مذكّرة جوابية)"
          className="flex-1 rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm"
          maxLength={200}
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50"
        >
          {busy ? "..." : "إنشاء"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-[#B45309]">{error}</p> : null}
    </form>
  );
}
