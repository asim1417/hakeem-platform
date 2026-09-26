"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { CODE_LENGTH, sanitizeCode } from "@/lib/modules/auth/identifier-flow";

/** مهلة الإرسال التلقائي بعد اكتمال آخر رقم (200–300ms وفق الشاشة ٣). */
export const CODE_AUTOSUBMIT_DELAY_MS = 250;

/**
 * حقل رمز التحقق — ست خانات مرئية، وتقنيًا حقل واحد خلفها:
 * type=text · inputmode=numeric · autocomplete=one-time-code · maxlength=6.
 * اللصق والتعبئة التلقائية من الرسالة يملآن الخانات كلها (مع تحويل الأرقام العربية).
 * اكتمال الرقم السادس ← onFilled بعد 250ms، مرة واحدة لكل قيمة.
 */
export function CodeInput({
  value,
  onChange,
  onFilled,
  legend = "رمز التحقق (٦ أرقام)",
  hint = "يُملأ تلقائيًا من الرسالة، ويُتحقق منه فور اكتماله.",
  invalid = false,
  errorId,
  disabled = false,
  autoFocus = false,
  focusSignal = 0,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  onFilled: (code: string) => void;
  legend?: string;
  hint?: string;
  invalid?: boolean;
  /** معرّف رسالة الخطأ — تُربط بالحقل عبر aria-describedby */
  errorId?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** يتغيّر الرقم ← إعادة التركيز على الحقل (بعد خطأ) */
  focusSignal?: number;
  /** رسالة الخطأ تُعرض تحت الخانات مباشرة داخل الـ fieldset */
  children?: ReactNode;
}) {
  const legendId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFilledRef = useRef("");
  const [focused, setFocused] = useState(false);
  const digits = sanitizeCode(value).slice(0, CODE_LENGTH);

  useEffect(() => {
    if (autoFocus || focusSignal > 0) inputRef.current?.focus();
  }, [autoFocus, focusSignal]);

  // اكتمال الأرقام الستة ← إرسال تلقائي بعد مهلة قصيرة (يُلغى إن تغيّر الرقم قبلها)
  useEffect(() => {
    if (disabled || digits.length !== CODE_LENGTH || lastFilledRef.current === digits) return;
    const id = window.setTimeout(() => {
      lastFilledRef.current = digits;
      onFilled(digits);
    }, CODE_AUTOSUBMIT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [digits, disabled, onFilled]);

  // تعديل الأرقام بعد خطأ يسمح بإعادة الإرسال التلقائي للقيمة الجديدة
  useEffect(() => {
    if (digits.length < CODE_LENGTH) lastFilledRef.current = "";
  }, [digits]);

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    // maxlength يقتطع اللصق قبل التنظيف (مثل «424 242») — ننظّف النص كاملًا أولًا
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    onChange(sanitizeCode(text).slice(0, CODE_LENGTH));
  }

  const active = focused ? Math.min(digits.length, CODE_LENGTH - 1) : -1;
  const describedBy = (invalid && errorId ? errorId : hintId) || "";

  return (
    <fieldset className="hk-otp" disabled={disabled}>
      <legend id={legendId} className="hk-otp__legend">
        {legend}
      </legend>
      <div
        className="hk-otp__wrap"
        data-invalid={invalid ? "true" : undefined}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="hk-otp__boxes" dir="ltr" aria-hidden>
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span
              key={i}
              className="hk-otp__box"
              data-active={i === active ? "true" : undefined}
              data-filled={digits[i] ? "true" : undefined}
            >
              {digits[i] ?? ""}
              {i === active && !digits[i] ? <span className="hk-otp__caret" /> : null}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          className="hk-otp__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          dir="ltr"
          value={digits}
          aria-labelledby={legendId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => onChange(sanitizeCode(e.target.value).slice(0, CODE_LENGTH))}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {children}
      {/* الشاشة ٦: عند الخطأ تحلّ رسالته محلّ سطر التوضيح */}
      <p id={hintId} className="hk-otp__hint" hidden={invalid}>
        {hint}
      </p>
    </fieldset>
  );
}
