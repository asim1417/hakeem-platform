"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  applyAskEventToTurn,
  runAgentSearch,
} from "@/lib/modules/ask/run-agent-search";
import type { AskTurn } from "@/lib/modules/ask/types";
import { trackHomeAskEvent } from "@/lib/modules/ask/home-ask-analytics";
import {
  HAKEEM_ASK_MAX_CHARS,
  HOME_ASK_DRAFT_KEY,
} from "@/lib/modules/config/home-inline-ask";
import {
  HOME_ASK_PENDING_RUN_KEY,
  HOME_ASK_SESSION_KEY,
} from "@/lib/modules/config/ask-first-home";

function newTurnId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function readPendingRun(): boolean {
  try {
    return sessionStorage.getItem(HOME_ASK_PENDING_RUN_KEY) === "1";
  } catch {
    return false;
  }
}

function clearPendingRun() {
  try {
    sessionStorage.removeItem(HOME_ASK_PENDING_RUN_KEY);
  } catch {
    /* تجاهل */
  }
}

function saveSession(turns: AskTurn[]) {
  try {
    if (!turns.length) {
      sessionStorage.removeItem(HOME_ASK_SESSION_KEY);
      return;
    }
    const slim = turns
      .filter((t) => !t.streaming)
      .map((t) => ({
        id: t.id,
        question: t.question,
        answer: t.answer,
        basis: t.basis,
        total: t.total,
        mode: t.mode,
        message: t.message,
        disclosure: t.disclosure,
        groups: t.groups,
        visibleGroups: t.visibleGroups,
        steps: t.steps,
        streaming: false,
        showMethod: false,
        error: t.error,
        clarify: t.clarify,
      }));
    sessionStorage.setItem(HOME_ASK_SESSION_KEY, JSON.stringify({ turns: slim, at: Date.now() }));
  } catch {
    /* تجاهل */
  }
}

function readSession(): AskTurn[] {
  try {
    const raw = sessionStorage.getItem(HOME_ASK_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { turns?: AskTurn[] };
    return Array.isArray(parsed.turns) ? parsed.turns : [];
  } catch {
    return [];
  }
}

/**
 * منطق إرسال «اسأل حكيم» المشترك — يستدعي /api/ai/agent-search مرة واحدة لكل طلب.
 * محمي من الضغط المزدوج وStrict Mode (لا useEffect للإرسال الاعتيادي).
 * الاستثناء الوحيد: استعادة سؤال الزائر بعد الدخول (مرة واحدة).
 */
export function useHakeemAsk() {
  const idPrefix = useId().replace(/:/g, "");
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [sessionSaved, setSessionSaved] = useState(false);
  const busyRef = useRef(false);
  const turnsRef = useRef<AskTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const requestTokenRef = useRef(0);
  const composedRef = useRef(false);
  const pendingRunHandledRef = useRef(false);
  const resultAnchorRef = useRef<HTMLDivElement | null>(null);
  const askRef = useRef<(raw?: string, opts?: { skipBreadth?: boolean; followUp?: boolean }) => Promise<void>>(
    async () => undefined
  );

  useEffect(() => {
    const draft = readDraft();
    if (draft) setValue(draft);
    const saved = readSession();
    if (saved.length) {
      setTurns(saved);
      setSessionSaved(true);
    }
  }, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const patchLastTurn = useCallback((patch: (t: AskTurn) => AskTurn) => {
    setTurns((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
  }, []);

  const setInput = useCallback((next: string) => {
    setValue(next);
    setValidationError("");
    saveDraft(next);
    if (!composedRef.current && next.trim()) {
      composedRef.current = true;
      trackHomeAskEvent("home_ask_compose_start");
    }
  }, []);

  const ask = useCallback(
    async (
      raw?: string,
      opts?: { skipBreadth?: boolean; followUp?: boolean }
    ) => {
      const question = (raw ?? value).trim();
      if (busyRef.current) return;

      if (!question) {
        setValidationError("اكتب سؤالك أو وقائعك أولًا.");
        return;
      }
      if (question.length > HAKEEM_ASK_MAX_CHARS) {
        setValidationError(
          "النص أطول من الحد المتاح. اختصره أو افتح قضية لإرفاق التفاصيل والمستندات."
        );
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setValidationError("");
      setSessionSaved(false);
      const token = ++requestTokenRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      trackHomeAskEvent(opts?.followUp ? "home_ask_followup" : "home_ask_submit");

      const history = turnsRef.current
        .filter((t) => t.answer)
        .flatMap((t) => [
          { role: "user" as const, content: t.question },
          { role: "assistant" as const, content: t.answer as string },
        ])
        .slice(-8);

      setTurns((prev) => [
        ...prev,
        {
          id: newTurnId(idPrefix),
          question,
          steps: [],
          answer: null,
          basis: null,
          total: 0,
          streaming: true,
          showMethod: true,
        },
      ]);

      // امسح الصندوق بعد قبول الطلب فقط
      setValue("");
      saveDraft("");

      requestAnimationFrame(() => {
        resultAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const result = await runAgentSearch({
        query: question,
        mode: "ask",
        skipBreadth: opts?.skipBreadth,
        history: history.length ? history : undefined,
        signal: controller.signal,
        onEvent: (evt) => {
          if (token !== requestTokenRef.current) return;
          if (evt.type === "job" && evt.jobId) {
            try {
              sessionStorage.setItem(
                "hakeem-ask-job",
                JSON.stringify({ jobId: evt.jobId, question })
              );
            } catch {
              /* تجاهل */
            }
            return;
          }
          patchLastTurn((t) => applyAskEventToTurn(t, evt));
          if (evt.type === "done") {
            try {
              sessionStorage.removeItem("hakeem-ask-job");
            } catch {
              /* تجاهل */
            }
          }
        },
      });

      if (token !== requestTokenRef.current) return;

      if (!result.ok) {
        if (result.kind !== "aborted") {
          const message =
            result.kind === "auth"
              ? "انتهت جلستك. سجّل الدخول للمتابعة دون فقد سؤالك."
              : result.message ||
                "تعذّر إكمال الإجابة الآن. بقي سؤالك محفوظًا ويمكنك إعادة المحاولة.";
          patchLastTurn((t) => ({
            ...t,
            streaming: false,
            error: message,
          }));
          // أعد السؤال للصندوق عند الفشل
          setValue(question);
          saveDraft(question);
          trackHomeAskEvent("home_ask_fail");
        } else {
          patchLastTurn((t) => ({ ...t, streaming: false }));
        }
      } else {
        patchLastTurn((t) => ({ ...t, streaming: false }));
        trackHomeAskEvent("home_ask_success");
      }

      busyRef.current = false;
      setBusy(false);
    },
    [value, idPrefix, patchLastTurn]
  );

  askRef.current = ask;

  // استعادة سؤال الزائر بعد الدخول — مرة واحدة فقط
  useEffect(() => {
    if (pendingRunHandledRef.current) return;
    if (!readPendingRun()) return;
    const draft = readDraft().trim();
    if (!draft) {
      clearPendingRun();
      return;
    }
    pendingRunHandledRef.current = true;
    clearPendingRun();
    setValue(draft);
    void askRef.current(draft);
  }, []);

  const retryLast = useCallback(() => {
    const last = turnsRef.current[turnsRef.current.length - 1];
    if (!last || busyRef.current) return;
    trackHomeAskEvent("home_ask_retry");
    setTurns((prev) => prev.slice(0, -1));
    // اسمح بتحديث turnsRef قبل إعادة الإرسال
    turnsRef.current = turnsRef.current.slice(0, -1);
    void ask(last.question);
  }, [ask]);

  const startNew = useCallback(() => {
    if (busyRef.current) {
      abortRef.current?.abort();
      busyRef.current = false;
      setBusy(false);
    }
    requestTokenRef.current += 1;
    setTurns([]);
    setValidationError("");
    setSessionSaved(false);
    try {
      sessionStorage.removeItem(HOME_ASK_SESSION_KEY);
    } catch {
      /* تجاهل */
    }
    trackHomeAskEvent("home_ask_new");
  }, []);

  const askClarify = useCallback(
    (query: string, exhaustive?: boolean) => {
      void ask(query, { skipBreadth: true, followUp: true });
      if (exhaustive) {
        /* detailed غير مفعّل في الرئيسية المصغّرة — نفس مسار ask */
      }
    },
    [ask]
  );

  const saveConversation = useCallback(() => {
    const current = turnsRef.current.filter((t) => !t.streaming && (t.answer || t.error || t.clarify));
    if (!current.length) return false;
    saveSession(current);
    setSessionSaved(true);
    trackHomeAskEvent("home_ask_save_session");
    return true;
  }, []);

  return {
    value,
    setInput,
    turns,
    setTurns,
    busy,
    validationError,
    ask,
    retryLast,
    startNew,
    askClarify,
    saveConversation,
    sessionSaved,
    resultAnchorRef,
    maxChars: HAKEEM_ASK_MAX_CHARS,
  };
}
