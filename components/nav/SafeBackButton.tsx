"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import {
  isSafeInternalPath,
  resolveReturnPath,
} from "@/lib/modules/nav/safe-return";
import { isResponsiveUxV2Enabled } from "@/lib/modules/config/responsive-ux";

/**
 * زر رجوع موحّد: returnUrl آمن → history.back إن وُجد سجل → أب منطقي → اللوحة.
 */
export function SafeBackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  if (!isResponsiveUxV2Enabled()) return null;
  if (pathname === "/dashboard") return null;

  function goBack() {
    if (isSafeInternalPath(returnUrl)) {
      router.push(returnUrl);
      return;
    }
    if (typeof window !== "undefined") {
      const ref = document.referrer || "";
      const sameOrigin = ref.startsWith(window.location.origin);
      if (sameOrigin && window.history.length > 1) {
        router.back();
        return;
      }
    }
    router.push(resolveReturnPath(pathname, null));
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`touch-target inline-flex items-center justify-center gap-1 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-[var(--paper)] px-2.5 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--cream)] ${className}`}
      aria-label="الرجوع للصفحة السابقة"
      title="رجوع"
    >
      <ArrowRight size={20} aria-hidden className="shrink-0" />
      <span className="hidden sm:inline">رجوع</span>
    </button>
  );
}

/** رابط سريع للصفحة الرئيسية — يظهر بجانب مسار التنقّل على الجوال. */
export function DashboardHomeLink() {
  const pathname = usePathname() || "/dashboard";
  if (!isResponsiveUxV2Enabled()) return null;
  if (pathname === "/dashboard") return null;

  return (
    <Link
      href="/dashboard"
      className="touch-target inline-flex items-center justify-center gap-1 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-[var(--paper)] px-2.5 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--cream)]"
      aria-label="الصفحة الرئيسية"
      title="الصفحة الرئيسية"
    >
      <LayoutDashboard size={20} aria-hidden className="shrink-0" />
      <span className="hidden md:inline">الرئيسية</span>
    </Link>
  );
}
