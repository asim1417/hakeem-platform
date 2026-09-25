"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** نموذج دخول بالبريد وكلمة المرور + رابط الاستعادة. */
export function EmailPasswordSignIn({ nextUrl = "/dashboard" }: { nextUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dest =
    nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر تسجيل الدخول.");
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3 text-right">
      <div className="flex items-center gap-3 py-1 text-xs text-[rgba(14,52,53,0.45)]" role="separator">
        <span className="h-px flex-1 bg-[rgba(14,52,53,0.12)]" />
        أو بالبريد وكلمة المرور
        <span className="h-px flex-1 bg-[rgba(14,52,53,0.12)]" />
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <label className="block text-sm font-semibold text-[#0E3435]">
        البريد الإلكتروني
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-2.5 text-sm text-[#0E3435]"
          dir="ltr"
        />
      </label>

      <label className="block text-sm font-semibold text-[#0E3435]">
        كلمة المرور
        <div className="mt-1.5 flex gap-2">
          <input
            type={show ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-2.5 text-sm text-[#0E3435]"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="shrink-0 rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] px-3 text-xs font-semibold text-[#0E3435]"
          >
            {show ? "إخفاء" : "إظهار"}
          </button>
        </div>
      </label>

      <div className="flex items-center justify-between gap-2">
        <Link
          href="/forgot-password"
          className="text-xs font-semibold text-[#8B6914] underline-offset-4 hover:underline"
        >
          نسيت كلمة المرور؟
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7] disabled:opacity-60"
        >
          {loading ? "جارٍ الدخول…" : "دخول"}
        </button>
      </div>
    </form>
  );
}
