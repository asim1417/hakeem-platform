"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { CODE_LENGTH, fillCodeBoxes } from "@/lib/modules/auth/identifier-flow";

/**
 * خانات رمز التحقق المنفصلة — اللصق يتوزّع على الخانات، وملء الأخيرة يرسل الرمز تلقائيًا.
 * الخانة الأولى تحمل autocomplete="one-time-code" ليقترح iOS/Android الرمز من الرسالة.
 */
export function CodeBoxes({
  value,
  onChange,
  onFilled,
  labelId,
  describedBy,
  invalid = false,
  disabled = false,
  autoFocus = false,
  focusSignal = 0,
  length = CODE_LENGTH,
}: {
  value: string;
  onChange: (next: string) => void;
  /** يُستدعى مرة عند اكتمال الخانات كلها. */
  onFilled: (code: string) => void;
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** يتغيّر الرقم ← التركيز على أول خانة فارغة (بعد خطأ أو إعادة إرسال). */
  focusSignal?: number;
  length?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // الخانة الفارغة تُحفظ مسافة لتبقى المواضع ثابتة؛ sanitizeCode يزيلها عند الإرسال.
  const digits = Array.from({ length }, (_, i) => (value[i] && value[i] !== " " ? value[i] : ""));
  const encode = (arr: string[]) => arr.map((c) => c || " ").join("").replace(/\s+$/, "");

  useEffect(() => {
    if (!autoFocus && focusSignal === 0) return;
    const firstEmpty = digits.findIndex((d) => !d);
    refs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- التركيز عند الإشارة فقط
  }, [autoFocus, focusSignal]);

  function apply(index: number, raw: string) {
    const { digits: next, focus } = fillCodeBoxes(digits, index, raw, length);
    onChange(encode(next));
    refs.current[focus]?.focus();
    if (next.every(Boolean)) onFilled(next.join(""));
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = digits.slice();
      next[index - 1] = "";
      onChange(encode(next));
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function onPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    apply(index, text);
  }

  return (
    <div
      className="hk-code-boxes"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      dir="ltr"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="hk-code-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          dir="ltr"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`الخانة ${i + 1} من ${length}`}
          aria-required="true"
          aria-invalid={invalid || undefined}
          value={d}
          disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            let raw = e.target.value;
            // الكتابة فوق رقم موجود دون تحديده: خذ الجديد فقط
            if (d && raw.length === 2) raw = raw.startsWith(d) ? raw.slice(1) : raw.slice(0, 1);
            apply(i, raw);
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
        />
      ))}
    </div>
  );
}
