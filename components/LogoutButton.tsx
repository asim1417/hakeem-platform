"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const btnClass =
  "focus-ring mt-3 w-full rounded-md border border-[#C69763]/30 px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[#E8D6BC]/30";

/** تسجيل الخروج عبر Clerk — أو إعادة توجيه إن لم تُضبط المفاتيح. */
export function LogoutButton({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  const router = useRouter();
  if (!clerkEnabled) {
    return (
      <button type="button" onClick={() => router.push("/sign-in")} className={btnClass}>
        تسجيل الخروج
      </button>
    );
  }
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className={btnClass}>
        تسجيل الخروج
      </button>
    </SignOutButton>
  );
}

export function LogoutIconButton({
  label,
  clerkEnabled = true,
}: {
  label: string;
  clerkEnabled?: boolean;
}) {
  const router = useRouter();
  if (!clerkEnabled) {
    return (
      <button
        type="button"
        onClick={() => router.push("/sign-in")}
        className="icon-pill focus-ring"
        aria-label={label}
        title={label}
      >
        <LogOut size={16} aria-hidden />
      </button>
    );
  }
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className="icon-pill focus-ring" aria-label={label} title={label}>
        <LogOut size={16} aria-hidden />
      </button>
    </SignOutButton>
  );
}
