"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * نموذج دخول داخلي للمالك — يُعرض فقط على المسار الداخلي عند تفعيل العلم.
 * لا يُدرَج في القوائم العامة ولا يعرض معلومات تقنية عن بيئة التشغيل.
 */
export function OwnerEmergencyLogin({
  nextUrl = "/dashboard",
}: {
  nextUrl?: string;
}) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim().length > 3 && password.length >= 8 && !loading;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر إكمال الدخول. حاول مرة أخرى.");
      const dest = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard";
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إكمال الدخول. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5 shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <div>
        <h2 className="text-lg font-bold text-[#0E3435]">دخول داخلي</h2>
        <p className="mt-1 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
          مسار مخصّص لمالك المنصة فقط. غير متاح للعامة.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor={emailId} className="block text-sm font-semibold text-[#0E3435]">
            البريد الإلكتروني
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="focus-ring mt-1 w-full rounded-[0.75rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-3 text-left text-[16px] text-[#0E3435] disabled:opacity-60"
            style={{ minHeight: 48 }}
          />
        </div>
        <div>
          <label htmlFor={passwordId} className="block text-sm font-semibold text-[#0E3435]">
            كلمة المرور
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="focus-ring mt-1 w-full rounded-[0.75rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-3 text-left text-[16px] text-[#0E3435] disabled:opacity-60"
            style={{ minHeight: 48 }}
          />
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-sm leading-6 text-[#B42318]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={loading}
          className="flex w-full items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-4 text-[0.95rem] font-semibold text-[#FFFcf7] transition hover:bg-[#164849] active:bg-[#0A2829] disabled:cursor-not-allowed disabled:opacity-55"
          style={{ minHeight: 48 }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
              جارٍ المتابعة…
            </span>
          ) : (
            "متابعة"
          )}
        </button>
      </form>
    </div>
  );
}
