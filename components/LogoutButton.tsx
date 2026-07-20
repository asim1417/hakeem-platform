"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const btnClass =
  "focus-ring mt-3 w-full rounded-md border border-[#C69763]/30 px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[#E8D6BC]/30";

async function clearOwnerSession() {
  await fetch("/api/auth/owner-logout", { method: "POST" }).catch(() => undefined);
}

/** تسجيل الخروج: Clerk و/أو جلسة المالك الطارئة. */
export function LogoutButton({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  const router = useRouter();

  async function logoutOwner() {
    await clearOwnerSession();
    router.push("/sign-in");
    router.refresh();
  }

  if (!clerkEnabled) {
    return (
      <button type="button" onClick={() => void logoutOwner()} className={btnClass}>
        تسجيل الخروج
      </button>
    );
  }
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className={btnClass}
        onClick={() => {
          void clearOwnerSession();
        }}
      >
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

  async function logoutOwner() {
    await clearOwnerSession();
    router.push("/sign-in");
    router.refresh();
  }

  if (!clerkEnabled) {
    return (
      <button
        type="button"
        onClick={() => void logoutOwner()}
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
      <button
        type="button"
        className="icon-pill focus-ring"
        aria-label={label}
        title={label}
        onClick={() => {
          void clearOwnerSession();
        }}
      >
        <LogOut size={16} aria-hidden />
      </button>
    </SignOutButton>
  );
}

