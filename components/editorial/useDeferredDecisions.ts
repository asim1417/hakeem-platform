"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isStaleDecision, postEditorial } from "./api";
import {
  pauseCountdown,
  remainingMs,
  resultLine,
  resumeCountdown,
  startCountdown,
  UNDO_WINDOW_MS,
  type Countdown,
  type DecisionOutcome,
  type DecisionVerb,
  type Gender,
  type ResultTone,
} from "./logic";

/**
 * دورة حياة القرار الفردي المؤجَّل (ح٢، م٢–م٦):
 * idle → pending (6 ث، تتوقف حين تُخفى الصفحة) → sending → done | error.
 * - «تراجع» أثناء المهلة يلغي بلا طلب ويعيد ما كتبه المستخدم (snapshot).
 * - إغلاق الصفحة أو تحديثها أو الرجوع بالمتصفح (تفكيك المكوّن) يلغي بلا طلب.
 * - التنقل داخل التطبيق (رابط أو نموذج مرشحات) أثناء المهلة يرسل المعلّق فورًا ثم ينتقل بعد نجاحه؛ وإن فشل يبقى.
 * - التركيز لا يُنقل إلا إن كان داخل البطاقة نفسها لحظة الإرسال (م٣).
 */

export type Phase = "idle" | "pending" | "sending" | "done" | "error";

export interface DecisionRequest {
  url: string;
  body: Record<string, unknown>;
}

export interface PendingDecision<S> {
  verb: DecisionVerb;
  /** سطر المهلة الأول. */
  line: string;
  /** اسم العنصر في النتيجة والإعلان: «OP-… — النظام». */
  label: string;
  request: DecisionRequest;
  /** ما كتبه المستخدم في اللوحة، يُعاد عند «تراجع» أو فشل الإرسال (ق٢٨). */
  snapshot: S | null;
  /** ملخص للقراءة فقط أثناء المهلة (السبب، الحقول المصححة). */
  summary: string[];
  /** القرار المرسَل لتسمية النتيجة. */
  decision: string;
  /** جنس اسم العنصر في سطر النتيجة (الافتراضي مؤنث). */
  gender?: Gender;
}

export interface ItemState<S> {
  phase: Phase;
  pending?: PendingDecision<S>;
  countdown?: Countdown;
  result?: { text: string; tone: ResultTone; outcome: DecisionOutcome };
  error?: { message: string; stale: boolean };
}

export function safeKey(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** معرّفات DOM لعنصر في الطابور. */
export function domIds(prefix: string, id: string) {
  const base = `dk-${prefix}-${safeKey(id)}`;
  return {
    card: `${base}-card`,
    title: `${base}-title`,
    ref: `${base}-ref`,
    approve: `${base}-approve`,
    reject: `${base}-reject`,
    correct: `${base}-correct`,
    undo: `${base}-undo`,
    sending: `${base}-sending`,
    msg: `${base}-msg`,
    panel: `${base}-panel`,
    firstField: `${base}-field0`,
  };
}

interface Options<S> {
  prefix: string;
  /** العنصر التالي للتركيز بعد نجاح قرار كان التركيز داخله (عنوان البطاقة التالية أو زر العناصر التالية). */
  focusAfterSuccess: (id: string, decidedNow: ReadonlySet<string>) => string | null;
  onSuccess?: (id: string, outcome: DecisionOutcome, pending: PendingDecision<S>) => void;
  onError?: (id: string, pending: PendingDecision<S>) => void;
  announce: (text: string) => void;
  windowMs?: number;
}

function isInside(el: Element | null, container: Element | null): boolean {
  return Boolean(el && container && container.contains(el));
}

function intersects(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

function fullyVisible(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
}

export function useDeferredDecisions<S>(options: Options<S>) {
  const { prefix, announce } = options;
  const windowMs = options.windowMs ?? UNDO_WINDOW_MS;
  const router = useRouter();
  const [states, setStates] = useState<Record<string, ItemState<S>>>({});
  const statesRef = useRef(states);
  statesRef.current = states;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const optsRef = useRef(options);
  optsRef.current = options;
  const [now, setNow] = useState(() => Date.now());
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number; preventScroll: boolean } | null>(null);
  const [dock, setDock] = useState<string[]>([]);
  const [checkDock, setCheckDock] = useState<string | null>(null);
  const flushing = useRef(false);

  const patch = useCallback((id: string, next: ItemState<S> | ((prev: ItemState<S> | undefined) => ItemState<S>)) => {
    setStates((prev) => {
      const value = typeof next === "function" ? next(prev[id]) : next;
      const out = { ...prev, [id]: value };
      statesRef.current = out;
      return out;
    });
  }, []);

  /** preventScroll: نقل التركيز دون تحريك الصفحة حين تكون البطاقة خارج الشاشة (م٣). */
  const focusLater = useCallback((elementId: string | null, preventScroll = false) => {
    if (elementId) setFocusRequest({ id: elementId, nonce: Math.random(), preventScroll });
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    const el = document.getElementById(focusRequest.id);
    if (!el) return;
    // لا تمرير متحرك برمجيًّا (٩): التركيز بلا تمرير، ثم تقريب فوري عند الحاجة.
    el.focus({ preventScroll: true });
    if (!focusRequest.preventScroll) el.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [focusRequest]);

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const send = useCallback(
    async (id: string): Promise<boolean> => {
      const current = statesRef.current[id];
      const pending = current?.pending;
      if (!pending || current.phase === "sending" || current.phase === "done") return current?.phase === "done";
      clearTimer(id);
      const ids = domIds(prefix, id);
      const card = document.getElementById(ids.card);
      const focusWasInside = isInside(document.activeElement, card);
      patch(id, { ...current, phase: "sending", error: undefined });
      setDock((d) => d.filter((x) => x !== id));
      // زر «تراجع» يُزال من الشجرة؛ إن كان التركيز فيه يبقى داخل البطاقة على سطر الحفظ، بلا تحريك للصفحة.
      if (focusWasInside) focusLater(ids.sending, true);
      const res = await postEditorial<Partial<DecisionOutcome> & { decision?: string; reviewStatus?: string }>(pending.request.url, pending.request.body);
      if (res.ok && res.data) {
        const outcome: DecisionOutcome = {
          status: (res.data.status as DecisionOutcome["status"]) ?? "published",
          approvals: Number(res.data.approvals ?? 1),
          requiredApprovals: Number(res.data.requiredApprovals ?? 1),
          decision: pending.decision,
        };
        const line = resultLine(pending.label, outcome, pending.gender);
        patch(id, { phase: "done", pending, result: { ...line, outcome } });
        announce(line.text);
        const decidedNow = new Set(
          Object.entries(statesRef.current)
            .filter(([, s]) => s.phase === "done")
            .map(([k]) => k),
        );
        decidedNow.add(id);
        // م٣: لا يُنقل التركيز إلا إن بقي داخل البطاقة نفسها؛ وإلا لا يتغير التركيز ولا التمرير.
        if (focusWasInside && isInside(document.activeElement, document.getElementById(ids.card))) {
          focusLater(optsRef.current.focusAfterSuccess(id, decidedNow), !intersects(document.getElementById(ids.card)));
        }
        optsRef.current.onSuccess?.(id, outcome, pending);
        return true;
      }
      const stale = isStaleDecision(res);
      patch(id, { phase: "error", pending, error: { message: res.message ?? "تعذّر حفظ القرار، ولم يُسجَّل شيء.", stale } });
      optsRef.current.onError?.(id, pending);
      if (focusWasInside && isInside(document.activeElement, document.getElementById(ids.card))) {
        // البطاقة ظاهرة: التركيز على «اعتماد» والرسالة تحته. خارج الشاشة: يبقى التركيز في البطاقة بلا تمرير، ويظهر الشريط المثبت.
        if (intersects(document.getElementById(ids.card))) focusLater(stale ? ids.msg : ids.approve);
        else focusLater(ids.card, true);
      }
      setCheckDock(id);
      return false;
    },
    [announce, clearTimer, focusLater, patch, prefix],
  );

  // بعد الفشل: إن لم تكن رسالة البطاقة ظاهرة كلها في الشاشة يظهر شريط الخطأ المثبت (ق٢٤-١).
  useEffect(() => {
    if (!checkDock) return;
    const id = checkDock;
    const raf = requestAnimationFrame(() => {
      const ids = domIds(prefix, id);
      const msg = document.getElementById(ids.msg);
      if (!fullyVisible(msg)) {
        // المستخدم ما زال في البطاقة: تُقرَّب رسالتها إلى الشاشة. وإلا شريط مثبت لا يحرّك الصفحة.
        const card = document.getElementById(ids.card);
        if (msg && intersects(card) && isInside(document.activeElement, card)) msg.scrollIntoView({ block: "nearest", behavior: "instant" });
        else setDock((d) => (d.includes(id) ? d : [...d, id]));
      }
      setCheckDock(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [checkDock, prefix]);

  const arm = useCallback(
    (id: string, countdown: Countdown) => {
      clearTimer(id);
      if (countdown.deadline === null) return;
      timers.current.set(
        id,
        setTimeout(() => {
          void send(id);
        }, remainingMs(countdown, Date.now())),
      );
    },
    [clearTimer, send],
  );

  const start = useCallback(
    (id: string, pending: PendingDecision<S>) => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const base = startCountdown(Date.now(), windowMs);
      const countdown = hidden ? pauseCountdown(base, Date.now()) : base;
      patch(id, { phase: "pending", pending, countdown });
      setDock((d) => d.filter((x) => x !== id));
      setNow(Date.now());
      arm(id, countdown);
      announce(`${pending.line} خلال ست ثوانٍ. زر التراجع متاح.`);
      focusLater(domIds(prefix, id).undo);
    },
    [announce, arm, focusLater, patch, prefix, windowMs],
  );

  const undo = useCallback(
    (id: string): S | null => {
      const current = statesRef.current[id];
      if (!current || current.phase !== "pending") return null;
      clearTimer(id);
      patch(id, { phase: "idle" });
      announce(`أُلغي القرار على ${current.pending?.label ?? "العنصر"}؛ لم يُرسل شيء.`);
      return current.pending?.snapshot ?? null;
    },
    [announce, clearTimer, patch],
  );

  const reset = useCallback(
    (id: string) => {
      clearTimer(id);
      setDock((d) => d.filter((x) => x !== id));
      patch(id, { phase: "idle" });
    },
    [clearTimer, patch],
  );

  const retry = useCallback((id: string) => send(id), [send]);

  const dismissDock = useCallback((id: string) => setDock((d) => d.filter((x) => x !== id)), []);

  /** يرسل كل المعلّق فورًا (التنقل داخل التطبيق)؛ true إن نجح الكل. */
  const flush = useCallback(async (): Promise<boolean> => {
    const ids = Object.entries(statesRef.current)
      .filter(([, s]) => s.phase === "pending")
      .map(([k]) => k);
    if (!ids.length) return true;
    const results = await Promise.all(ids.map((id) => send(id)));
    return results.every(Boolean);
  }, [send]);

  /** تثبيت نتيجة من خارج المسار المؤجَّل (الاعتماد الجماعي). */
  const markDone = useCallback(
    (id: string, label: string, outcome: DecisionOutcome, gender?: Gender) => {
      clearTimer(id);
      const line = resultLine(label, outcome, gender);
      patch(id, { phase: "done", result: { ...line, outcome } });
    },
    [clearTimer, patch],
  );

  const pendingCount = useMemo(() => Object.values(states).filter((s) => s.phase === "pending").length, [states]);

  // عدّاد الثواني الظاهر (aria-hidden) يتحدث كل ثانية ما دام في الطابور قرار معلّق.
  useEffect(() => {
    if (!pendingCount) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [pendingCount]);

  // إخفاء الصفحة يوقف العدّاد ولا يُرسل شيء؛ العودة تستأنف بما بقي (ق٢٧).
  useEffect(() => {
    const onVisibility = () => {
      const t = Date.now();
      const hidden = document.visibilityState === "hidden";
      for (const [id, s] of Object.entries(statesRef.current)) {
        if (s.phase !== "pending" || !s.countdown) continue;
        const countdown = hidden ? pauseCountdown(s.countdown, t) : resumeCountdown(s.countdown, t);
        patch(id, { ...s, countdown });
        if (hidden) clearTimer(id);
        else arm(id, countdown);
      }
      setNow(t);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [arm, clearTimer, patch]);

  // التفكيك (إغلاق، تحديث، رجوع، مغادرة) يلغي كل مهلة بلا طلب.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of Array.from(map.values())) clearTimeout(t);
      map.clear();
    };
  }, []);

  // التنقل داخل التطبيق أثناء المهلة: يُرسل المعلّق أولًا، ولا يتم الانتقال إلا بعد نجاحه (ق٢-٣ المعدّل).
  useEffect(() => {
    if (!pendingCount) return;
    const go = async (href: string) => {
      if (flushing.current) return;
      flushing.current = true;
      const ok = await flush();
      flushing.current = false;
      if (ok) router.push(href);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      void go(`${url.pathname}${url.search}${url.hash}`);
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || !form.hasAttribute("data-desk-nav")) return;
      event.preventDefault();
      event.stopPropagation();
      const data = new FormData(form);
      const params = new URLSearchParams();
      data.forEach((value, key) => {
        if (typeof value === "string" && value) params.set(key, value);
      });
      const action = new URL(form.action || window.location.href, window.location.href);
      void go(`${action.pathname}?${params.toString()}`);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [flush, pendingCount, router]);

  return { states, now, start, undo, reset, retry, flush, markDone, dock, dismissDock, focusLater, pendingCount };
}

export type DeferredDecisions<S> = ReturnType<typeof useDeferredDecisions<S>>;

/** منطقة إعلان واحدة مركّبة فارغة عند التحميل (ق٤-٣)؛ النص يبقى حتى الفعل التالي. */
export function useAnnouncer(): [string, (text: string) => void] {
  const [text, setText] = useState("");
  const flip = useRef(false);
  const announce = useCallback((next: string) => {
    flip.current = !flip.current;
    // محرف صفري العرض يجعل تكرار النص نفسه يُعلن من جديد.
    setText(flip.current ? next : `${next}​`);
  }, []);
  return [text, announce];
}
