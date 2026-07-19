"use client";

// موجّه المعاون — صندوق أوامر حرّ يستفيد من ذكاء النموذج للأمور التي لا خدمةَ مخصّصة لها.
// يُرسل الطلب (وسياق القضية إن وُجد) للمسار المؤصَّل ويعرض الإجابة باستشهاداتٍ أو حجبٍ صادق.
import { FormEvent, useState } from "react";
import { JaIcon } from "./icons";
import type { AskResult } from "@/lib/modules/judicial-assistant/ask";

const SUGGESTIONS = [
  "ما أبرز نقاط القوّة والضعف في هذه القضية؟",
  "ما الدفوع المحتملة للطرف الآخر؟",
  "لخّص لي موقف الإثبات الحاليّ.",
];

export function AssistantPrompt({ caseId, compact = false }: { caseId?: string; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);

  async function submit(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const question = (preset ?? q).trim();
    if (question.length < 3) { setError("اكتب طلبك (٣ أحرف على الأقلّ)."); return; }
    setBusy(true); setError(""); setResult(null);
    if (preset) setQ(preset);
    try {
      const res = await fetch("/api/judicial-assistant/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "تعذّر التشغيل.");
      setResult(data as AskResult);
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setError(/load failed|failed to fetch|networkerror|aborted/i.test(m) ? "تعذّر إكمال الطلب — قد تكون العمليّة طويلة أو الاتصال ضعيفًا. أعد المحاولة." : m || "تعذّر التشغيل.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ja-ask">
      <div className="ja-ask__head">
        <h2 className="ja-panel__title"><JaIcon name="assistant" size={18} /> موجّه المعاون</h2>
        <p className="ja-panel__hint">اطلب أيّ شيءٍ لا تغطّيه الخدمات المخصّصة — يُجاب مؤصَّلًا بالنواة{caseId ? " وبسياق قضيتك" : ""}.</p>
      </div>
      <form className="ja-ask__form" onSubmit={submit}>
        <textarea
          value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} rows={compact ? 2 : 3}
          placeholder="مثال: ما الدفوع المحتملة؟ أو صِغ لي سؤالًا للطرف الآخر…"
          className="ja-ask__ta"
        />
        <div className="ja-ask__actions">
          <button type="submit" className="btn btn-gold" disabled={busy || q.trim().length < 3}>
            {busy ? "جارٍ…" : "اسأل المعاون"}
          </button>
          {!result && !busy ? (
            <div className="ja-ask__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ja-ask__chip" onClick={() => void submit(undefined, s)}>{s}</button>
              ))}
            </div>
          ) : null}
        </div>
      </form>

      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}

      {result ? (
        <div className="ja-summary">
          <div className={`ja-summary__banner ${result.blocked ? "ja-summary__banner--blocked" : ""}`}>
            <JaIcon name={result.blocked ? "security" : "quality"} size={16} /><span>{result.notice}</span>
          </div>
          <div className="ja-summary__body">
            {result.answer.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
          </div>
          {result.citations.length > 0 ? (
            <div className="ja-sources">
              <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({result.citations.length})</h4>
              <ul>{result.citations.map((c, i) => (
                <li key={c.articleId + i}><span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span><span className="ja-src__quote">{c.quote}</span></li>
              ))}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
