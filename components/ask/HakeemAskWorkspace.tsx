"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Compass,
  MessagesSquare,
  NotebookPen,
  Paperclip,
  RotateCcw,
  Scale,
  ScanSearch,
  Sparkles,
  Telescope,
  X,
  type LucideIcon,
} from "lucide-react";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { LegalBasisPanel, type LegalBasisItem } from "@/components/legal/LegalBasisPanel";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import { AnswerToolbar } from "@/components/AnswerToolbar";
import { useWakeLock } from "@/components/hooks/useWakeLock";
import { AGENT_MODES, getAgentMode, type AgentModeId } from "@/lib/modules/agents/modes";
import {
  ASK_FIRST_SUGGESTIONS,
  ASK_TO_CASE_HANDOFF_KEY,
  HOME_ASK_PENDING_RUN_KEY,
} from "@/lib/modules/config/ask-first-home";
import {
  HAKEEM_ASK_MAX_CHARS,
  HOME_ASK_DRAFT_KEY,
  HOME_ASK_HANDOFF_KEY,
} from "@/lib/modules/config/home-inline-ask";
import { signInWithNext } from "@/lib/modules/auth/safe-next";

/** أيقونات الأوضاع — Lucide بدل الإيموجي. */
const MODE_ICONS: Record<AgentModeId, LucideIcon> = {
  ask: Sparkles,
  "analyze-case": ScanSearch,
  "action-plan": ClipboardList,
  "verdict-estimate": Scale,
  consultation: NotebookPen,
  chat: MessagesSquare,
};

type Precedents = {
  rulings: Array<{ title: string; snippet?: string }>;
  principles: Array<{ title: string; snippet?: string }>;
};

type StepStatus = "running" | "done";
type Step = { id: string; status: StepStatus; label: string; data?: unknown };

type Turn = {
  question: string;
  steps: Step[];
  answer: string | null;
  mode?: "live" | "offline" | "intent" | "blocked";
  basis: LegalBasisItem[] | null;
  total: number;
  coverage?: { answered: number; total: number; issues?: Array<{ systemName?: string; status: string }> };
  clarify?: {
    message: string;
    dimension?: string;
    options: Array<{ id: string; label: string; query: string; exhaustive?: boolean; hint?: string }>;
  };
  groups?: Array<{ systemName: string; count: number; table: string }>;
  disclosure?: string;
  visibleGroups?: number;
  message?: string;
  error?: string;
  authRequired?: boolean;
  precedents?: Precedents;
  streaming: boolean;
  showMethod: boolean;
};

export type HakeemAskWorkspaceProps = {
  userName?: string;
  initialQuery?: string;
  initialMode?: string;
  /** home = سطح الرئيسية داخل /dashboard؛ page = مساحة العمل الكاملة */
  variant?: "home" | "page";
};

/** تسميات ودّية لخطوات البث — ثلاث مراحل واضحة للمستخدم. */
function friendlyStepLabel(step: Step): string {
  const id = step.id || "";
  const label = step.label || "";
  if (
    /intent|breadth|takyeef|scope|classif|فهم/.test(id) ||
    /فهم|تصنيف|تكييف|رسالت|سؤال|intent/i.test(label)
  ) {
    return "فهم السؤال";
  }
  if (
    /retriev|search|scan|round|sweep|mazann|deepen|precedents|exhaustive|verify/.test(id) ||
    /بحث|استرجاع|مسح|استقصاء|مظان|تعميق|تحقّق|تحقق|مادة|أحكام/i.test(label)
  ) {
    return "البحث في المصادر";
  }
  if (
    /analysis|synth|generat|draft|answer/.test(id) ||
    /تحليل|إعداد|توليد|صياغ|أحلّل|أنجزت/i.test(label)
  ) {
    return "إعداد التحليل";
  }
  if (step.status === "running") return "إعداد التحليل";
  return label || "إعداد التحليل";
}

function saveDraft(text: string) {
  try {
    if (!text.trim()) sessionStorage.removeItem(HOME_ASK_DRAFT_KEY);
    else sessionStorage.setItem(HOME_ASK_DRAFT_KEY, text.slice(0, HAKEEM_ASK_MAX_CHARS));
  } catch {
    /* تجاهل */
  }
}

function readDraft(): string {
  try {
    return sessionStorage.getItem(HOME_ASK_DRAFT_KEY) || "";
  } catch {
    return "";
  }
}

export function HakeemAskWorkspace({
  userName,
  initialQuery = "",
  initialMode = "ask",
  variant = "page",
}: HakeemAskWorkspaceProps) {
  const isHome = variant === "home";
  const [value, setValue] = useState(initialQuery);
  const [detailed, setDetailed] = useState(false);
  const [modeId, setModeId] = useState<AgentModeId>(getAgentMode(initialMode).id);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState("");
  useWakeLock(busy || extracting);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backgroundedRef = useRef(false);
  const busyRef = useRef(false);
  const requestTokenRef = useRef(0);
  const turnsRef = useRef<Turn[]>([]);
  const pendingRunHandledRef = useRef(false);
  const askRef = useRef<(q?: string, override?: { detailed?: boolean; skipBreadth?: boolean }) => Promise<void>>(
    async () => undefined
  );

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // تسليم من الرئيسية — يملأ الصندوق فقط دون تنفيذ تلقائي.
  useEffect(() => {
    if (initialQuery) return;
    try {
      const raw = sessionStorage.getItem(HOME_ASK_HANDOFF_KEY);
      if (!raw) return;
      sessionStorage.removeItem(HOME_ASK_HANDOFF_KEY);
      const parsed = JSON.parse(raw) as { question?: string };
      if (typeof parsed.question === "string" && parsed.question.trim()) {
        setValue(parsed.question.trim().slice(0, HAKEEM_ASK_MAX_CHARS));
      }
    } catch {
      /* تجاهل */
    }
  }, [initialQuery]);

  // على الرئيسية فقط: استعادة سؤال الزائر بعد الدخول — مرة واحدة، بلا URL ولا تحويل إلى /dashboard/ask.
  useEffect(() => {
    if (!isHome) return;
    if (pendingRunHandledRef.current) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(HOME_ASK_PENDING_RUN_KEY) === "1";
    } catch {
      return;
    }
    if (!pending) return;
    const draft = readDraft().trim();
    try {
      sessionStorage.removeItem(HOME_ASK_PENDING_RUN_KEY);
    } catch {
      /* تجاهل */
    }
    if (!draft) return;
    pendingRunHandledRef.current = true;
    setValue(draft);
    void askRef.current(draft);
  }, [isHome]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && busyRef.current) backgroundedRef.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, []);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const r = await extractFile(file);
      if (r.text.trim()) {
        setAttachedDoc(r.text.trim());
        setAttachedName(file.name);
      } else {
        setAttachedDoc("");
        setAttachedName(null);
      }
    } catch {
      setAttachedDoc("");
      setAttachedName(null);
    } finally {
      setExtracting(false);
    }
  }

  function patchLastTurn(patch: (t: Turn) => Turn) {
    setTurns((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
  }

  function applyEvent(evt: Record<string, unknown>) {
    const type = evt.type;
    if (type === "step") {
      patchLastTurn((t) => {
        const steps = t.steps.slice();
        const idx = steps.findIndex((s) => s.id === evt.id);
        const step: Step = {
          id: String(evt.id ?? ""),
          status: evt.status === "done" ? "done" : "running",
          label: String(evt.label ?? ""),
          data: evt.data,
        };
        if (idx >= 0) steps[idx] = step;
        else steps.push(step);
        return { ...t, steps };
      });
    } else if (type === "result") {
      const precedents = evt.precedents as Precedents | undefined;
      patchLastTurn((t) => ({
        ...t,
        answer: typeof evt.answer === "string" ? evt.answer : null,
        mode: evt.mode as Turn["mode"],
        basis: (evt.basis ?? []) as LegalBasisItem[],
        total: typeof evt.total === "number" ? evt.total : 0,
        coverage: evt.coverage as Turn["coverage"],
        groups: Array.isArray(evt.groups) ? (evt.groups as Turn["groups"]) : undefined,
        disclosure: typeof evt.disclosure === "string" ? evt.disclosure : undefined,
        visibleGroups: Array.isArray(evt.groups) ? 3 : undefined,
        message: typeof evt.message === "string" ? evt.message : undefined,
        precedents:
          precedents && (precedents.rulings?.length || precedents.principles?.length)
            ? precedents
            : undefined,
      }));
    } else if (type === "clarify") {
      patchLastTurn((t) => ({
        ...t,
        clarify: {
          message: String(evt.message ?? ""),
          dimension: typeof evt.dimension === "string" ? evt.dimension : undefined,
          options: Array.isArray(evt.options)
            ? (evt.options as NonNullable<Turn["clarify"]>["options"])
            : [],
        },
      }));
    } else if (type === "error") {
      patchLastTurn((t) => ({
        ...t,
        error: typeof evt.message === "string" ? evt.message : "خطأ غير متوقع.",
      }));
    } else if (type === "done") {
      patchLastTurn((t) => ({ ...t, streaming: false, showMethod: false }));
    }
  }

  // استئناف مهمّة «اسأل حكيم» الخلفيّة من sessionStorage.
  useEffect(() => {
    let stop = false;
    async function resume() {
      if (busyRef.current) return;
      let raw = "";
      try {
        raw = sessionStorage.getItem("hakeem-ask-job") ?? "";
      } catch {
        return;
      }
      if (!raw) return;
      let p: { jobId?: string; question?: string } = {};
      try {
        p = JSON.parse(raw);
      } catch {
        return;
      }
      if (!p.jobId) return;
      setTurns((prev) => [
        ...prev,
        {
          question: p.question || "بحثٌ سابق",
          steps: [],
          answer: null,
          basis: null,
          total: 0,
          streaming: true,
          showMethod: false,
        },
      ]);
      for (let i = 0; i < 180 && !stop; i += 1) {
        let j: { status?: string; meta?: { result?: Record<string, unknown> } } | null = null;
        try {
          const r = await fetch(`/api/jobs/${p.jobId}`, { cache: "no-store" });
          if (r.status === 404) {
            try {
              sessionStorage.removeItem("hakeem-ask-job");
            } catch {
              /* تجاهل */
            }
            break;
          }
          j = await r.json();
        } catch {
          /* أعِد */
        }
        if (j && (j.status === "done" || j.status === "error")) {
          if (j.meta?.result) applyEvent(j.meta.result);
          applyEvent({ type: "done" });
          try {
            sessionStorage.removeItem("hakeem-ask-job");
          } catch {
            /* تجاهل */
          }
          break;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void resume();
    };
    void resume();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(q?: string, override?: { detailed?: boolean; skipBreadth?: boolean }) {
    const question = (q ?? value).trim();
    const doc = attachedDoc;
    if ((!question && !doc) || busyRef.current) return;

    if (question.length > HAKEEM_ASK_MAX_CHARS) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    const token = ++requestTokenRef.current;
    setValue("");
    saveDraft("");
    backgroundedRef.current = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const shown =
      question || (attachedName ? `تحليل المستند: ${attachedName}` : "تحليل المستند المرفق");
    setTurns((prev) => [
      ...prev,
      {
        question: shown,
        steps: [],
        answer: null,
        basis: null,
        total: 0,
        streaming: true,
        showMethod: true,
      },
    ]);

    // دائمًا: آخر 8 أزواج سؤال/جواب للمتابعة — لكل الأوضاع لا الحوارية فقط.
    const history = turnsRef.current
      .filter((t) => t.answer)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer as string },
      ])
      .slice(-8);

    try {
      const res = await fetch("/api/ai/agent-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: question,
          document: doc || undefined,
          detailed: override?.detailed ?? detailed,
          skipBreadth: override?.skipBreadth ?? false,
          mode: modeId,
          history: history.length ? history : undefined,
        }),
        signal: controller.signal,
      });

      if (token !== requestTokenRef.current) return;

      if (!res.ok || !res.body) {
        const auth = res.status === 401;
        const msg = auth
          ? "انتهت الجلسة — يلزم تسجيل الدخول."
          : "تعذّر تنفيذ البحث الوكيلي.";
        if (auth) {
          saveDraft(shown);
          setValue(shown);
        }
        patchLastTurn((t) => ({
          ...t,
          streaming: false,
          error: msg,
          authRequired: auth,
        }));
        busyRef.current = false;
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
        if (token !== requestTokenRef.current) return;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (evt.type === "job" && evt.jobId) {
            try {
              sessionStorage.setItem(
                "hakeem-ask-job",
                JSON.stringify({ jobId: evt.jobId, question: shown })
              );
            } catch {
              /* لا تخزين */
            }
          } else {
            applyEvent(evt);
            if (evt.type === "done") {
              try {
                sessionStorage.removeItem("hakeem-ask-job");
              } catch {
                /* اكتملت */
              }
            }
          }
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      if (token !== requestTokenRef.current) return;
      patchLastTurn((t) => ({ ...t, streaming: false }));
    } catch (e) {
      if (token !== requestTokenRef.current) return;
      const backgrounded =
        backgroundedRef.current || (e instanceof DOMException && e.name === "AbortError");
      patchLastTurn((t) => ({
        ...t,
        streaming: false,
        error: backgrounded
          ? "توقّف البحث لأنك غادرت الصفحة على الجوّال قبل اكتماله — أعد المحاولة."
          : "انقطع الاتصال أثناء البحث.",
      }));
    } finally {
      if (token === requestTokenRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  askRef.current = ask;

  function retry(question: string) {
    if (busyRef.current) return;
    setTurns((prev) => prev.slice(0, -1));
    turnsRef.current = turnsRef.current.slice(0, -1);
    void ask(question);
  }

  function startNew() {
    if (busyRef.current) {
      abortRef.current?.abort();
      busyRef.current = false;
      setBusy(false);
    }
    requestTokenRef.current += 1;
    setTurns([]);
    setAttachedDoc("");
    setAttachedName(null);
  }

  function convertToCase(question: string) {
    try {
      sessionStorage.setItem(
        ASK_TO_CASE_HANDOFF_KEY,
        JSON.stringify({
          subject: question.slice(0, 120),
          factsNote: question.slice(0, 4000),
          at: Date.now(),
        })
      );
    } catch {
      /* تجاهل */
    }
    window.location.assign("/dashboard/judicial-assistant");
  }

  function fillSuggestion(text: string) {
    setValue(text.slice(0, HAKEEM_ASK_MAX_CHARS));
  }

  const greeting = userName ? `أهلاً، ${userName}` : "أهلاً بك";
  const followUpMode = turns.length > 0 && Boolean(turns[turns.length - 1]?.answer) && !busy;
  const emptyTitle = isHome ? "ابدأ بسؤالك القانوني" : greeting;
  const emptyLede = isHome
    ? "اكتب وقائع المسألة أو سؤالك القانوني، ودع حكيم يبحث في المصادر ويُعدّ التحليل."
    : "كيف أساعدك اليوم؟ اسألني في الأنظمة السعودية وسأبحث في النواة القانونية الموثّقة.";
  const suggestions = isHome ? ASK_FIRST_SUGGESTIONS : null;
  const inputPlaceholder = followUpMode
    ? "اسأل عن نقطة أخرى في السياق نفسه…"
    : attachedName
      ? "اكتب سؤالك عن المستند المرفق (اختياريّ)…"
      : isHome
        ? "اكتب سؤالك أو وقائع المسألة القانونية…"
        : getAgentMode(modeId).placeholder ?? "اسأل في القانون ما شئت…";
  const submitLabel = busy ? "جارٍ…" : followUpMode ? "إرسال" : "اسأل حكيم";

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-6">
        {turns.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-[var(--gold-bright)] shadow-[var(--sh-md)]">
              <Sparkles size={30} aria-hidden />
            </span>
            <h1 className="t-head mt-5 text-2xl font-bold text-[var(--navy)] md:text-3xl">{emptyTitle}</h1>
            <p className="mt-2 max-w-md leading-7 text-[var(--ink-60)]">{emptyLede}</p>

            {suggestions ? (
              <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => fillSuggestion(s)}
                    className="focus-ring rounded-[var(--r-lg)] border border-[var(--ink-15)] bg-ivory px-4 py-3 text-right text-sm leading-6 text-[var(--ink-80)] shadow-[var(--sh-xs)] transition hover:-translate-y-0.5 hover:border-[var(--gold)] hover:bg-[var(--gold-ghost)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(
                  [
                    "ما مدّة الاستئناف أمام المحاكم التجارية؟",
                    "متى يسقط الحقّ بالتقادم في المعاملات المدنية؟",
                    "ما أحكام الفصل التعسّفي في نظام العمل؟",
                    "ما شروط صحّة عقد البيع نظامًا؟",
                  ] as const
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(s)}
                    className="focus-ring rounded-[var(--r-lg)] border border-[var(--ink-15)] bg-ivory px-4 py-3 text-right text-sm leading-6 text-[var(--ink-80)] shadow-[var(--sh-xs)] transition hover:-translate-y-0.5 hover:border-[var(--gold)] hover:bg-[var(--gold-ghost)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {!isHome ? (
              <p className="mt-6 max-w-md text-xs leading-6 text-[var(--ink-40)]">
                الأزرار أسفل الصندوق{" "}
                <b className="font-semibold text-[var(--ink-60)]">أوضاعٌ</b> لعقلٍ واحد تغيّر زاوية
                الإجابة. وللوكلاء المخصّصين بنطاقاتٍ ومهاراتٍ مستقلّة، افتح{" "}
                <a
                  href="/dashboard/agents"
                  className="font-semibold text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy-mid)]"
                >
                  صفحة الوكلاء
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : (
          turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--navy)] px-4 py-2.5 text-sm leading-7 text-white">
                  {turn.question}
                </div>
              </div>

              <div className="space-y-3">
                {turn.steps.length > 0 ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4">
                    <button
                      type="button"
                      onClick={() => patchTurn(setTurns, i, (t) => ({ ...t, showMethod: !t.showMethod }))}
                      className="focus-ring flex w-full items-center justify-between gap-2 text-right"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                        <Telescope size={16} aria-hidden />
                        {turn.streaming ? "جارٍ تحليل السؤال…" : "طريقة البحث"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-60)]">
                        {turn.showMethod ? "إخفاء طريقة البحث" : "إظهار طريقة البحث"}
                        {turn.showMethod ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                      </span>
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
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--emerald-soft)] text-[var(--emerald)]">
                                  <Check size={12} aria-hidden />
                                </span>
                              ) : (
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--ink-80)]">
                                {friendlyStepLabel(step)}
                              </p>
                              {step.data &&
                              typeof step.data === "object" &&
                              step.data !== null &&
                              "sub" in step.data &&
                              typeof (step.data as { sub?: unknown }).sub === "string" ? (
                                <p className="mt-0.5 text-xs leading-6 text-[var(--ink-60)]">
                                  {(step.data as { sub: string }).sub}
                                </p>
                              ) : null}
                              {step.id === "retrieved" &&
                              step.data &&
                              typeof step.data === "object" &&
                              Array.isArray((step.data as { sample?: unknown }).sample) &&
                              ((step.data as { sample: unknown[] }).sample.length > 0) ? (
                                <ul className="mt-1.5 space-y-1">
                                  {(step.data as { sample: Array<{ systemName?: string; articleNumber?: number }> })
                                    .sample.slice(0, 6)
                                    .map((it, k) => (
                                      <li key={k} className="font-mono-legal text-[11px] text-[var(--ink-60)]">
                                        · {it.systemName} · م
                                        {Number(it.articleNumber).toLocaleString("ar-SA")}
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
                    جارٍ فهم السؤال…
                  </div>
                ) : null}

                {turn.mode === "blocked" ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center">
                    <p className="text-sm font-bold text-[var(--navy)]">انتهى رصيدك المجانيّ</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-80)]">
                      {turn.message ??
                        "للمتابعة في «اسأل حكيم» والقاضي والاستشارات، اشترك في حكيم. وتصفّح النواة القانونية يبقى مجانيًّا."}
                    </p>
                    <Link
                      href="/dashboard/billing"
                      className="focus-ring mt-4 inline-block rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)]"
                    >
                      الحساب والرصيد
                    </Link>
                  </div>
                ) : null}

                {turn.error ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-4 text-sm leading-7 text-[var(--ruby)]">
                    <span>{turn.error}</span>
                    <div className="flex flex-wrap gap-2">
                      {turn.authRequired ? (
                        <Link
                          href={signInWithNext("/dashboard")}
                          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--navy-mid)]"
                        >
                          تسجيل الدخول
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => retry(turn.question)}
                          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={14} aria-hidden /> إعادة المحاولة
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {turn.groups && turn.groups.length ? (
                  <div className="space-y-3">
                    {turn.answer ? (
                      <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-4 shadow-[var(--sh-xs)]">
                        <AnswerRenderer content={turn.answer} />
                        <p className="mt-1 text-xs text-[var(--ink-60)]">
                          وجدتُ مدداً في {turn.groups.length.toLocaleString("ar-SA")} أنظمة · إجمالي{" "}
                          {turn.total.toLocaleString("ar-SA")} مادة. تُعرَض دفعةً دفعة.
                        </p>
                      </div>
                    ) : null}
                    {turn.groups.slice(0, turn.visibleGroups ?? 3).map((g, gi) => (
                      <div
                        key={`${g.systemName}-${gi}`}
                        className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-4 shadow-[var(--sh-xs)]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--ink-08)] pb-2">
                          <span className="text-sm font-bold text-[var(--navy)]">{g.systemName}</span>
                          <span className="rounded-full bg-[var(--gold-ghost)] px-2 py-0.5 text-[11px] font-semibold text-[var(--gold-dark)]">
                            {g.count.toLocaleString("ar-SA")} مادة بمدد
                          </span>
                        </div>
                        <AnswerRenderer content={g.table} />
                      </div>
                    ))}
                    {(turn.visibleGroups ?? 3) < turn.groups.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          patchTurn(setTurns, i, (t) => ({
                            ...t,
                            visibleGroups: (t.visibleGroups ?? 3) + 3,
                          }))
                        }
                        className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--gold)] bg-[var(--gold-ghost)] px-3 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white"
                      >
                        عرض المزيد <ChevronDown size={16} aria-hidden /> (
                        {(turn.groups.length - (turn.visibleGroups ?? 3)).toLocaleString("ar-SA")} نظامًا
                        متبقّيًا)
                      </button>
                    ) : null}
                    {turn.disclosure ? (
                      <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3">
                        <AnswerRenderer content={turn.disclosure} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {turn.clarify ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
                    <p className="mb-3 flex items-start gap-2 text-sm font-semibold leading-7 text-[var(--navy)]">
                      <Compass size={16} className="mt-0.5 shrink-0" aria-hidden />
                      {turn.clarify.message}
                    </p>
                    <div className="flex flex-col gap-2">
                      {turn.clarify.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void ask(opt.query, { detailed: !!opt.exhaustive, skipBreadth: true })}
                          className="focus-ring flex items-center justify-between gap-2 rounded-lg border border-[var(--gold)] bg-ivory px-3.5 py-2.5 text-right text-sm font-semibold text-[var(--navy)] shadow-[var(--sh-xs)] transition hover:bg-[var(--navy)] hover:text-white disabled:opacity-50"
                        >
                          <span className="flex flex-col">
                            <span>{opt.label}</span>
                            {opt.hint ? (
                              <span className="text-[11px] font-normal opacity-70">{opt.hint}</span>
                            ) : null}
                          </span>
                          <span aria-hidden>←</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turn.answer && !turn.groups ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-5 shadow-[var(--sh-xs)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 border-b border-[var(--ink-08)] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-[var(--gold-bright)]">
                          <Sparkles size={15} aria-hidden />
                        </span>
                        <span className="text-sm font-bold text-[var(--navy)]">إجابة حكيم</span>
                        {turn.mode !== "intent" ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={
                              turn.mode === "live"
                                ? { color: "var(--emerald)", background: "var(--emerald-soft)" }
                                : { color: "var(--amber)", background: "var(--amber-soft)" }
                            }
                            title={
                              turn.mode === "live"
                                ? "صياغة ذكية مستندة للمواد"
                                : "صياغة تدريبية مُركّبة من المواد (دون مزوّد ذكاء مفعّل)"
                            }
                          >
                            {turn.mode === "live" ? "صياغة مستندة" : "صياغة تدريبية"}
                          </span>
                        ) : null}
                      </div>
                      {turn.mode !== "intent" ? (
                        <AnswerToolbar
                          answer={turn.answer}
                          basis={turn.basis ?? []}
                          question={turn.question}
                          printTargetId={`t${i}-answer`}
                        />
                      ) : null}
                    </div>
                    {turn.mode === "intent" ? (
                      <p className="whitespace-pre-wrap leading-8 text-[var(--ink-80)]">{turn.answer}</p>
                    ) : (
                      <AnswerRenderer
                        content={turn.answer}
                        basis={turn.basis ?? []}
                        anchorPrefix={`t${i}-src-`}
                        id={`t${i}-answer`}
                      />
                    )}
                  </div>
                ) : null}

                {turn.coverage && turn.coverage.total >= 2 ? (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border px-4 py-2.5 text-xs font-semibold"
                    style={
                      turn.coverage.answered >= turn.coverage.total
                        ? {
                            color: "var(--emerald)",
                            background: "var(--emerald-soft)",
                            borderColor: "rgba(26,92,65,0.30)",
                          }
                        : {
                            color: "var(--amber)",
                            background: "var(--amber-soft)",
                            borderColor: "rgba(184,114,26,0.30)",
                          }
                    }
                  >
                    <Check size={14} aria-hidden />
                    <span>
                      التغطية: {turn.coverage.answered.toLocaleString("ar-SA")} من{" "}
                      {turn.coverage.total.toLocaleString("ar-SA")}
                      {turn.coverage.answered >= turn.coverage.total
                        ? " — كل الأنظمة المستهدفة مُجابة"
                        : " — بعض الأنظمة بلا نصّ مطابق"}
                    </span>
                    {Array.isArray(turn.coverage.issues) ? (
                      <span className="flex flex-wrap gap-1.5">
                        {turn.coverage.issues
                          .filter((iss) => iss.systemName)
                          .map((iss, k) => (
                            <span
                              key={k}
                              className="rounded-full bg-ivory/60 px-2 py-0.5"
                              style={{
                                color: iss.status === "answered" ? "var(--emerald)" : "var(--ink-60)",
                              }}
                            >
                              {iss.status === "answered" ? "✓" : "—"} {iss.systemName}
                            </span>
                          ))}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {turn.basis !== null && turn.mode !== "intent" && !turn.groups ? (
                  turn.basis.length ? (
                    <LegalBasisPanel
                      items={turn.basis}
                      anchorPrefix={`t${i}-src-`}
                      title="الأساس النظامي من النواة"
                      note={`المواد التي استندت إليها الإجابة — كلٌّ منها قائم فعلاً في النواة القانونية (إجمالي ${turn.total.toLocaleString("ar-SA")} نتيجة بحث).`}
                    />
                  ) : turn.answer ? null : (
                    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
                      {turn.message ?? "لا يوجد سند نظامي كافٍ."}
                    </div>
                  )
                ) : null}

                {turn.precedents ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
                      <Scale size={15} aria-hidden /> سوابق قضائية استُؤنِس بها
                    </p>
                    <p className="mb-3 text-xs leading-6 text-[var(--ink-60)]">
                      وجّهت التحليل والترجيح — سياقٌ استئناسيّ، لا سندٌ نظاميّ للأرقام (الأرقام من المواد
                      أعلاه حصرًا).
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {turn.precedents.rulings.map((r, k) => (
                        <div key={`r-${k}`} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory p-2.5">
                          <p className="text-xs font-semibold text-[var(--navy)]">حكم · {r.title}</p>
                          {r.snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-60)]">
                              {r.snippet}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {turn.precedents.principles.map((p, k) => (
                        <div key={`p-${k}`} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory p-2.5">
                          <p className="text-xs font-semibold text-[var(--gold-dark)]">مبدأ · {p.title}</p>
                          {p.snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-60)]">
                              {p.snippet}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* مخارج متخصصة بعد الإجابة — فقط بضغطة المستخدم، بلا تحويل تلقائي لـ /dashboard/ask */}
                {!turn.streaming && turn.answer && i === turns.length - 1 ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => convertToCase(turn.question)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold)] bg-[var(--gold-ghost)] px-3.5 py-2 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white"
                    >
                      <Scale size={14} aria-hidden /> تحويل إلى قضية
                    </button>
                    <Link
                      href="/dashboard/judicial-assistant"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      فتح المعاون
                    </Link>
                    <Link
                      href="/dashboard/legal-core"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      <BookOpen size={14} aria-hidden /> المكتبة
                    </Link>
                    <button
                      type="button"
                      onClick={startNew}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      <MessagesSquare size={14} aria-hidden /> محادثة جديدة
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-[var(--hakeem-bg)] via-[var(--hakeem-bg)] to-transparent pt-3">
        {turns.length > 0 && !busy ? (
          <div className="mb-2 flex justify-end px-1">
            <button
              type="button"
              onClick={startNew}
              className="focus-ring text-xs font-semibold text-[var(--ink-60)] underline-offset-2 hover:text-[var(--navy)] hover:underline"
            >
              محادثة جديدة
            </button>
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
          className="rounded-[var(--r-xl)] border border-[var(--ink-15)] bg-ivory p-2 shadow-[var(--sh-md)] focus-within:border-[var(--gold)]"
        >
          <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
            {AGENT_MODES.map((m) => {
              const active = m.id === modeId;
              const Icon = MODE_ICONS[m.id] ?? Sparkles;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModeId(m.id)}
                  aria-pressed={active}
                  title={m.hint}
                  className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[var(--gold)] bg-[var(--gold-ghost)] text-[var(--navy)]"
                      : "border-[var(--ink-15)] text-[var(--ink-60)] hover:text-[var(--navy)]"
                  }`}
                >
                  <Icon size={14} aria-hidden /> {m.name}
                </button>
              );
            })}
          </div>
          {attachedName ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-[var(--navy)]">
                <Paperclip size={13} aria-hidden />
                <span className="truncate font-semibold">{attachedName}</span>
                <span className="shrink-0 text-[var(--ink-60)]">
                  · مستند مُرفَق ({attachedDoc.length.toLocaleString("ar-SA")} حرف)
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachedDoc("");
                  setAttachedName(null);
                }}
                className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[var(--ink-60)] transition hover:text-[var(--ruby)]"
                aria-label="إزالة المستند"
              >
                <X size={12} aria-hidden /> إزالة
              </button>
            </div>
          ) : null}
          <textarea
            value={value}
            onChange={(e) => {
              const next = e.target.value.slice(0, HAKEEM_ASK_MAX_CHARS);
              setValue(next);
              saveDraft(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            rows={isHome && turns.length === 0 ? 2 : 1}
            placeholder={inputPlaceholder}
            className="max-h-40 min-h-[44px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
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
                <Telescope size={14} aria-hidden /> بحث تفصيلي {detailed ? "(مُفعّل)" : ""}
              </button>
              <label
                title="أرفق مستندًا لاستخراج نصّه محليًّا"
                className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--ink-15)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-60)] transition hover:text-[var(--navy)]"
              >
                <Paperclip size={14} aria-hidden /> {extracting ? "جارٍ…" : "إضافة مستند"}
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  onChange={onFile}
                  disabled={extracting || busy}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy || (!value.trim() && !attachedDoc)}
              className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
        <p className="mt-2 px-1 text-center text-[11px] leading-6 text-[var(--ink-40)]">
          حكيم يبحث في النواة القانونية الموثّقة فقط ولا يولّد مواد غير موجودة. مخرجاته مساعدة وتعليمية
          وليست رأيًا قانونيًا نهائيًا.
        </p>
      </div>
    </div>
  );
}

function patchTurn(
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  index: number,
  patch: (t: Turn) => Turn
) {
  setTurns((prev) => {
    if (index < 0 || index >= prev.length) return prev;
    const next = prev.slice();
    next[index] = patch(next[index]);
    return next;
  });
}
