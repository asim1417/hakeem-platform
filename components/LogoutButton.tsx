"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

async function clearOwnerSession() {
  await fetch("/api/auth/owner-logout", { method: "POST" }).catch(() => undefined);
}

const textBtnClass =
  "focus-ring mt-3 w-full rounded-md border border-[#C69763]/30 px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[#E8D6BC]/30";

/** تسجيل الخروج النصّي (السايدبار). */
export function LogoutButton({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  const router = useRouter();

  async function logoutOwner() {
    await clearOwnerSession();
    router.push("/sign-in");
    router.refresh();
  }

  if (!clerkEnabled) {
    return (
      <button type="button" onClick={() => void logoutOwner()} className={textBtnClass}>
        تسجيل الخروج
      </button>
    );
  }

  return (
    <SignOutButton redirectUrl="/sign-in">
      <button
        type="button"
        className={textBtnClass}
        onClick={() => {
          void clearOwnerSession();
        }}
      >
        تسجيل الخروج
      </button>
    </SignOutButton>
  );
}

/** أيقونة خروج في الشريط العلوي. */
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
        <LogOut size={20} aria-hidden />
      </button>
    );
  }

  return (
    <SignOutButton redirectUrl="/sign-in">
      <button
        type="button"
        className="icon-pill focus-ring"
        aria-label={label}
        title={label}
        onClick={() => {
          void clearOwnerSession();
        }}
      >
        <LogOut size={20} aria-hidden />
      </button>
    </SignOutButton>
  );
}

/** شريط هوية علوي: الاسم + تسجيل الخروج. */
export function TopbarUserBar({
  name,
  logoutLabel,
  clerkEnabled = true,
}: {
  name: string;
  logoutLabel: string;
  clerkEnabled?: boolean;
}) {
  return (
    <div className="topbar-user" aria-label="حساب المستخدم">
      <span className="topbar-user__name" title={name}>
        {name}
      </span>
      <LogoutIconButton label={logoutLabel} clerkEnabled={clerkEnabled} />
    </div>
  );
}
