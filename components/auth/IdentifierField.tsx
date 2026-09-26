"use client";

import { forwardRef, type ReactNode } from "react";
import { toLatinDigits } from "@/lib/modules/auth/identifier-flow";

/** هل يبدو المُدخل رقم جوال؟ (أرقام وفواصل فقط، بعد تحويل الأرقام العربية) */
export function looksLikePhone(raw: string): boolean {
  const v = toLatinDigits(raw).trim();
  return v.length > 0 && /^[+\d\s\-().]+$/.test(v) && /\d/.test(v);
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E3435" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E3435" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

/**
 * حقل «البريد الإلكتروني أو رقم الجوال» في صندوق الدخول (الشاشتان ١ و٢).
 * أيقونة البريد تتحول إلى الجوال حين يكتب المستخدم رقمًا، مع سطر توضيح الرسالة النصية.
 * مكوّن عرض فقط بلا Clerk — يشترك فيه الحقل الخفيف والنموذج المضمّن فلا يتغيّر الشكل عند التبديل.
 */
export const IdentifierField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onFocus?: () => void;
    disabled?: boolean;
    invalid?: boolean;
    errorId?: string;
    /** رسالة الخطأ تحت الحقل */
    error?: ReactNode;
    badge?: ReactNode;
  }
>(function IdentifierField({ value, onChange, onFocus, disabled, invalid, errorId, error, badge }, ref) {
  const phone = looksLikePhone(value);
  const hintId = "hakeem-identifier-hint";
  const describedBy = [invalid && errorId ? errorId : "", phone ? hintId : ""].filter(Boolean).join(" ");
  return (
    <div className="hk-idf">
      {badge}
      <label htmlFor="hakeem-identifier" className="hk-idf__label">
        البريد الإلكتروني أو رقم الجوال
      </label>
      <div className="hk-idf__box" data-invalid={invalid ? "true" : undefined}>
        {phone ? <PhoneIcon /> : <MailIcon />}
        <input
          ref={ref}
          id="hakeem-identifier"
          className="hk-idf__input"
          dir="ltr"
          type="text"
          inputMode={phone ? "tel" : "email"}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com · 05xxxxxxxx"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          disabled={disabled}
          required
          aria-required="true"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
        />
      </div>
      {error}
      {phone ? (
        <span id={hintId} className="hk-idf__hint">
          رقم جوال سعودي. سنرسل إليه رمزًا من ستة أرقام برسالة نصية.
        </span>
      ) : null}
    </div>
  );
});

/** نص زر الإرسال: «أرسل الرمز» للجوال، و«متابعة» لغيره (الشاشتان ١ و٢). */
export function identifierSubmitLabel(value: string): string {
  return looksLikePhone(value) ? "أرسل الرمز" : "متابعة";
}

export function ErrorNote({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} role="alert" className="hk-err">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
