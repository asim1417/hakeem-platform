"use client";

import { useRef, useState } from "react";
import { LegalBasisPanel, type LegalBasisItem } from "@/components/legal/LegalBasisPanel";
import { AnswerRenderer } from "@/components/AnswerRenderer";

type StepStatus = "running" | "done";
type Step = { id: string; status: StepStatus; label: string; data?: any };

type Turn = {
  question: string;
  steps: Step[];
  answer: string | null;
  mode?: "live" | "offline" | "intent";
  basis: LegalBasisItem[] | null;
  total: number;
  coverage?: { answered: number; total: number; issues?: Array<{ systemName?: string; status: string }> };
  message?: string;
  error?: string;
  streaming: boolean;
  showMethod: boolean;
};

export function AgentSearchPanel({ userName, initialQuery = "" }: { userName?: string; initialQuery?: string }) {
  const [value, setValue] = useState(initialQuery);
  const [detailed, setDetailed] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function patchLastTurn(patch: (t: Turn) => Turn) {
    setTurns((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
  }

  async function ask(q?: string) {
    const question = (q ?? value).trim();
    if (!question || busy) return;
    setBusy(true);
    setValue("");
    setTurns((prev) => [
      ...prev,
      { question, steps: [], answer: null, basis: null, total: 0, streaming: true, showMethod: true }
    ]);

    try {
      const res = await fetch("/api/ai/agent-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, detailed })
      });

      if (!res.ok || !res.body) {
        const msg = res.status === 401 ? "انتهت الجلسة — يلزم تسجيل الدخول." : "تعذّر تنفيذ البحث الوكيلي.";
        patchLastTurn((t) => ({ ...t, streaming: false, error: msg }));
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "step") {
            patchLastTurn((t) => {
              const steps = t.steps.slice();
              const idx = steps.findIndex((s) => s.id === evt.id);
              const step: Step = { id: evt.id, status: evt.status, label: evt.label, data: evt.data };
              if (idx >= 0) steps[idx] = step;
              else steps.push(step);
              return { ...t, steps };
            });
          } else if (evt.type === "result") {
            patchLastTurn((t) => ({
              ...t,
              answer: typeof evt.answer === "string" ? evt.answer : null,
              mode: evt.mode,
              basis: (evt.basis ?? []) as LegalBasisItem[],
              total: evt.total ?? 0,
              coverage: evt.coverage,
              message: evt.message
            }));
          } else if (evt.type === "error") {
            patchLastTurn((t) => ({ ...t, error: evt.message ?? "خطأ غير متوقع." }));
          } else if (evt.type === "done") {
            patchLastTurn((t) => ({ ...t, streaming: false, showMethod: false }));
          }
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      patchLastTurn((t) => ({ ...t, streaming: false }));
    } catch {
      patchLastTurn((t) => ({ ...t, streaming: false, error: "انقطع الاتصال أثناء البحث." }));
    } finally {
      setBusy(false);
    }
  }

  const greeting = userName ? `أهلاً، ${userName}` : "أهلاً بك";

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      {/* منطقة المحادثة */}
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-6">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center pt-[8vh] text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-3xl text-[var(--gold-bright)] shadow-[var(--sh-md)]">
              ✦
            </span>
            <h1 className="t-head mt-5 text-2xl font-bold text-[var(--navy)] md:text-3xl">{greeting}</h1>
            <p className="mt-2 text-[var(--ink-60)]">كيف أساعدك اليوم؟ اسألني في الأنظمة السعودية وسأبحث في النواة القانونية الموثّقة.</p>
          </div>
        ) : (
          turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              {/* سؤال المستخدم */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--navy)] px-4 py-2.5 text-sm leading-7 text-white">
                  {turn.question}
                </div>
              </div>

              {/* رد حكيم */}
              <div className="space-y-3">
                {/* لوحة طريقة البحث الشفّافة */}
                {turn.steps.length > 0 ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4">
                    <button
                      type="button"
                      onClick={() => patchTurn(setTurns, i, (t) => ({ ...t, showMethod: !t.showMethod }))}
                      className="focus-ring flex w-full items-center justify-between gap-2 text-right"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                        <span aria-hidden>🔭</span>
                        {turn.streaming ? "جارٍ تحليل السؤال…" : "طريقة البحث"}
                      </span>
                      <span className="text-xs text-[var(--ink-60)]">{turn.showMethod ? "إخفاء طريقة البحث ▴" : "إظهار طريقة البحث ▾"}</span>
                    </button>

                    {turn.showMethod ? (
                      <ol
                        className="mt-3 space-y-2.5 border-t border-[var(--ink-08)] pt-3"
                        aria-live="polite"
                        aria-busy={turn.streaming}
                        aria-label="خطوات عمل الوكيل"
                      >
                        {turn.steps.map((step) => (
                          <li key={step.id} className="flex items-start gap-3">
                            <span className="mt-0.5 shrink-0">
                              {step.status === "done" ? (
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--emerald-soft)] text-xs text-[var(--emerald)]">✓</span>
                              ) : (
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--ink-80)]">{step.label}</p>
                              {step.data?.sub ? <p className="mt-0.5 text-xs leading-6 text-[var(--ink-60)]">{step.data.sub}</p> : null}
                              {step.id === "retrieved" && Array.isArray(step.data?.sample) && step.data.sample.length ? (
                                <ul className="mt-1.5 space-y-1">
                                  {step.data.sample.slice(0, 6).map((it: any, k: number) => (
                                    <li key={k} className="font-mono-legal text-[11px] text-[var(--ink-60)]">
                                      • {it.systemName} · م{Number(it.articleNumber).toLocaleString("ar-SA")}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : turn.streaming ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--ink-60)]">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                    جارٍ التحليل…
                  </div>
                ) : null}

                {/* النتيجة المستندة */}
                {turn.error ? (
                  <div className="rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-4 text-sm leading-7 text-[var(--ruby)]">
                    {turn.error}
                  </div>
                ) : null}

                {/* الإجابة المُصاغة المستندة */}
                {turn.answer ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-5 shadow-[var(--sh-xs)]">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-sm text-[var(--gold-bright)]">✦</span>
                      <span className="text-sm font-bold text-[var(--navy)]">إجابة حكيم</span>
                      {turn.mode !== "intent" ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={
                            turn.mode === "live"
                              ? { color: "var(--emerald)", background: "var(--emerald-soft)" }
                              : { color: "var(--amber)", background: "var(--amber-soft)" }
                          }
                          title={turn.mode === "live" ? "صياغة ذكية مستندة للمواد" : "صياغة تدريبية مُركّبة من المواد (دون مزوّد ذكاء مفعّل)"}
                        >
                          {turn.mode === "live" ? "صياغة مستندة" : "صياغة تدريبية"}
                        </span>
                      ) : null}
                    </div>
                    {turn.mode === "intent" ? (
                      <p className="whitespace-pre-wrap leading-8 text-[var(--ink-80)]">{turn.answer}</p>
                    ) : (
                      <AnswerRenderer content={turn.answer} />
                    )}
                  </div>
                ) : null}

                {/* المرحلة ٦: مؤشّر التغطية — يُبيّن أن كل نظام مستهدف مُجاب (أو ما تعذّر). */}
                {turn.coverage && turn.coverage.total >= 2 ? (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border px-4 py-2.5 text-xs font-semibold"
                    style={
                      turn.coverage.answered >= turn.coverage.total
                        ? { color: "var(--emerald)", background: "var(--emerald-soft)", borderColor: "rgba(26,92,65,0.30)" }
                        : { color: "var(--amber)", background: "var(--amber-soft)", borderColor: "rgba(184,114,26,0.30)" }
                    }
                  >
                    <span aria-hidden>{turn.coverage.answered >= turn.coverage.total ? "✓" : "◐"}</span>
                    <span>
                      التغطية: {turn.coverage.answered.toLocaleString("ar-SA")} من {turn.coverage.total.toLocaleString("ar-SA")}
                      {turn.coverage.answered >= turn.coverage.total ? " — كل الأنظمة المستهدفة مُجابة" : " — بعض الأنظمة بلا نصّ مطابق"}
                    </span>
                    {Array.isArray(turn.coverage.issues) ? (
                      <span className="flex flex-wrap gap-1.5">
                        {turn.coverage.issues
                          .filter((iss) => iss.systemName)
                          .map((iss, k) => (
                            <span
                              key={k}
                              className="rounded-full bg-white/60 px-2 py-0.5"
                              style={{ color: iss.status === "answered" ? "var(--emerald)" : "var(--ink-60)" }}
                            >
                              {iss.status === "answered" ? "✓" : "—"} {iss.systemName}
                            </span>
                          ))}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {turn.basis !== null && turn.mode !== "intent" ? (
                  turn.basis.length ? (
                    <LegalBasisPanel
                      items={turn.basis}
                      title="الأساس النظامي من النواة"
                      note={`المواد التي استندت إليها الإجابة — كلٌّ منها قائم فعلاً في النواة القانونية (إجمالي ${turn.total.toLocaleString("ar-SA")} نتيجة بحث).`}
                    />
                  ) : turn.answer ? null : (
                    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
                      {turn.message ?? "لا يوجد سند نظامي كافٍ."}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* صندوق الإدخال */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[var(--hakeem-bg)] via-[var(--hakeem-bg)] to-transparent pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
          className="rounded-[var(--r-xl)] border border-[var(--ink-15)] bg-white p-2 shadow-[var(--sh-md)] focus-within:border-[var(--gold)]"
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            rows={1}
            placeholder="اسأل في القانون ما شئت…"
            className="max-h-40 min-h-[44px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setDetailed((v) => !v)}
              aria-pressed={detailed}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                detailed
                  ? "border-[var(--gold)] bg-[var(--gold-ghost)] text-[var(--navy)]"
                  : "border-[var(--ink-15)] text-[var(--ink-60)] hover:text-[var(--navy)]"
              }`}
            >
              <span aria-hidden>🔭</span> بحث تفصيلي {detailed ? "(مُفعّل)" : ""}
            </button>
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "جارٍ…" : "إرسال"}
            </button>
          </div>
        </form>
        <p className="mt-2 px-1 text-center text-[11px] leading-6 text-[var(--ink-40)]">
          حكيم يبحث في النواة القانونية الموثّقة فقط ولا يولّد مواد غير موجودة. مخرجاته مساعدة وتعليمية وليست رأيًا قانونيًا نهائيًا.
        </p>
      </div>
    </div>
  );
}

function patchTurn(setTurns: React.Dispatch<React.SetStateAction<Turn[]>>, index: number, patch: (t: Turn) => Turn) {
  setTurns((prev) => {
    if (index < 0 || index >= prev.length) return prev;
    const next = prev.slice();
    next[index] = patch(next[index]);
    return next;
  });
}
