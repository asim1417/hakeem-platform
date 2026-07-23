"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpWithNext } from "@/lib/modules/auth/safe-next";

type AuthState = "loading" | "guest" | "user";

const FEATURES = [
  { title: "اسأل حكيم", desc: "تحليل واقعة واقتراح أساس نظامي", path: "/dashboard/ask" },
  { title: "المعاون القضائي", desc: "مساحة قضية وتحليل متكامل", path: "/dashboard/judicial-assistant" },
  { title: "محاكاة قضائية", desc: "تدريب على تفكير القاضي", path: "/dashboard/simulations" },
] as const;

/**
 * الصفحة الرئيسية — بوابة دخول واضحة:
 * زر أساسي واحد للتسجيل + دخول ثانوي، بلا تكرار FAB/أيقونات.
 */
export function HomeHero() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user && !data.isGuest) {
          setAuth("user");
        } else {
          setAuth("guest");
        }
      })
      .catch(() => {
        if (active) setAuth("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  function goProtected(path: string) {
    if (auth === "user") {
      router.push(path);
      return;
    }
    router.push(signUpWithNext(path));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--hakeem-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-[0.07]"
        style={{
          background:
            "radial-gradient(55% 90% at 50% 0%, var(--navy) 0%, transparent 70%), radial-gradient(35% 70% at 85% 10%, var(--gold) 0%, transparent 65%)",
        }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-xl font-bold text-[var(--gold-bright)]">
            ح
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold text-[var(--navy)]">حكيم</p>
            <p className="text-[11px] text-[var(--ink-60)]">منصة المعرفة القضائية</p>
          </div>
        </div>

        {auth === "user" ? (
          <Link
            href="/dashboard"
            className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            لوحة التحكم
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/sign-up"
              className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              سجّل مجانًا
            </Link>
          </div>
        )}
      </header>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[7vh] pb-16 text-center">
        <p className="mb-4 font-judicial text-sm font-semibold text-[var(--gold-dark)]">حكيم</p>
        <h1 className="font-judicial text-4xl font-bold leading-tight text-[var(--navy)] md:text-6xl">
          رفيق المحامي في القاعة
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--ink-60)] md:text-lg">
          حلّل الوقائع، اقترح الدفوع، وتابع أعمالك القانونية من مكان واحد — بمصدر نظامي موثّق.
        </p>

        {auth !== "user" ? (
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white shadow-[var(--sh-sm)] transition hover:bg-[var(--navy-mid)]"
            >
              ابدأ مجانًا
            </Link>
            <Link
              href="/sign-in"
              className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]"
            >
              لدي حساب — دخول
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white"
            >
              المتابعة إلى المنصة
            </Link>
            <Link
              href="/dashboard/ask"
              className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)]"
            >
              اسأل حكيم
            </Link>
          </div>
        )}

        <p className="mt-4 text-sm text-[var(--ink-40)]">
          {auth === "user"
            ? "أنت داخل جلسة نشطة — يمكنك استخدام المنصة الآن."
            : "الدخول عبر Google أو Apple — بلا تعقيد، وبياناتك محمية."}
        </p>

        <ul className="mt-12 grid w-full gap-3 text-right sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <button
                type="button"
                onClick={() => goProtected(f.path)}
                className="focus-ring w-full rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/90 px-4 py-4 text-start transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-xs)]"
              >
                <p className="font-semibold text-[var(--navy)]">{f.title}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{f.desc}</p>
                {auth !== "user" ? (
                  <p className="mt-2 text-[11px] font-semibold text-[var(--gold-dark)]">
                    سجّل للمتابعة ←
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-12 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
          تنبيه مهني: مخرجات الذكاء الاصطناعي في حكيم مساعدة وتعليمية ولا تُعدّ رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.
        </p>
      </section>
    </main>
  );
}
