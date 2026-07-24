"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import { AnswerToolbar } from "@/components/AnswerToolbar";
import { LegalBasisPanel, type LegalBasisItem } from "@/components/legal/LegalBasisPanel";
import { useHakeemAsk } from "@/components/hooks/useHakeemAsk";
import { trackHomeAskEvent } from "@/lib/modules/ask/home-ask-analytics";
import { suggestAskNextActions } from "@/lib/modules/ask/next-actions";
import {
  ASK_FIRST_SUGGESTIONS,
  ASK_TO_CASE_HANDOFF_KEY,
  isAskFirstHomeEnabled,
} from "@/lib/modules/config/ask-first-home";
import { HOME_ASK_HANDOFF_KEY } from "@/lib/modules/config/home-inline-ask";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { signInWithNext } from "@/lib/modules/auth/safe-next";

/**
 * صندوق السؤال في الرئيسية — ينفّذ /api/ai/agent-search داخل الصفحة دون تحويل.
 */
export function HomeInlineAsk() {
  const askFirst = isAskFirstHomeEnabled();
  const {
    value,
    setInput,
    turns,
    busy,
    validationError,
    ask,
    retryLast,
    startNew,
    askClarify,
    saveConversation,
    sessionSaved,
    resultAnchorRef,
    maxChars,
  } = useHakeemAsk();
  const formRef = useRef<HTMLFormElement>(null);
  const last = turns[turns.length - 1];
  const hasResult = turns.length > 0;
  const followUpMode = hasResult && Boolean(last?.answer) && !last?.streaming;

  const statusLabel = useMemo(() => {
    if (!last?.streaming) return null;
    const running = [...last.steps].reverse().find((s) => s.status === "running");
    if (running?.label) {
      const label = running.label;
      if (/فهم|تصنيف|intent/i.test(label)) return "جارٍ فهم السؤال…";
      if (/بحث|استرجاع|retriev/i.test(label)) return "جارٍ البحث في المصادر…";
      if (/تحليل|إعداد|توليد|synthesize/i.test(label)) return "جارٍ إعداد التحليل…";
      return label;
    }
    if (last.steps.some((s) => s.id.includes("retriev") || s.label.includes("بحث"))) {
      return "جارٍ البحث في المصادر…";
    }
    if (last.steps.length) return "جارٍ إعداد التحليل…";
    return "جارٍ فهم السؤال…";
  }, [last]);

  const nextActions = useMemo(() => {
    if (!askFirst || !last?.answer || last.streaming) return [];
    return suggestAskNextActions(last.question, last.answer);
  }, [askFirst, last]);

  function openWorkspace() {
    const q = last?.question || value.trim();
    try {
      sessionStorage.setItem(
        HOME_ASK_HANDOFF_KEY,
        JSON.stringify({ question: q, at: Date.now() })
      );
    } catch {
      /* تجاهل */
    }
    trackHomeAskEvent("home_ask_open_workspace");
    const href = q
      ? `/dashboard/ask?q=${encodeURIComponent(q.slice(0, 500))}`
      : "/dashboard/ask";
    window.location.assign(href);
  }

  function convertToCase() {
    const q = last?.question || value.trim();
    if (!q) return;
    try {
      sessionStorage.setItem(
        ASK_TO_CASE_HANDOFF_KEY,
        JSON.stringify({
          subject: q.slice(0, 120),
          factsNote: q.slice(0, 4000),
          at: Date.now(),
        })
      );
    } catch {
      /* تجاهل */
    }
    trackHomeAskEvent("home_ask_to_case");
    window.location.assign("/dashboard/judicial-assistant");
  }

  function applySuggestion(text: string) {
    setInput(text);
    trackHomeAskEvent("home_ask_suggestion");
    formRef.current?.querySelector("textarea")?.focus();
  }

  return (
    <div className={`home-inline-ask${askFirst ? " home-inline-ask--first" : ""}`}>
      <form
        ref={formRef}
        className="center-search home-inline-ask__composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(undefined, { followUp: followUpMode });
        }}
      >
        {TRADITIONAL_SEARCH_ENABLED && !askFirst ? (
          <p className="home-inline-ask__mode-hint">اسأل حكيم — تحليل قانوني مباشر داخل الصفحة</p>
        ) : null}

        <div className="cs-box home-inline-ask__box">
          <span aria-hidden="true">⌕</span>
          <textarea
            value={value}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) void ask(undefined, { followUp: followUpMode });
              }
            }}
            rows={askFirst ? 2 : 1}
            disabled={busy}
            aria-label={
              followUpMode
                ? "اسأل عن نقطة أخرى في السياق نفسه"
                : "اكتب الواقعة أو السؤال القانوني"
            }
            aria-invalid={Boolean(validationError)}
            aria-describedby="home-ask-hint home-ask-error home-ask-help"
            placeholder={
              followUpMode
                ? "اسأل عن نقطة أخرى في السياق نفسه…"
                : askFirst
                  ? "اكتب الواقعة أو السؤال القانوني بتفاصيله…"
                  : "اطرح واقعتك أو سؤالك القانوني…"
            }
            className="home-inline-ask__input"
          />
          <button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "جارٍ…" : followUpMode ? "إرسال" : "اسأل حكيم"}
          </button>
        </div>

        {askFirst && !hasResult ? (
          <p id="home-ask-help" className="home-inline-ask__help">
            يمكنك طرح سؤال مختصر، أو كتابة وقائع المسألة بالتفصيل.
          </p>
        ) : (
          <span id="home-ask-help" className="sr-only" />
        )}

        <p id="home-ask-hint" className="home-inline-ask__hint">
          Enter للإرسال، وShift + Enter لسطر جديد
          {value.length > maxChars * 0.9
            ? ` · ${value.length.toLocaleString("ar-SA")} / ${maxChars.toLocaleString("ar-SA")}`
            : null}
        </p>
        {validationError ? (
          <p id="home-ask-error" className="home-inline-ask__error" role="alert">
            {validationError}
          </p>
        ) : (
          <span id="home-ask-error" className="sr-only" />
        )}
      </form>

      {askFirst && !hasResult && !busy ? (
        <ul className="home-inline-ask__suggestions" aria-label="اقتراحات للبدء">
          {ASK_FIRST_SUGGESTIONS.map((s) => (
            <li key={s}>
              <button type="button" className="home-inline-ask__chip" onClick={() => applySuggestion(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={resultAnchorRef} className="home-inline-ask__results" aria-live="polite">
        {hasResult ? (
          <div className="home-inline-ask__panel">
            {statusLabel ? (
              <p className="home-inline-ask__status" aria-busy="true">
                <span className="home-inline-ask__spinner" aria-hidden />
                {statusLabel}
              </p>
            ) : null}

            {turns.map((turn, i) => (
              <article key={turn.id} className="home-inline-ask__turn">
                <h3 className="home-inline-ask__q-label">سؤالك</h3>
                <p className="home-inline-ask__q">{turn.question}</p>

                {turn.steps.length > 0 && (turn.streaming || turn.showMethod) ? (
                  <ol className="home-inline-ask__steps" aria-label="مراحل التحليل">
                    {turn.steps.map((step) => (
                      <li key={step.id} data-status={step.status}>
                        <span className="home-inline-ask__step-mark" aria-hidden>
                          {step.status === "done" ? "✓" : "…"}
                        </span>
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {turn.mode === "blocked" ? (
                  <div className="home-inline-ask__blocked">
                    <p className="font-bold">انتهى رصيد التجربة</p>
                    <p className="mt-2 text-sm leading-7">
                      {turn.message ??
                        "للمتابعة في التحليل المتقدّم راجع حسابك والرصيد."}
                    </p>
                    <Link href="/dashboard/billing" className="home-inline-ask__btn-secondary mt-3 inline-flex">
                      الحساب والرصيد
                    </Link>
                  </div>
                ) : null}

                {turn.error ? (
                  <div className="home-inline-ask__err-box" role="alert">
                    <p>{turn.error}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/جلستك|تسجيل الدخول|انتهت/.test(turn.error) ? (
                        <Link
                          href={signInWithNext("/dashboard")}
                          className="home-inline-ask__btn-primary"
                        >
                          تسجيل الدخول
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="home-inline-ask__btn-primary"
                          disabled={busy}
                          onClick={() => retryLast()}
                        >
                          إعادة المحاولة
                        </button>
                      )}
                      <button
                        type="button"
                        className="home-inline-ask__btn-secondary"
                        onClick={() => setInput(turn.question)}
                      >
                        تعديل السؤال
                      </button>
                    </div>
                  </div>
                ) : null}

                {turn.clarify ? (
                  <div className="home-inline-ask__clarify">
                    <p className="font-semibold text-[var(--navy)]">{turn.clarify.message}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {turn.clarify.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={busy}
                          className="home-inline-ask__clarify-opt"
                          onClick={() => askClarify(opt.query, opt.exhaustive)}
                        >
                          {opt.label}
                          {opt.hint ? (
                            <span className="block text-[11px] font-normal opacity-70">
                              {opt.hint}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turn.answer && !turn.groups ? (
                  <div className="home-inline-ask__answer">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ink-08)] pb-2">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
                        <Sparkles size={16} aria-hidden />
                        إجابة حكيم
                      </span>
                      {turn.mode !== "intent" ? (
                        <AnswerToolbar
                          answer={turn.answer}
                          basis={(turn.basis ?? []) as LegalBasisItem[]}
                          question={turn.question}
                          printTargetId={`home-ask-a-${i}`}
                        />
                      ) : null}
                    </div>
                    {turn.mode === "intent" ? (
                      <p className="whitespace-pre-wrap leading-8 text-[var(--ink-80)]">
                        {turn.answer}
                      </p>
                    ) : (
                      <AnswerRenderer
                        content={turn.answer}
                        basis={(turn.basis ?? []) as LegalBasisItem[]}
                        anchorPrefix={`home-ask-src-${i}-`}
                        id={`home-ask-a-${i}`}
                      />
                    )}
                  </div>
                ) : null}

                {turn.groups?.length ? (
                  <div className="space-y-3">
                    {turn.answer ? (
                      <div className="home-inline-ask__answer">
                        <AnswerRenderer content={turn.answer} />
                      </div>
                    ) : null}
                    {turn.groups.slice(0, turn.visibleGroups ?? 3).map((g, gi) => (
                      <div key={`${g.systemName}-${gi}`} className="home-inline-ask__answer">
                        <p className="mb-2 text-sm font-bold text-[var(--navy)]">{g.systemName}</p>
                        <AnswerRenderer content={g.table} />
                      </div>
                    ))}
                  </div>
                ) : null}

                {turn.basis && turn.basis.length && turn.mode !== "intent" && !turn.groups ? (
                  <LegalBasisPanel
                    items={turn.basis as LegalBasisItem[]}
                    anchorPrefix={`home-ask-src-${i}-`}
                    title="الأساس النظامي من النواة"
                    note={`المواد المستند إليها (إجمالي ${turn.total.toLocaleString("ar-SA")} نتيجة بحث).`}
                  />
                ) : null}

                {turn.disclosure ? (
                  <div className="home-inline-ask__note">
                    <AnswerRenderer content={turn.disclosure} />
                  </div>
                ) : null}

                {!turn.streaming && !turn.error && (turn.answer || turn.clarify || turn.mode === "blocked") ? (
                  <p className="sr-only">اكتملت الإجابة.</p>
                ) : null}
              </article>
            ))}

            {!busy && last && !last.streaming ? (
              <>
                {nextActions.length > 0 ? (
                  <div className="home-inline-ask__next" aria-label="خطوات تالية مقترحة">
                    <p className="home-inline-ask__next-label">خطوات مقترحة حسب سؤالك</p>
                    <div className="home-inline-ask__next-list">
                      {nextActions.map((a) => {
                        if (a.kind === "case") {
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className="home-inline-ask__btn-secondary"
                              onClick={convertToCase}
                            >
                              {a.label}
                            </button>
                          );
                        }
                        if (a.kind === "workspace") {
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className="home-inline-ask__btn-secondary"
                              onClick={openWorkspace}
                            >
                              {a.label}
                            </button>
                          );
                        }
                        return (
                          <Link
                            key={a.id}
                            href={a.href || "/dashboard"}
                            className="home-inline-ask__btn-secondary"
                          >
                            {a.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="home-inline-ask__actions">
                  {last.answer ? (
                    <button
                      type="button"
                      className="home-inline-ask__btn-primary"
                      onClick={() => formRef.current?.querySelector("textarea")?.focus()}
                    >
                      إرسال متابعة
                    </button>
                  ) : null}
                  <button type="button" className="home-inline-ask__btn-secondary" onClick={startNew}>
                    محادثة جديدة
                  </button>
                  {last.answer ? (
                    <button
                      type="button"
                      className="home-inline-ask__btn-secondary"
                      onClick={() => saveConversation()}
                    >
                      {sessionSaved ? "تم الحفظ في هذه الجلسة" : "حفظ المحادثة"}
                    </button>
                  ) : null}
                  {askFirst && last.answer ? (
                    <button
                      type="button"
                      className="home-inline-ask__btn-secondary"
                      onClick={convertToCase}
                    >
                      تحويل إلى قضية
                    </button>
                  ) : null}
                  {!askFirst ? (
                    <button type="button" className="home-inline-ask__btn-secondary" onClick={openWorkspace}>
                      فتح في مساحة العمل
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
