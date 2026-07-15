"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert, LegalCard } from "@/components/ui/legal";

export function LoginForm({ nextUrl = "/dashboard", googleEnabled = false }: { nextUrl?: string; googleEnabled?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تسجيل الدخول.");
      router.push(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LegalCard eyebrow="حكيم" title="تسجيل الدخول">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">البريد الإلكتروني</span>
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3 text-left"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">كلمة المرور</span>
          <input
            dir="ltr"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3 text-left"
          />
        </label>
        <GoldButton type="button" onClick={() => void login()} disabled={loading || !email || !password} className="w-full">
          {loading ? "جار التحقق..." : "دخول إلى منصة حكيم"}
        </GoldButton>
        {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

        {googleEnabled ? (
          <>
            <div className="flex items-center gap-3 py-1 text-xs text-[#0B1F3A]/50">
              <span className="h-px flex-1 bg-[#C09B5A]/25" />
              أو
              <span className="h-px flex-1 bg-[#C09B5A]/25" />
            </div>
            <a
              href={`/api/auth/google?next=${encodeURIComponent(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/dashboard")}`}
              className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-[#C09B5A]/35 bg-white px-4 py-3 font-semibold text-[var(--navy)] transition hover:bg-[var(--parchment)]"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              الدخول عبر Google
            </a>
          </>
        ) : null}
      </div>
    </LegalCard>
  );
}
