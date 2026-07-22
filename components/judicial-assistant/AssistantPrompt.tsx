"use client";

// موجّه المعاون — صندوقٌ حيٌّ (كصناديق المحادثة الحيّة): يبثّ مؤشّرات التفكير والبحث حيًّا،
// ثمّ الإجابة كلمةً كلمةً فور وصولها من النموذج. يمرّ بالتأصيل والحجب الصادق نفسه.
import { FormEvent, useEffect, useRef, useState } from "react";
import { JaIcon } from "./icons";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import type { AskCitation } from "@/lib/modules/judicial-assistant/ask-stream";

// اقتراحاتٌ خاصّةٌ بالقضية (داخل صفحتها) — تعرف سياقها.
const CASE_SUGGESTIONS = [
  "ما أبرز نقاط القوّة والضعف في هذه القضية؟",
  "ما الدفوع المحتملة للطرف الآخر؟",
  "لخّص لي موقف الإثبات الحاليّ.",
];
// اقتراحاتٌ عامّة (الصفحة الرئيسية) — مسائل قضائيّة لا ترتبط بقضيّةٍ بعينها.
const GENERAL_SUGGESTIONS = [
  "ما مدّة الاعتراض على حكمٍ تجاريّ وبدايتها؟",
  "ما شروط قبول دعوى المطالبة الماليّة؟",
  "اشرح عبء الإثبات في الدعاوى العمّاليّة.",
];

type Stage = { label: string; state: "active" | "done" };

export function AssistantPrompt({ caseId, compact = false }: { caseId?: string; compact?: boolean }) {
  const SUGGESTIONS = caseId ? CASE_SUGGESTIONS : GENERAL_SUGGESTIONS;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<{ answer: string; blocked: boolean; citations: AskCitation[]; notice: string } | null>(null);
  const [elapsed, setElapsed] = useState(0); // ثوانٍ منذ الإرسال — مؤشّر وقتٍ حيّ (بلا سقف).
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef<number>(0);

  // مؤشّر الوقت: يعدّ حيًّا أثناء العمل ويتوقّف عند الانتهاء.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const fmtTime = (s: number) => (s < 60 ? `${s}ث` : `${Math.floor(s / 60)}د ${s % 60}ث`);
  const doneStages = stages.filter((s) => s.state === "done").length;

  async function submit(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const question = (preset ?? q).trim();
    if (question.length < 3) { setError("اكتب طلبك (٣ أحرف على الأقلّ)."); return; }
    setBusy(true); setError(""); setResult(null); setStages([]); setStreamText("");
    setElapsed(0); startRef.current = Date.now();
    if (preset) setQ(preset);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/judicial-assistant/ask/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, caseId }), signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || "تعذّر التشغيل.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";       // النصّ المتراكم — صمّام أمانٍ إن انقطع التدفّق دون حدث «done».
      let gotDone = false;
      let lastCitations: AskCitation[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (ev.type === "stage") {
            const s = { label: String(ev.label), state: ev.state as Stage["state"] };
            setStages((prev) => {
              const next = prev.map((p) => ({ ...p, state: "done" as const }));
              return [...next, s];
            });
          } else if (ev.type === "delta") {
            acc += String(ev.text);
            setStreamText((prev) => prev + String(ev.text));
          } else if (ev.type === "done") {
            gotDone = true;
            lastCitations = (ev.citations as AskCitation[]) ?? [];
            setStages((prev) => prev.map((p) => ({ ...p, state: "done" as const })));
            setResult({ answer: String(ev.answer), blocked: Boolean(ev.blocked), citations: lastCitations, notice: String(ev.notice) });
            setStreamText("");
          }
        }
      }
      // انقطع التدفّق دون «done» (مهلة/شبكة) لكنّنا جمعنا نصًّا ⇒ لا نُخفيه: نُرقّيه لنتيجةٍ نهائيّة.
      if (!gotDone && acc.trim()) {
        setStages((prev) => prev.map((p) => ({ ...p, state: "done" as const })));
        setResult({ answer: acc, blocked: false, citations: lastCitations, notice: "انقطع البثّ قبل الختام — عُرض ما اكتمل. أعِد المحاولة لإتمامه." });
        setStreamText("");
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const m = err instanceof Error ? err.message : "";
      setError(/load failed|failed to fetch|networkerror/i.test(m) ? "تعذّر إكمال الطلب — تحقّق من الاتصال وأعد المحاولة." : m || "تعذّر التشغيل.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
  }

  const showThinking = busy && (stages.length > 0 || streamText.length > 0);

  return (
    <div className="ja-ask">
      <div className="ja-ask__head">
        <h2 className="ja-panel__title"><JaIcon name="assistant" size={18} /> {caseId ? "موجّه القضية" : "موجّه المعاون"}</h2>
        <p className="ja-panel__hint">
          {caseId
            ? "اسأل أيّ شيءٍ يتعلّق بهذه القضية — يُجاب حيًّا مؤصَّلًا بالنواة وبسياق قضيتك (الأطراف والطلبات والوقائع والمرفقات)."
            : "اسأل أيّ مسألةٍ قضائيّة — يُجاب حيًّا مؤصَّلًا بمواد النواة، أو يمتنع بصدقٍ إن لم يجد سندًا. للأسئلة الخاصّة بقضيّةٍ، افتحها واسأل داخلها."}
        </p>
      </div>
      <form className="ja-ask__form" onSubmit={submit}>
        <textarea
          value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} rows={compact ? 2 : 3}
          placeholder={caseId ? "مثال: ما الدفوع المحتملة للطرف الآخر؟ أو صِغ لي سؤالًا للخصم…" : "مثال: ما مدّة الاعتراض على حكمٍ تجاريّ؟ أو ما شروط قبول الدعوى؟"}
          className="ja-ask__ta"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(); }}
        />
        <div className="ja-ask__actions">
          {busy ? (
            <button type="button" className="btn btn-outline" onClick={stop}>إيقاف</button>
          ) : (
            <button type="submit" className="btn btn-gold" disabled={q.trim().length < 3}>اسأل المعاون</button>
          )}
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

      {/* شريط التفكير الحيّ + النصّ المبثوث */}
      {showThinking ? (
        <div className="ja-live">
          {/* مؤشّر وقتٍ حيّ + مؤشّر خطواتٍ مصغّر (بلا سقف — قد يتّسع النطاق) */}
          <div className="ja-live__meter" dir="rtl">
            <span className="ja-live__timer" aria-live="polite">
              <span className="ja-live__spin" aria-hidden />الزمن: {fmtTime(elapsed)}
            </span>
            {stages.length > 0 ? (
              <span className="ja-live__steps" title="الخطوات المنجزة">الخطوة {Math.max(doneStages, 1)}/{stages.length}</span>
            ) : null}
          </div>
          {stages.length > 0 ? (
            <ul className="ja-live__stages">
              {stages.map((s, i) => (
                <li key={i} className={`ja-live__stage ja-live__stage--${s.state}`}>
                  <span className="ja-live__dot" aria-hidden />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {streamText ? (
            <div className="ja-live__stream">
              <AnswerRenderer content={streamText} />
              <span className="ja-live__caret" aria-hidden />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* الإجابة النهائيّة */}
      {result ? (
        <div className="ja-summary">
          <div className={`ja-summary__banner ${result.blocked ? "ja-summary__banner--blocked" : ""}`}>
            <JaIcon name={result.blocked ? "security" : "quality"} size={16} /><span>{result.notice}</span>
          </div>
          <div className="ja-summary__body">
            <AnswerRenderer
              content={result.answer}
              basis={result.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))}
            />
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
