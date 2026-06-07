"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert, LegalCard } from "@/components/ui/legal";

export function LoginForm({ nextUrl = "/dashboard" }: { nextUrl?: string }) {
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
          <span className="text-sm font-semibold text-[#0B1F3A]">البريد الإلكتروني</span>
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3 text-left"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#0B1F3A]">كلمة المرور</span>
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
      </div>
    </LegalCard>
  );
}
