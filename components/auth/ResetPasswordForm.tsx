"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useMemo(() => (params.get("token") || "").trim(), [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (!token) {
      setError("رابط الاستعادة ناقص. اطلب رابطًا جديدًا.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر تعيين كلمة المرور.");
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تعيين كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center">
        <p className="font-semibold text-[#0E3435]">رابط الاستعادة غير مكتمل.</p>
        <p className="mt-3 text-sm">
          <Link href="/forgot-password" className="font-semibold text-[#8B6914] underline">
            اطلب رابطًا جديدًا
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <header className="text-center">
        <h2 className="text-[1.35rem] font-semibold text-[#0E3435]">كلمة مرور جديدة</h2>
        <p className="mt-2 text-sm leading-7 text-[rgba(14,52,53,0.68)]">
          اختر كلمة مرور قوية (8 أحرف على الأقل).
        </p>
      </header>

      {done ? (
        <p className="mt-5 text-center text-sm font-semibold text-[#0E3435]" role="status">
          تم التعيين. جارٍ التحويل لتسجيل الدخول…
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3 text-right">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block text-sm font-semibold text-[#0E3435]">
            كلمة المرور الجديدة
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-2.5 text-sm"
              dir="ltr"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-semibold text-[#0E3435]">
            تأكيد كلمة المرور
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full rounded-[0.65rem] border border-[rgba(14,52,53,0.14)] bg-white px-3 py-2.5 text-sm"
              dir="ltr"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[0.75rem] bg-[#0E3435] text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
          </button>
        </form>
      )}
    </div>
  );
}
