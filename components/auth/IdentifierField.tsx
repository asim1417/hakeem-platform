"use client";

import { forwardRef, type ReactNode } from "react";
import { toLatinDigits, type IdentifierMethod } from "@/lib/modules/auth/identifier-flow";

/** هل يبدو المُدخل رقم جوال؟ (أرقام وفواصل فقط، بعد تحويل الأرقام العربية) */
export function looksLikePhone(raw: string): boolean {
  const v = toLatinDigits(raw).trim();
  return v.length > 0 && /^[+\d\s\-().]+$/.test(v) && /\d/.test(v);
}

function MailIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

function PhoneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

const METHOD_TEXT: Record<IdentifierMethod, { tab: string; label: string; hint: string }> = {
  phone: { tab: "رقم الجوال", label: "رقم الجوال", hint: "سنرسل رمزًا من ستة أرقام برسالة نصية." },
  email: { tab: "البريد الإلكتروني", label: "البريد الإلكتروني", hint: "سنرسل رمزًا من ستة أرقام إلى بريدك." },
};

/**
 * حقل الدخول برمز في صندوق الرئيسية — المقترح المعتمد (أ): تبويبان «رقم الجوال | البريد الإلكتروني».
 * الجوال افتراضي: بادئة ‎+966 ثابتة، ولوحة أرقام. البريد بضغطة: تسمية ولوحة مفاتيح وسطر توضيح خاصة به.
 * وسيلة واحدة مفعّلة ← الحقل وحده بلا تبويبين.
 * مكوّن عرض فقط بلا Clerk — يشترك فيه الحقل الخفيف والنموذج المضمّن فلا يتغيّر الشكل عند التبديل.
 */
export const IdentifierField = forwardRef<
  HTMLInputElement,
  {
    method: IdentifierMethod;
    /** الوسائل المفعّلة بترتيب العرض (الجوال أولًا) */
    methods: readonly IdentifierMethod[];
    onMethodChange: (m: IdentifierMethod) => void;
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
>(function IdentifierField(
  { method, methods, onMethodChange, value, onChange, onFocus, disabled, invalid, errorId, error, badge },
  ref
) {
  const text = METHOD_TEXT[method];
  const hintId = "hakeem-identifier-hint";
  const describedBy = [invalid && errorId ? errorId : "", hintId].filter(Boolean).join(" ");
  const phone = method === "phone";
  return (
    <div className="hk-idf">
      {badge}
      {methods.length > 1 ? (
        <div className="hk-idf__tabs" aria-label="وسيلة الدخول برمز">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              className="hk-idf__tab"
              aria-pressed={m === method}
              onClick={() => onMethodChange(m)}
              disabled={disabled}
            >
              {m === "phone" ? <PhoneIcon size={18} /> : <MailIcon size={18} />}
              <span>{METHOD_TEXT[m].tab}</span>
            </button>
          ))}
        </div>
      ) : null}
      <label htmlFor="hakeem-identifier" className="hk-idf__label">
        {text.label}
      </label>
      <div className="hk-idf__box" data-invalid={invalid ? "true" : undefined} data-method={method} dir="ltr">
        {phone ? (
          <span className="hk-idf__prefix" aria-hidden>
            +966
          </span>
        ) : (
          <span className="hk-idf__icon">
            <MailIcon />
          </span>
        )}
        <input
          ref={ref}
          id="hakeem-identifier"
          className="hk-idf__input"
          dir="ltr"
          type={phone ? "tel" : "email"}
          inputMode={phone ? "numeric" : "email"}
          autoComplete={phone ? "tel-national" : "email"}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={phone ? "5X XXX XXXX" : "name@example.com"}
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
      <span id={hintId} className="hk-idf__hint">
        {text.hint}
      </span>
    </div>
  );
});

/** نص زر الإرسال في الصندوق — «أرسل الرمز» للوسيلتين. */
export function identifierSubmitLabel(): string {
  return "أرسل الرمز";
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
