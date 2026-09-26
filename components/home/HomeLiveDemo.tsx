"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveDemoPayload } from "@/lib/modules/home/live-demo-content";

/** مؤقت واحد يقود المراحل: كل نبضة 50ms (نحو 15 ثانية للدورة ثم تكرار). */
export const LIVE_DEMO_TICK_MS = 50;

export type LiveDemoTimeline = {
  typedEnd: number;
  searchStart: number;
  linesStart: number;
  textAt: number;
  chipsAt: number;
  end: number;
};

/** حدود المراحل بالنبضات — كما في لوحة «العرض الحي» المعتمدة. */
export function liveDemoTimeline(questionLength: number): LiveDemoTimeline {
  const typedEnd = questionLength;
  const searchStart = typedEnd + 12;
  const linesStart = searchStart + 30;
  const textAt = linesStart + 45;
  const chipsAt = textAt + 20;
  // توقف نحو خمس ثوانٍ (≈110 نبضة) بعد اكتمال الجواب ثم إعادة
  const end = chipsAt + 110;
  return { typedEnd, searchStart, linesStart, textAt, chipsAt, end };
}

export type LiveDemoFrame = {
  typed: string;
  showCaret: boolean;
  showSearch: boolean;
  stepsDone: boolean[];
  linesShown: number;
  showText: boolean;
  showChips: boolean;
  progress: number;
};

export function liveDemoFrame(t: number, payload: Pick<LiveDemoPayload, "question" | "steps" | "lines">): LiveDemoFrame {
  const tl = liveDemoTimeline(payload.question.length);
  return {
    typed: payload.question.slice(0, Math.min(t, tl.typedEnd)),
    showCaret: t < tl.searchStart,
    showSearch: t >= tl.searchStart,
    stepsDone: payload.steps.map((_, i) => t >= tl.searchStart + 8 * (i + 1)),
    linesShown: payload.lines.filter((_, i) => t >= tl.linesStart + i * 10).length,
    showText: t >= tl.textAt,
    showChips: t >= tl.chipsAt,
    progress: Math.min(1, t / tl.end),
  };
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A5C41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * «العرض الحي» — سؤال يُكتب، ثم خطوات البحث، ثم أسطر الجواب، ثم نص المادة بلفظه من المدونة وشارات المصادر.
 * بلا مكتبات حركة ولا فيديو. يتوقف خارج الشاشة وعند إخفاء الصفحة، ويُعرض ثابتًا مع prefers-reduced-motion.
 * النص المتحرك aria-hidden، ومعه نسخة نصية كاملة لقارئ الشاشة.
 */
export function HomeLiveDemo({ payload }: { payload: LiveDemoPayload }) {
  const tl = liveDemoTimeline(payload.question.length);
  const rootRef = useRef<HTMLElement>(null);
  const [t, setT] = useState(tl.end);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* متصفح قديم */
    }
    setReduced(reduce);
    setT(reduce ? tl.end : 0);
    setPaused(reduce);
    try {
      const mq = window.matchMedia("(max-width: 639px)");
      setCompact(mq.matches);
      const onMq = () => setCompact(mq.matches);
      mq.addEventListener?.("change", onMq);
      return () => mq.removeEventListener?.("change", onMq);
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند التركيب فقط
  }, []);

  // يتوقف حين يخرج من الشاشة أو تُخفى الصفحة
  useEffect(() => {
    const el = rootRef.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { threshold: 0.15 });
      io.observe(el);
    }
    const onVis = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const running = !paused && !reduced && visible && !pageHidden;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setT((x) => (x + 1 > tl.end ? 0 : x + 1)), LIVE_DEMO_TICK_MS);
    return () => window.clearInterval(id);
  }, [running, tl.end]);

  const f = liveDemoFrame(t, payload);
  const article = payload.article;

  return (
    <section ref={rootRef} className="hk-demo" data-compact={compact ? "true" : undefined} aria-label="عرض حي لحكيم" dir="rtl">
      {/* نسخة نصية كاملة لقارئ الشاشة — العرض المتحرك نفسه مخفي عنه */}
      <div className="sr-only">
        <p>سؤال: {payload.question}</p>
        <p>خطوات البحث: {payload.steps.join("، ")}.</p>
        <ol>
          {payload.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <p>
          {article.lawName} — {article.title}: «{article.content}»
        </p>
        <p>المصادر: {payload.chips.map((c) => c.label).join("، ")}.</p>
      </div>

      <div className="hk-demo__stage" aria-hidden>
        <div className="hk-demo__head">
          <div className="hk-demo__brand">
            <span className="hk-demo__name">{compact ? "شاهد حكيم يعمل" : "اسأل حكيم"}</span>
            <span className="hk-demo__live">عرض حي</span>
          </div>
          <div className="hk-demo__progress">
            <span style={{ width: `${Math.round(f.progress * 100)}%` }} />
          </div>
        </div>

        <div className="hk-demo__question">
          {f.typed}
          {f.showCaret ? <span className="hk-demo__caret" /> : null}
        </div>

        {f.showSearch ? (
          <div className="hk-demo__steps">
            {payload.steps.map((s, i) => (
              <div key={s} className="hk-demo__step">
                {f.stepsDone[i] ? <CheckIcon /> : <span className="hk-spinner hk-demo__spin" />}
                <span>{s}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="hk-demo__lines">
          {payload.lines.slice(0, f.linesShown).map((text, i) => (
            <div key={text} className="hk-demo__line">
              <span className="hk-demo__num">{i + 1}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {f.showText ? (
          <figure className="hk-demo__text">
            <figcaption>
              {article.lawName} — {article.title}
            </figcaption>
            <blockquote>«{article.content}»</blockquote>
          </figure>
        ) : null}

        {f.showChips ? (
          <div className="hk-demo__chips">
            {payload.chips.map((c) => (
              <span key={c.label} className="hk-demo__chip">
                {compact ? c.short : c.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hk-demo__foot">
        <span>{compact ? payload.disclaimerShort : payload.disclaimer}</span>
        <div className="hk-demo__controls">
          <button
            type="button"
            className="hk-icon-btn"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused || reduced ? "تشغيل العرض" : "إيقاف العرض مؤقتًا"}
            disabled={reduced}
          >
            {paused || reduced ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l10-6.5-10-6.5z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6.5" y="5" width="4" height="14" rx="1" />
                <rect x="13.5" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="hk-icon-btn"
            onClick={() => {
              setT(reduced ? tl.end : 0);
              if (!reduced) setPaused(false);
            }}
            aria-label="إعادة العرض"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12a8 8 0 1 0 2.3-5.6" />
              <path d="M4 4v4.5h4.5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
