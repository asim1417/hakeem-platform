"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert } from "@/components/ui/legal";

type Providers = { google: boolean; microsoft: boolean; password: boolean };

export function LoginForm({
  nextUrl = "/dashboard",
  googleEnabled,
  microsoftEnabled,
  compact = false,
}: {
  nextUrl?: string;
  googleEnabled?: boolean;
  microsoftEnabled?: boolean;
  /** وضع مضغوط للـ Popover */
  compact?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<Providers>({
    google: Boolean(googleEnabled),
    microsoft: Boolean(microsoftEnabled),
    password: true,
  });

  useEffect(() => {
    if (googleEnabled !== undefined && microsoftEnabled !== undefined) return;
    let active = true;
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Providers | null) => {
        if (!active || !data) return;
        setProviders({
          google: googleEnabled ?? Boolean(data.google),
          microsoft: microsoftEnabled ?? Boolean(data.microsoft),
          password: data.password !== false,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [googleEnabled, microsoftEnabled]);

  const dest = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard";
  const hasSso = providers.google || providers.microsoft;

  async function login(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تسجيل الدخول.");
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {hasSso ? (
        <div className="space-y-3">
          {providers.microsoft ? (
            <a
              href={`/api/auth/microsoft?next=${encodeURIComponent(dest)}`}
              className="login-sso-btn login-sso-microsoft focus-ring"
            >
              <MicrosoftIcon />
              <span>الدخول عبر بوابة Microsoft</span>
            </a>
          ) : null}
          {providers.google ? (
            <a
              href={`/api/auth/google?next=${encodeURIComponent(dest)}`}
              className="login-sso-btn login-sso-google focus-ring"
            >
              <GoogleIcon />
              <span>الدخول عبر Google</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {hasSso ? (
        <div className="flex items-center gap-3 py-1 text-xs text-[var(--ink-40)]" role="separator">
          <span className="h-px flex-1 bg-[var(--gold-border)]" />
          أو بالبريد وكلمة المرور
          <span className="h-px flex-1 bg-[var(--gold-border)]" />
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={(e) => void login(e)} noValidate>
        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">البريد الإلكتروني</span>
          <input
            dir="ltr"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 text-left text-[var(--ink)] placeholder:text-[var(--ink-20)]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">كلمة المرور</span>
          <div className="relative mt-2">
            <input
              dir="ltr"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="focus-ring w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 pe-16 text-left text-[var(--ink)] placeholder:text-[var(--ink-20)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="focus-ring absolute inset-y-0 left-2 my-auto h-8 rounded px-2 text-xs font-semibold text-[var(--ink-60)] hover:text-[var(--navy)]"
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </label>
        <GoldButton type="submit" disabled={loading || !email || !password} className="w-full">
          {loading ? "جارٍ التحقق..." : "دخول إلى منصة حكيم"}
        </GoldButton>
      </form>

      {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
