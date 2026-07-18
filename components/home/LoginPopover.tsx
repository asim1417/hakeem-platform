"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

/**
 * تسجيل الدخول كـ Popover على سطح المكتب و BottomSheet على الجوال.
 * صفحة /login منشورة دائمًا ومتاحة من هنا.
 */
export function LoginPopover() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "guest" | "user">("loading");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null, isGuest: true }))
      .then((data) => {
        if (!active) return;
        // زائر التطوير أو بلا جلسة حقيقية → نظهر خيارات الدخول.
        if (!data?.user || data.isGuest || data.authDisabled) {
          setState("guest");
        } else {
          setState("user");
        }
      })
      .catch(() => {
        if (active) setState("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (state === "user") {
    return (
      <Link
        href="/dashboard"
        className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-ivory px-5 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-[var(--sh-xs)] transition hover:border-[var(--gold)] hover:shadow-[var(--sh-sm)]"
      >
        الدخول إلى المنصة
      </Link>
    );
  }

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      <Link
        href="/login"
        className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--navy)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--sh-xs)] transition hover:bg-[var(--navy-mid)]"
      >
        تسجيل الدخول
      </Link>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-ring hidden items-center gap-2 rounded-full border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-[var(--sh-xs)] transition hover:border-[var(--gold)] sm:inline-flex"
      >
        سريع
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--navy)]/40 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="تسجيل الدخول إلى حكيم"
            className={[
              "z-50",
              "md:absolute md:left-0 md:mt-3 md:w-[360px] md:rounded-[var(--r-xl)] md:border md:border-[var(--gold-border)] md:bg-ivory md:p-4 md:shadow-[var(--sh-lg)]",
              "fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[var(--r-2xl)] border-t border-[var(--gold-border)] bg-ivory p-4 pb-7 shadow-[var(--sh-lg)] md:inset-auto md:bottom-auto md:max-h-none md:rounded-t-[var(--r-xl)] md:pb-4",
            ].join(" ")}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--ink-15)] md:hidden" aria-hidden />
            <LoginForm nextUrl="/dashboard" compact />
            <Link
              href="/login"
              className="focus-ring mt-3 block rounded-md px-2 py-1 text-center text-xs text-[var(--ink-60)] underline-offset-4 hover:text-[var(--navy)] hover:underline"
            >
              فتح صفحة الدخول الكاملة
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
