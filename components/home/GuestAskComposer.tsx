"use client";

import { useEffect, useState } from "react";
import {
  ASK_FIRST_SUGGESTIONS,
  HOME_ASK_PENDING_RUN_KEY,
  isAskFirstHomeEnabled,
} from "@/lib/modules/config/ask-first-home";
import {
  HAKEEM_ASK_MAX_CHARS,
  HOME_ASK_DRAFT_KEY,
} from "@/lib/modules/config/home-inline-ask";
import { signInWithNext } from "@/lib/modules/auth/safe-next";

/** صندوق السؤال العام: يحفظ المسودة محليًا ويعيد المستخدم إليها بعد الدخول. */
export function GuestAskComposer() {
  const enabled = isAskFirstHomeEnabled();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

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

  function continueToAuth() {
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

    window.location.assign(signInWithNext("/dashboard"));
  }

  return (
    <div className="guest-ask">
      <form
        className="guest-ask__form"
        onSubmit={(event) => {
          event.preventDefault();
          continueToAuth();
        }}
      >
        <div className="guest-ask__box">
          <textarea
            value={value}
            onChange={(event) => persistDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                continueToAuth();
              }
            }}
            rows={3}
            maxLength={HAKEEM_ASK_MAX_CHARS}
            aria-label="اكتب السؤال أو ملخص الوقائع"
            aria-describedby="guest-ask-hint guest-ask-error"
            placeholder="مثال: أبرمت عقدًا ولم ينفّذ الطرف الآخر التزامه، ما الخيارات النظامية؟"
            className="guest-ask__input"
          />
          <button type="submit" className="guest-ask__submit">
            ابدأ التحليل
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
            <button type="button" className="guest-ask__chip" onClick={() => persistDraft(suggestion)}>
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      <p className="guest-ask__auth">
        يُحفظ النص على جهازك، ولا يُضاف إلى رابط الدخول.
      </p>
    </div>
  );
}
