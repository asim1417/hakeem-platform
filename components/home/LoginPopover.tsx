"use client";

import Link from "next/link";

/**
 * أزرار التسجيل/الدخول في الشريط العلوي (الرحّلة العامة من الرئيسية).
 * الصفحة الكاملة: /register و /login.
 */
export function LoginPopover() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="focus-ring inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
      >
        تسجيل الدخول
      </Link>
      <Link
        href="/register"
        className="focus-ring inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        سجّل مجانًا
      </Link>
    </div>
  );
}
