"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert, NavyButton } from "@/components/ui/legal";
import { generateEasyPassword, generateUsername } from "@/lib/modules/auth/credentials";

const ENTITIES = [
  { value: "INDIVIDUAL", label: "محامٍ فرد / متدرب" },
  { value: "LAW_FIRM", label: "مكتب محاماة" },
  { value: "OTHER", label: "أخرى" },
] as const;

export function RegisterForm({ nextUrl = "/dashboard" }: { nextUrl?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [entityType, setEntityType] = useState<(typeof ENTITIES)[number]["value"]>("INDIVIDUAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const dest = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard";

  function fillGenerated() {
    const u = generateUsername(name || undefined);
    const p = generateEasyPassword();
    setUsername(u);
    setPassword(p);
    if (!email.trim()) setEmail(`${u}@hakeem.local`);
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          username: username || undefined,
          password,
          entityType,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "تعذّر التسجيل.");
      router.push(`${dest}${dest.includes("?") ? "&" : "?"}welcome=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التسجيل.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-3 text-sm leading-7 text-[var(--navy)]">
        بعد التسجيل تبدأ <strong>تجربة مجانية</strong> داخل المنصة مباشرة — بلا بطاقة دفع.
      </div>

      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">الاسم الكامل</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: أحمد العتيبي"
            className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">نوع الحساب</span>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as typeof entityType)}
            className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
          >
            {ENTITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">اسم المستخدم</span>
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="اختياري — يُولَّد تلقائيًا"
            className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 text-left"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">البريد الإلكتروني</span>
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 text-left"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--navy)]">كلمة المرور</span>
          <div className="relative mt-2">
            <input
              dir="ltr"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="٨ أحرف على الأقل"
              className="focus-ring w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 pe-16 text-left"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="focus-ring absolute inset-y-0 left-2 my-auto h-8 rounded px-2 text-xs font-semibold text-[var(--ink-60)]"
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          <NavyButton type="button" onClick={fillGenerated} className="px-4 py-2 text-sm">
            توليد اسم مستخدم + كلمة مرور سهلة
          </NavyButton>
          <GoldButton type="submit" disabled={loading || name.trim().length < 2 || password.length < 8} className="flex-1">
            {loading ? "جارٍ إنشاء الحساب..." : "سجّل وابدأ التجربة المجانية"}
          </GoldButton>
        </div>
      </form>

      {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

      <p className="text-center text-sm text-[var(--ink-60)]">
        لديك حساب؟{" "}
        <Link href={`/login?next=${encodeURIComponent(dest)}`} className="font-semibold text-[var(--navy)] underline underline-offset-4">
          تسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
