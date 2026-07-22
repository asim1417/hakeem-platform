"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert } from "@/components/ui/legal";

const OWNER_EMAIL = "aasemalfarsi@gmail.com";

/** دخول طوارئ للمالك — احتياطي حتى مع تفعيل Clerk. */
export function OwnerEmergencyLogin({
  nextUrl = "/dashboard",
  clerkEnabled = false,
}: {
  nextUrl?: string;
  clerkEnabled?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("Qalam-1703!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!clerkEnabled);

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الدخول.");
      router.push(nextUrl.startsWith("/") ? nextUrl : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">دخول المالك (طوارئ)</p>
          <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">
            {clerkEnabled
              ? "Clerk مفعّل أعلاه. هذا الخيار احتياطي لبريد المالك فقط."
              : "يعمل الآن بلا Clerk. بعد ضبط المفاتيح سيظهر نموذج Clerk أعلاه."}
          </p>
        </div>
        {clerkEnabled ? (
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-[var(--navy)] underline-offset-4 hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "إخفاء" : "إظهار"}
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--navy)]">بريد المالك</span>
              <input
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-3 py-2 text-left text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--navy)]">كلمة المرور</span>
              <input
                dir="ltr"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-3 py-2 text-left text-sm"
              />
            </label>
            <GoldButton type="submit" disabled={loading} className="w-full">
              {loading ? "جارٍ الدخول..." : "دخول كمالك"}
            </GoldButton>
          </form>
          {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}
          <p className="text-[11px] leading-6 text-[var(--ink-40)]" dir="ltr">
            {OWNER_EMAIL} · Qalam-1703!
          </p>
        </>
      ) : null}
    </div>
  );
}
