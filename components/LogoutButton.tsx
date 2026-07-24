"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";

async function clearOwnerSession() {
  await fetch("/api/auth/owner-logout", { method: "POST" }).catch(() => undefined);
}

/** أبعاد ثابتة قبل/بعد تركيب Clerk — يمنع تبدّل الحجم في السايدبار. */
const textBtnClass =
  "focus-ring mt-3 flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#C69763]/30 px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[#E8D6BC]/30";

const AFTER_LOGOUT = "/";

/** تسجيل الخروج النصّي (السايدبار) — يعود للصفحة الرئيسية العامة. */
export function LogoutButton({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  const router = useRouter();
  const clerkMounted = useClerkMounted();

  async function logoutPlain() {
    await clearOwnerSession();
    router.push(AFTER_LOGOUT);
    router.refresh();
  }

  if (!clerkEnabled || !clerkMounted) {
    return (
      <button type="button" onClick={() => void logoutPlain()} className={textBtnClass}>
        تسجيل الخروج
      </button>
    );
  }

  return (
    <SignOutButton redirectUrl={AFTER_LOGOUT}>
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
  const clerkMounted = useClerkMounted();

  async function logoutPlain() {
    await clearOwnerSession();
    router.push(AFTER_LOGOUT);
    router.refresh();
  }

  if (!clerkEnabled || !clerkMounted) {
    return (
      <button
        type="button"
        onClick={() => void logoutPlain()}
        className="icon-pill focus-ring"
        aria-label={label}
        title={label}
      >
        <LogOut size={20} aria-hidden />
      </button>
    );
  }

  return (
    <SignOutButton redirectUrl={AFTER_LOGOUT}>
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
