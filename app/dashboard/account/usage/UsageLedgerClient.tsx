"use client";

import { useEffect, useMemo, useState } from "react";

// جدول سجل الاستخدام — يجلب /api/billing/ledger مع تصفية بالمصدر وتنزيل CSV.
// آمن على الجوال: الجدول ملفوف في حاوية overflow-x:auto ولا عرض ثابت مكسور.

interface LedgerEntry {
  id: string;
  points: number;
  balanceAfterPoints: number;
  source: string;
  description: string;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  TRIAL: "تجربة",
  SUBSCRIPTION: "اشتراك",
  PURCHASE: "نقاط مشتراة",
  PROMOTION: "ترويجية",
  REFUND: "استرداد",
  ADMIN_GRANT: "منح إداري",
  LEGACY_MIGRATION: "ترحيل",
};

const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;
const ar = (n: number) => n.toLocaleString("ar-SA");

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar-SA");
}

export function UsageLedgerClient() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/ledger?limit=100");
        if (!res.ok) {
          if (!cancelled) setError("تعذّر تحميل سجل الاستخدام.");
          return;
        }
        const data = (await res.json()) as { entries?: LedgerEntry[] };
        if (!cancelled) setEntries(Array.isArray(data.entries) ? data.entries : []);
      } catch {
        if (!cancelled) setError("تعذّر تحميل سجل الاستخدام.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sources = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.source));
    return Array.from(set);
  }, [entries]);

  const visible = useMemo(
    () => (filter === "ALL" ? entries : entries.filter((e) => e.source === filter)),
    [entries, filter]
  );

  function downloadCsv() {
    const header = ["التاريخ", "الوصف", "المصدر", "النقاط", "الرصيد بعد"];
    const rows = visible.map((e) => [
      fmtDate(e.createdAt),
      (e.description ?? "").replace(/"/g, '""'),
      sourceLabel(e.source),
      String(e.points),
      String(e.balanceAfterPoints),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\r\n");
    // BOM لدعم العربية في Excel.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hakeem-usage.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--ink-60)]">جارٍ تحميل السجل…</p>;
  }
  if (error) {
    return (
      <p
        role="status"
        className="mt-4 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] px-4 py-3 text-sm font-semibold text-[var(--ruby)]"
      >
        {error}
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="mt-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-60)]">
        لا توجد حركات في سجل الاستخدام بعد.
      </p>
    );
  }

  return (
    <div className="mt-4" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="usage-filter" className="text-sm text-[var(--ink-60)]">
            المصدر
          </label>
          <select
            id="usage-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="focus-ring min-h-[44px] rounded-[var(--r-md)] border border-[var(--gold-border)] bg-white px-3 py-2 text-sm text-[var(--navy)]"
          >
            <option value="ALL">الكل</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-4 py-2 text-sm font-semibold text-[var(--navy)]"
        >
          تنزيل CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--ink-08)] text-right text-[var(--ink-60)]">
              <th className="px-4 py-3 font-semibold">التاريخ</th>
              <th className="px-4 py-3 font-semibold">الوصف</th>
              <th className="px-4 py-3 font-semibold">المصدر</th>
              <th className="px-4 py-3 font-semibold">النقاط</th>
              <th className="px-4 py-3 font-semibold">الرصيد بعد</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id} className="border-b border-[var(--ink-04)] last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                  {fmtDate(e.createdAt)}
                </td>
                <td className="px-4 py-3 text-[var(--navy)]">{e.description || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-70)]">
                  {sourceLabel(e.source)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 font-semibold ${
                    e.points < 0 ? "text-[var(--ruby)]" : "text-[var(--petrol)]"
                  }`}
                >
                  {e.points > 0 ? "+" : ""}
                  {ar(e.points)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--navy)]">
                  {ar(e.balanceAfterPoints)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--ink-60)]">لا حركات لهذا المصدر.</p>
      ) : null}
    </div>
  );
}

export default UsageLedgerClient;
