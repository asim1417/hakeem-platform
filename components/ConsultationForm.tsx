"use client";

import { useState } from "react";

type Citation = {
  articleId: string;
  lawName: string;
  articleNumber: number;
  quote: string;
};

type ConsultationResult = {
  summary: string;
  analysis: string;
  result: string;
  citations: Citation[];
  warning: string;
  consultationId?: string;
  blocked?: boolean;
};

const matterTypes = ["مدنية", "تجارية", "عمالية", "أحوال شخصية", "تنفيذ", "أخرى"];

export function ConsultationForm() {
  const [title, setTitle] = useState("");
  const [matterType, setMatterType] = useState(matterTypes[0]);
  const [facts, setFacts] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConsultationResult | null>(null);

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/consultation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ title, matterType, facts, question })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "تعذر تحليل الواقعة.");
      }

      setResult(payload as ConsultationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحليل الواقعة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-black/10 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-olive">عنوان الاستشارة</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
              placeholder="مثال: نزاع توريد مواد بناء"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-olive">نوع المسألة</span>
            <select
              value={matterType}
              onChange={(event) => setMatterType(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            >
              {matterTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-olive">نص الواقعة</span>
          <textarea
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            className="focus-ring mt-2 min-h-40 w-full rounded-md border border-black/10 px-4 py-3 leading-8"
            placeholder="اكتب الوقائع القانونية بتفصيل كاف..."
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-olive">طلب المستخدم أو السؤال القانوني</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="focus-ring mt-2 min-h-24 w-full rounded-md border border-black/10 px-4 py-3 leading-8"
            placeholder="مثال: هل يحق للشركة خصم قيمة المواد المعيبة؟"
          />
        </label>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || facts.trim().length < 20}
          className="focus-ring mt-5 rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جار تحليل الواقعة..." : "تحليل الواقعة"}
        </button>
      </section>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      {result ? (
        <section className="rounded-md border border-black/10 bg-white p-5">
          <p className="rounded-md bg-sand p-4 text-sm leading-7 text-gray-700">{result.warning}</p>
          <h2 className="mt-5 text-xl font-bold text-olive">نتيجة التحليل</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-4 leading-8 text-gray-700">{result.analysis}</pre>
          <p className="mt-4 font-semibold text-olive">{result.result}</p>
          {result.consultationId ? <p className="mt-2 text-xs text-gray-500">رقم الاستشارة: {result.consultationId}</p> : null}

          <h3 className="mt-6 font-bold text-olive">المواد النظامية المستند إليها</h3>
          {result.citations.length === 0 ? (
            <p className="mt-2 rounded-md border border-black/10 p-4 text-gray-700">
              لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {result.citations.map((citation) => (
                <article key={`${citation.lawName}-${citation.articleNumber}-${citation.articleId}`} className="rounded-md border border-black/10 p-4">
                  <p className="text-sm text-gold">
                    {citation.lawName} · المادة {citation.articleNumber.toLocaleString("ar-SA")}
                  </p>
                  <p className="mt-2 leading-8 text-gray-700">{citation.quote}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
