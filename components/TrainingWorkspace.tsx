"use client";

import { useMemo, useState } from "react";
import { trainingPaths } from "@/lib/modules/training/training-paths";

export function TrainingWorkspace({ initialPoints }: { initialPoints: number }) {
  const [selectedPath, setSelectedPath] = useState(trainingPaths[0].key);
  const [answer, setAnswer] = useState("");
  const [points, setPoints] = useState(initialPoints);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const path = useMemo(() => trainingPaths.find((item) => item.key === selectedPath) ?? trainingPaths[0], [selectedPath]);

  async function submitAttempt() {
    setLoading(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/training/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ pathKey: selectedPath, answer })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر حفظ محاولة التدريب.");
      setPoints(payload.progress.points);
      setStatus(payload.message);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ محاولة التدريب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-md border border-line bg-ivory p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-olive">مسارات التدريب</h2>
          <p className="rounded-md bg-sand px-3 py-2 text-sm text-ink">النقاط: {points.toLocaleString("ar-SA")}</p>
        </div>
        <div className="mt-4 space-y-3">
          {trainingPaths.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setSelectedPath(item.key)}
              className={`focus-ring w-full rounded-md border p-4 text-right ${
                selectedPath === item.key ? "border-gold bg-sand" : "border-line bg-ivory"
              }`}
            >
              <span className="block font-bold text-olive">{item.title}</span>
              <span className="mt-2 block text-sm leading-7 text-muted">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-ivory p-5">
        <p className="text-sm text-gold">التمرين الحالي</p>
        <h2 className="mt-2 text-2xl font-bold text-olive">{path.title}</h2>
        <p className="mt-3 rounded-md bg-sand p-4 leading-8 text-ink">{path.exercise}</p>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-olive">إجابتك التدريبية</span>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="focus-ring mt-2 min-h-44 w-full rounded-md border border-line px-4 py-3 leading-8"
            placeholder="اكتب إجابة مختصرة ومنظمة..."
          />
        </label>

        <button
          type="button"
          onClick={() => void submitAttempt()}
          disabled={loading || answer.trim().length < 10}
          className="focus-ring mt-4 rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جار حفظ المحاولة..." : "حفظ محاولة التدريب"}
        </button>

        {status ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{status}</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}
        <p className="mt-4 text-xs leading-6 text-muted">
          TODO: عند إضافة جدول محاولات تفصيلي لاحقًا، سيتم حفظ نص الإجابة والتقييم لكل تمرين بدل الاكتفاء بتحديث التقدم والنقاط.
        </p>
      </section>
    </div>
  );
}
