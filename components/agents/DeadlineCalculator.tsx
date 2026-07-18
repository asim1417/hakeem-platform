"use client";

import { useState } from "react";
import { computeDeadline } from "@/lib/agent-runtime/tools/hijriDateCalc";

// حاسبة المهلة — أداة hijri_date_calc حيّةً في الواجهة (حسابٌ حتميّ في المتصفّح، بلا خادم).
// جمع الأيام دقيقٌ (JDN)؛ قد يخالف أم القرى الرسميّ بيومٍ لمهلةٍ مُلزِمة.
export function DeadlineCalculator() {
  const [y, setY] = useState(1447);
  const [mo, setMo] = useState(1);
  const [d, setD] = useState(1);
  const [period, setPeriod] = useState(30);
  const [out, setOut] = useState<null | { dueH: string; dueG: string }>(null);
  const [err, setErr] = useState<string | null>(null);

  const compute = () => {
    setErr(null);
    if (![y, mo, d, period].every(Number.isFinite) || mo < 1 || mo > 12 || d < 1 || d > 30 || period < 0) {
      setErr("أدخل تاريخًا هجريًّا صحيحًا ومدّةً غير سالبة.");
      setOut(null);
      return;
    }
    const r = computeDeadline({ year: y, month: mo, day: d }, period);
    setOut({
      dueH: `${r.due.year}/${r.due.month}/${r.due.day}هـ`,
      dueG: `${r.dueGregorian.year}-${String(r.dueGregorian.month).padStart(2, "0")}-${String(r.dueGregorian.day).padStart(2, "0")}م`,
    });
  };

  const field = (label: string, value: number, set: (n: number) => void, min: number, max: number) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseInt(e.target.value, 10))}
        className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]"
      />
    </label>
  );

  return (
    <div className="rounded-[var(--r-xl)] border border-line bg-ivory p-5 shadow-sm" dir="rtl">
      <h3 className="text-lg font-bold text-[var(--petrol)]">حاسبة المهلة (هجريّ)</h3>
      <p className="mt-1 text-sm leading-7 text-[var(--muted)]">تاريخ التبليغ + عدد الأيام ← تاريخ انتهاء المهلة. حسابٌ حتميّ دقيق على JDN.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("السنة", y, setY, 1300, 1600)}
        {field("الشهر", mo, setMo, 1, 12)}
        {field("اليوم", d, setD, 1, 30)}
        {field("المدّة (أيام)", period, setPeriod, 0, 100000)}
      </div>
      <button
        type="button"
        onClick={compute}
        className="mt-4 rounded-[var(--r-md)] bg-[var(--petrol)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        احسب المهلة
      </button>
      {err ? <p className="mt-3 text-sm text-[var(--ruby)]">{err}</p> : null}
      {out ? (
        <div className="mt-4 rounded-[var(--r-lg)] border border-line bg-[var(--surface)] p-4">
          <p className="text-sm">تنتهي المهلة: <span className="font-bold text-[var(--petrol)]">{out.dueH}</span> — الموافق <span className="font-semibold">{out.dueG}</span></p>
          <p className="mt-2 text-xs leading-6 text-[var(--muted)]">تنبيه: الاحتساب يبدأ من تاريخ التبليغ الفعليّ؛ قد يخالف تقويم أم القرى الرسميّ بيومٍ لمهلةٍ مُلزِمة — طابِق النصّ النافذ قبل البناء عليها.</p>
        </div>
      ) : null}
    </div>
  );
}
