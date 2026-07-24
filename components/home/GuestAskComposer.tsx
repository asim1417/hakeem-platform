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
import { signInWithNext, signUpWithNext } from "@/lib/modules/auth/safe-next";

/**
 * صندوق سؤال للزائر على الصفحة العامة — يحفظ المسودة بأمان ويفتح بوابة الدخول
 * دون وضع نص الواقعة في URL، ثم يُنفَّذ مرة واحدة بعد العودة إلى /dashboard.
 */
export function GuestAskComposer() {
  const enabled = isAskFirstHomeEnabled();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(HOME_ASK_DRAFT_KEY) || "";
      if (draft) setValue(draft);
    } catch {
      /* تجاهل */
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
      /* تجاهل */
    }
  }

  function goAuth(mode: "in" | "up") {
    const q = value.trim();
    if (!q) {
      setError("اكتب سؤالك أو وقائعك أولًا.");
      return;
    }
    if (q.length > HAKEEM_ASK_MAX_CHARS) {
      setError("النص أطول من الحد المتاح. اختصره قبل المتابعة.");
      return;
    }
    try {
      sessionStorage.setItem(HOME_ASK_DRAFT_KEY, q.slice(0, HAKEEM_ASK_MAX_CHARS));
      sessionStorage.setItem(HOME_ASK_PENDING_RUN_KEY, "1");
    } catch {
      setError("تعذّر حفظ السؤال مؤقتًا. حاول مرة أخرى.");
      return;
    }
    window.location.assign(mode === "up" ? signUpWithNext("/dashboard") : signInWithNext("/dashboard"));
  }

  return (
    <div className="guest-ask">
      <form
        className="guest-ask__form"
        onSubmit={(e) => {
          e.preventDefault();
          goAuth("in");
        }}
      >
        <div className="guest-ask__box">
          <textarea
            value={value}
            onChange={(e) => persistDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                goAuth("in");
              }
            }}
            rows={3}
            aria-label="اكتب الواقعة أو السؤال القانوني"
            aria-describedby="guest-ask-hint guest-ask-error"
            placeholder="اكتب الواقعة أو السؤال القانوني بتفاصيله…"
            className="guest-ask__input"
          />
          <button type="submit" className="guest-ask__submit">
            اسأل حكيم
          </button>
        </div>
        <p id="guest-ask-hint" className="guest-ask__hint">
          يمكنك طرح سؤال مختصر، أو كتابة وقائع المسألة بالتفصيل. Enter للإرسال بعد تسجيل الدخول،
          وShift + Enter لسطر جديد.
        </p>
        {error ? (
          <p id="guest-ask-error" className="guest-ask__error" role="alert">
            {error}
          </p>
        ) : (
          <span id="guest-ask-error" className="sr-only" />
        )}
      </form>

      <ul className="guest-ask__suggestions" aria-label="اقتراحات للبدء">
        {ASK_FIRST_SUGGESTIONS.slice(0, 4).map((s) => (
          <li key={s}>
            <button type="button" className="guest-ask__chip" onClick={() => persistDraft(s)}>
              {s}
            </button>
          </li>
        ))}
      </ul>

      <p className="guest-ask__auth">
        سجّل الدخول لبدء التحليل داخل الصفحة.{" "}
        <a href={signUpWithNext("/dashboard")} className="guest-ask__auth-link">
          سجّل مجانًا
        </a>
      </p>
    </div>
  );
}
