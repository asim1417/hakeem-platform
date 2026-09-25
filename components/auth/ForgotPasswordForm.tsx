"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDevUrl("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر إرسال الطلب.");
      setDone(true);
      setMessage(data.message || "تم استلام الطلب.");
      if (typeof data.resetUrl === "string") setDevUrl(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <header className="text-center">
        <h2 className="text-[1.35rem] font-semibold leading-8 text-[#0E3435]">استعادة كلمة المرور</h2>
        <p className="mt-2 text-[0.95rem] leading-7 text-[rgba(14,52,53,0.68)]">
          أدخل بريد حسابك. إن كان الدخول بكلمة مرور محلية، نرسل رابط إعادة التعيين.
        </p>
      </header>

      <div className="mt-4 rounded-[0.5rem] border border-[rgba(14,52,53,0.1)] bg-white/80 px-3 py-3 text-xs leading-6 text-[rgba(14,52,53,0.7)]">
        إن كنت تدخل عبر <strong>Google</strong> أو <strong>Apple</strong> فاستعادة الحساب تتم من
        إعدادات ذلك المزود، وليس من هنا.
      </div>

      {done ? (
        <div className="mt-5 space-y-3 text-sm leading-7 text-[#0E3435]" role="status">
          <p className="font-semibold">{message}</p>
          {devUrl ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs" dir="ltr">
              وضع تطوير (بدون بريد):{" "}
              <a href={devUrl} className="font-semibold underline">
                فتح رابط الاستعادة
              </a>
            </p>
          ) : null}
          <p>
            <Link href="/sign-in" className="font-semibold text-[#8B6914] underline-offset-4 hover:underline">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3 text-right">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block text-sm font-semibold text-[#0E3435]">
            البريد الإلكتروني
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-2.5 text-sm"
              dir="ltr"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[0.75rem] bg-[#0E3435] text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}
          </button>
          <p className="text-center text-sm">
            <Link href="/sign-in" className="font-semibold text-[rgba(14,52,53,0.65)] hover:text-[#0E3435]">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
