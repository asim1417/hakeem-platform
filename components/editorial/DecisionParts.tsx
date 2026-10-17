"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, CheckCheck, LoaderCircle, RefreshCw, Undo2, Users, X } from "lucide-react";
import { fmt, remainingMs, type ResultTone } from "./logic";
import { domIds, type DeferredDecisions, type ItemState } from "./useDeferredDecisions";
import { btnClass, Message, WithCodes } from "./ui";

type Ids = ReturnType<typeof domIds>;

/** صف القرار الثابت (ح٣): ثلاث خانات متساوية بالترتيب نفسه؛ الوسطى فارغة حين لا تصحيح. */
export function DecisionRow({
  ids,
  describedBy,
  approveLabel = "اعتماد",
  onApprove,
  onCorrect,
  correctOpen = false,
  onReject,
  rejectOpen = false,
  disabled = false,
  rejectSlot,
}: {
  ids: Ids;
  describedBy: string;
  approveLabel?: string;
  onApprove: () => void;
  onCorrect?: () => void;
  correctOpen?: boolean;
  onReject?: () => void;
  rejectOpen?: boolean;
  disabled?: boolean;
  /** بديل خانة الرفض حين لا يتاح الرفض. */
  rejectSlot?: ReactNode;
}) {
  return (
    <div className="dk-decision dk-bleed" role="group" aria-label="القرار">
      <button id={ids.approve} type="button" className={btnClass("approve", { lg: true })} aria-describedby={describedBy} disabled={disabled} onClick={onApprove}>
        <span>{approveLabel}</span>
      </button>
      {onCorrect ? (
        <button
          id={ids.correct}
          type="button"
          className={btnClass("correct", { lg: true })}
          aria-describedby={describedBy}
          aria-expanded={correctOpen}
          aria-controls={correctOpen ? ids.panel : undefined}
          disabled={disabled}
          onClick={onCorrect}
        >
          <span>تصحيح</span>
        </button>
      ) : (
        <span className="dk-decision__blank" aria-hidden />
      )}
      {onReject ? (
        <button
          id={ids.reject}
          type="button"
          className={btnClass("reject", { lg: true })}
          aria-describedby={describedBy}
          aria-expanded={rejectOpen}
          aria-controls={rejectOpen ? ids.panel : undefined}
          disabled={disabled}
          onClick={onReject}
        >
          <span>رفض</span>
        </button>
      ) : (
        rejectSlot ?? <span className="dk-decision__blank" aria-hidden />
      )}
    </div>
  );
}

/** سطر المهلة «سيُعتمد… · تراجع» في موضع صف القرار، ثم «جارٍ الحفظ» (٦-٦). */
export function UndoLine<S>({ ids, state, now, onUndo }: { ids: Ids; state: ItemState<S>; now: number; onUndo: () => void }) {
  const pending = state.pending;
  if (!pending) return null;
  const Icon = pending.verb === "reject" || pending.verb === "rejectShown" ? X : Check;
  if (state.phase === "sending") {
    return (
      <div id={ids.sending} tabIndex={-1} className="dk-undo dk-undo--busy dk-bleed" data-surface="dark" role="group" aria-label={`جارٍ حفظ القرار على ${pending.label}`}>
        <p className="dk-undo__line">
          <LoaderCircle size={20} aria-hidden className="dk-spin" />
          <span>
            جارٍ حفظ القرار: <WithCodes text={pending.line} />…
          </span>
        </p>
      </div>
    );
  }
  const seconds = state.countdown ? Math.ceil(remainingMs(state.countdown, now) / 1000) : 0;
  const paused = state.countdown?.deadline === null;
  return (
    <>
      {pending.summary.length ? (
        <div className="dk-panel" aria-label="ملخص ما كتبته (للقراءة فقط أثناء المهلة)">
          {pending.summary.map((line) => (
            <p key={line} className="dk-body-text">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <div className="dk-undo dk-bleed" data-surface="dark" data-paused={paused ? "" : undefined} role="group" aria-label={`قرار معلّق على ${pending.label}`}>
        <div>
          <p className="dk-undo__line">
            <Icon size={20} aria-hidden />
            <span>
              <WithCodes text={pending.line} />
            </span>
          </p>
          <p className="dk-undo__count" aria-hidden>
            {paused ? "العدّاد متوقف حتى تعود إلى الصفحة" : `يُرسل خلال ${fmt(Math.max(seconds, 0))} ث`}
          </p>
        </div>
        <button id={ids.undo} type="button" className={btnClass("undo")} onClick={onUndo}>
          <Undo2 size={18} aria-hidden className="rtl:-scale-x-100" />
          <span>تراجع</span>
        </button>
        <span className="dk-undo__bar" aria-hidden />
      </div>
    </>
  );
}

export function ResultLine({ id, text, tone }: { id: string; text: string; tone: ResultTone }) {
  const Icon = tone === "reject" ? X : tone === "wait" ? CheckCheck : Check;
  return (
    <div id={id} tabIndex={-1} className={`dk-result${tone === "reject" ? " dk-result--reject" : tone === "wait" ? " dk-result--wait" : ""}`}>
      <Icon size={20} aria-hidden />
      <span>
        <WithCodes text={text} />
      </span>
    </div>
  );
}

/** رسالة البطاقة تحت الصف أو اللوحة (٦-٧): الخطأ role=alert مع إعادة المحاولة، و409 بتحديث الطابور. */
export function CardError({ ids, error, onRetry, onRefresh }: { ids: Ids; error: { message: string; stale: boolean }; onRetry: () => void; onRefresh: () => void }) {
  if (error.stale) {
    return (
      <div className="mt-3">
        <Message
          id={ids.msg}
          tone="info"
          role="alert"
          title="لم يُسجَّل قرارك."
          actions={
            <button type="button" className={btnClass("text")} onClick={onRefresh}>
              <RefreshCw size={16} aria-hidden />
              <span>تحديث الطابور</span>
            </button>
          }
        >
          {error.message.includes("قُرّر") || error.message.includes("روجع") ? "قرّر معتمِد آخر هذا العنصر قبل قليل؛ لم يُسجَّل قرارك." : error.message}
        </Message>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <Message
        id={ids.msg}
        tone="error"
        role="alert"
        title="تعذّر حفظ القرار."
        actions={
          <button type="button" className={btnClass("text")} onClick={onRetry}>
            إعادة المحاولة
          </button>
        }
      >
        {error.message}
      </Message>
    </div>
  );
}

/** شارة «موافقة ١ من ٢» بمقياس مقطعي زخرفي (٦-٨). */
export function ApprovalsBadge({ approvals, required }: { approvals: number; required: number }) {
  if (required <= 1) return null;
  const segments = Array.from({ length: required }, (_, i) => i < approvals);
  return (
    <span className="dk-badge dk-badge--info">
      <Users size={16} aria-hidden />
      <span>
        موافقة {fmt(approvals)} من {fmt(required)}
      </span>
      <span className="dk-meter" aria-hidden>
        {segments.map((on, i) => (
          <i key={i} data-on={on ? "" : undefined} />
        ))}
      </span>
    </span>
  );
}

export function WaitingLine({ children }: { children: ReactNode }) {
  return (
    <p className="dk-statusline dk-bleed">
      <CheckCheck size={20} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** شريط الخطأ المثبت للفشل المؤجَّل خارج الشاشة (ق٢٤-١): «اذهب إليه» و«إعادة المحاولة». */
export function ErrorDock<S>({
  prefix,
  decisions,
  labelOf,
}: {
  prefix: string;
  decisions: DeferredDecisions<S>;
  labelOf: (id: string) => string;
}) {
  if (!decisions.dock.length) return null;
  return (
    <>
      {decisions.dock.map((id) => {
        const state = decisions.states[id];
        if (!state || state.phase !== "error") return null;
        const ids = domIds(prefix, id);
        return (
          <Message
            key={id}
            tone="error"
            role="alert"
            className="dk-errbar"
            title={<WithCodes text={`تعذّر حفظ قرار ${labelOf(id)}؛ لم يُسجَّل.`} />}
            actions={
              <>
                <button
                  type="button"
                  className={btnClass("text")}
                  onClick={() => {
                    // تمرير فوري (لا حركة؛ globals.css يجعل التمرير ناعمًا) ثم تركيز صف القرار في مكانه.
                    const target = document.getElementById(ids.approve) ?? document.getElementById(ids.msg) ?? document.getElementById(ids.card);
                    target?.scrollIntoView({ block: "center", behavior: "instant" });
                    target?.focus({ preventScroll: true });
                    decisions.dismissDock(id);
                  }}
                >
                  اذهب إليه
                </button>
                {!state.error?.stale ? (
                  <button type="button" className={btnClass("text")} onClick={() => void decisions.retry(id)}>
                    إعادة المحاولة
                  </button>
                ) : null}
                <button type="button" className={btnClass("text")} onClick={() => decisions.dismissDock(id)}>
                  إغلاق
                </button>
              </>
            }
          >
            {state.error?.message}
          </Message>
        );
      })}
    </>
  );
}

/**
 * حاوية الشرائط السفلية المثبتة (٥-٣): position: fixed لأن overflow-x على html يكسر sticky.
 * ترصد ارتفاعها فتضبط scroll-padding-bottom للصفحة (لا يحجب الشريط عنصرًا مركّزًا، 2.4.11)
 * وفاصلًا بالارتفاع نفسه قبلها (يصل المستخدم إلى آخر بطاقة فوق الشريط)، ثم تزيلهما عند الاختفاء.
 */
export function Dock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty("--dk-dock-h", `${h}px`);
      root.style.scrollPaddingBottom = h ? `${h + 16}px` : "";
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--dk-dock-h");
      root.style.scrollPaddingBottom = "";
    };
  }, []);
  return (
    <>
      <div className="dk-dock-spacer" aria-hidden />
      <div ref={ref} className="dk-dock">
        {children}
      </div>
    </>
  );
}

export function LiveRegion({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="dk-sr">
      {text}
    </p>
  );
}
