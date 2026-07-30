"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  ASK_FIRST_SUGGESTIONS,
  HOME_ASK_PENDING_RUN_KEY,
  isAskFirstHomeEnabled,
} from "@/lib/modules/config/ask-first-home";
import {
  HAKEEM_ASK_MAX_CHARS,
  HOME_ASK_DRAFT_KEY,
} from "@/lib/modules/config/home-inline-ask";

const GOOGLE_ENTRY_PATH = `/api/auth/google?next=${encodeURIComponent("/dashboard")}`;

/** صندوق السؤال العام: يحفظ المسودة محليًا وينقل المستخدم مباشرة إلى Google. */
export function GuestAskComposer() {
  const enabled = isAskFirstHomeEnabled();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(HOME_ASK_DRAFT_KEY) || "";
      if (draft) setValue(draft);
    } catch {
      /* التخزين المحلي تحسين اختياري؛ لا يكسر الصفحة. */
    }
  }, []);

  if (!enabled) return null;

  function persistDraft(next: string) {
    setValue(next);
    setError("");
    try {
      if (!next.trim()) sessionStorage.removeItem(HOME_ASK_DRAFT_KEY);
      else sessionStorage.setItem(HOME_ASK_DRAFT_KEY, next.slice(0, HAKEEM_ASK_MAX_CHARS));
    } catch {
      /* تجاهل تعذّر التخزين حتى لحظة المتابعة. */
    }
  }

  function continueToGoogle() {
    if (isRedirecting) return;

    const question = value.trim();
    if (!question) {
      setError("اكتب سؤالك أو ملخص الوقائع أولًا.");
      return;
    }
    if (question.length > HAKEEM_ASK_MAX_CHARS) {
      setError("النص أطول من الحد المتاح. اختصره قبل المتابعة.");
      return;
    }

    try {
      sessionStorage.setItem(HOME_ASK_DRAFT_KEY, question.slice(0, HAKEEM_ASK_MAX_CHARS));
      sessionStorage.setItem(HOME_ASK_PENDING_RUN_KEY, "1");
    } catch {
      setError("تعذّر حفظ السؤال مؤقتًا على هذا الجهاز. أعد المحاولة.");
      return;
    }

    setIsRedirecting(true);
    window.location.assign(GOOGLE_ENTRY_PATH);
  }

  return (
    <div className="guest-ask">
      <form
        className="guest-ask__form"
        aria-busy={isRedirecting}
        onSubmit={(event) => {
          event.preventDefault();
          continueToGoogle();
        }}
      >
        <div className="guest-ask__box">
          <textarea
            value={value}
            disabled={isRedirecting}
            onChange={(event) => persistDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                continueToGoogle();
              }
            }}
            rows={3}
            maxLength={HAKEEM_ASK_MAX_CHARS}
            aria-label="اكتب السؤال أو ملخص الوقائع"
            aria-describedby="guest-ask-hint guest-ask-error"
            placeholder="مثال: أبرمت عقدًا ولم ينفّذ الطرف الآخر التزامه، ما الخيارات النظامية؟"
            className="guest-ask__input"
          />
          <button
            type="submit"
            disabled={isRedirecting}
            className="guest-ask__submit"
          >
            {isRedirecting ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                جاري فتح Google…
              </span>
            ) : (
              "ابدأ التحليل عبر Google"
            )}
          </button>
        </div>
        <p id="guest-ask-hint" className="guest-ask__hint">
          Enter للمتابعة · Shift + Enter لسطر جديد
        </p>
        {error ? (
          <p id="guest-ask-error" className="guest-ask__error" role="alert" aria-live="polite">
            {error}
          </p>
        ) : (
          <span id="guest-ask-error" className="sr-only" aria-live="polite" />
        )}
      </form>

      <ul className="guest-ask__suggestions" aria-label="أمثلة للبدء">
        {ASK_FIRST_SUGGESTIONS.slice(0, 4).map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              disabled={isRedirecting}
              className="guest-ask__chip"
              onClick={() => persistDraft(suggestion)}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      <p className="guest-ask__auth">
        تُحفظ المسألة على جهازك، وتعود إليها بعد موافقة Google.
      </p>
    </div>
  );
}
