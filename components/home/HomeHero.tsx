"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginPopover } from "@/components/home/LoginPopover";

type Mode = "search" | "ask";

const QUICK_LINKS = [
  { href: "/dashboard/legal-core/search", label: "المكتبة النظامية" },
  { href: "/dashboard/consultations", label: "الاستشارات" },
  { href: "/dashboard/simulations", label: "القاضي التفاعلي" },
  { href: "/dashboard/training", label: "التدريب" }
];

const SUGGESTIONS = ["نظام العمل", "المادة 77", "إخلاء عقاري", "نظام المعاملات المدنية", "فسخ عقد"];

export function HomeHero() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [value, setValue] = useState("");

  function submit(query?: string) {
    const q = (query ?? value).trim();
    const encoded = encodeURIComponent(q);
    if (mode === "search") {
      router.push(q ? `/dashboard/legal-core/search?q=${encoded}` : "/dashboard/legal-core/search");
    } else {
      router.push(q ? `/dashboard/consultations?facts=${encoded}` : "/dashboard/consultations");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--hakeem-bg)]">
      {/* وهج كحلي-ذهبي خفيف أعلى الصفحة */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.06]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, var(--navy) 0%, transparent 70%), radial-gradient(40% 80% at 80% 0%, var(--gold) 0%, transparent 70%)"
        }}
      />

      {/* شريط علوي */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-xl font-bold text-[var(--gold-bright)]">
            ح
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold text-[var(--navy)]">حكيم</p>
            <p className="text-[11px] text-[var(--ink-60)]">منصة قانونية ذكية</p>
          </div>
        </div>
        <LoginPopover />
      </header>

      {/* البطل: البحث أولاً */}
      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[8vh] text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--hakeem-bg-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--gold-dark,#9a7636)]">
          المصدر القانوني الموثّق · بحث ذكي
        </p>
        <h1 className="font-judicial text-4xl font-bold leading-tight text-[var(--navy)] md:text-6xl">
          ابحث في الأنظمة السعودية
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--ink-60)] md:text-lg">
          ابحث في المواد والأنظمة والأحكام، أو اطرح واقعتك ليساعدك حكيم في تحديد الأساس النظامي — بمصدرٍ موثّق.
        </p>

        {/* مبدّل ابحث / اسأل حكيم */}
        <div className="mt-8 inline-flex rounded-full border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-1">
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`focus-ring rounded-full px-6 py-2 text-sm font-semibold transition ${
              mode === "search" ? "bg-[var(--navy)] text-white shadow-[var(--sh-sm)]" : "text-[var(--ink-60)] hover:text-[var(--navy)]"
            }`}
          >
            ابحث
          </button>
          <button
            type="button"
            onClick={() => setMode("ask")}
            className={`focus-ring rounded-full px-6 py-2 text-sm font-semibold transition ${
              mode === "ask" ? "bg-[var(--navy)] text-white shadow-[var(--sh-sm)]" : "text-[var(--ink-60)] hover:text-[var(--navy)]"
            }`}
          >
            اسأل حكيم
          </button>
        </div>

        {/* صندوق البحث */}
        <form
          className="mt-4 w-full"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2 rounded-[var(--r-xl)] border border-[var(--ink-15)] bg-white p-2 shadow-[var(--sh-md)] transition focus-within:border-[var(--gold)]">
            <span aria-hidden className="ms-2 text-xl text-[var(--ink-40)]">
              ⌕
            </span>
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-label={mode === "search" ? "بحث قانوني" : "اسأل حكيم"}
              placeholder="اكتب رقم مادة، اسم نظام، رقم قضية، أو وصف واقعة..."
              className="h-12 w-full border-0 bg-transparent px-1 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
            />
            <button
              type="submit"
              className="focus-ring shrink-0 rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)]"
            >
              {mode === "search" ? "ابحث" : "اسأل"}
            </button>
          </div>
        </form>

        {/* اقتراحات سريعة */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-[var(--ink-40)]">مقترحات:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setValue(s);
                submit(s);
              }}
              className="focus-ring rounded-full border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] px-3 py-1 text-xs text-[var(--ink-60)] transition hover:border-[var(--gold-border)] hover:text-[var(--navy)]"
            >
              {s}
            </button>
          ))}
        </div>

        {/* روابط سريعة للخدمات */}
        <nav className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring rounded-full border border-[var(--ink-08)] bg-white px-4 py-2 text-sm text-[var(--navy)] transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-xs)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="mx-auto mt-12 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
          تنبيه مهني: مخرجات الذكاء الاصطناعي في حكيم مساعدة وتعليمية ولا تُعدّ رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.
        </p>
      </section>

      <div className="h-16" />
    </main>
  );
}
