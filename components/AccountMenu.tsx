"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound, Wallet } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";

async function clearOwnerSession() {
  await fetch("/api/auth/owner-logout", { method: "POST" }).catch(() => undefined);
}

const AFTER_LOGOUT = "/";

type AccountMenuProps = {
  name: string;
  roleLabel: string;
  initials: string;
  billingLabel: string;
  clerkEnabled?: boolean;
};

/**
 * قائمة حساب موحّدة في الشريط العلوي — بديل أيقونة الخروج المستقلة.
 * أبعاد الزر ثابتة قبل/بعد تركيب Clerk لتفادي الومض.
 */
export function AccountMenu({
  name,
  roleLabel,
  initials,
  billingLabel,
  clerkEnabled = true,
}: AccountMenuProps) {
  const router = useRouter();
  const clerkMounted = useClerkMounted();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logoutPlain() {
    setOpen(false);
    await clearOwnerSession();
    router.push(AFTER_LOGOUT);
    router.refresh();
  }

  const logoutInner = (
    <>
      <LogOut size={18} aria-hidden className="shrink-0" />
      <span>تسجيل الخروج</span>
    </>
  );

  const logoutClass =
    "account-menu__item account-menu__item--danger touch-target";

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        className="account-menu__trigger touch-target"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-menu__avatar" aria-hidden>
          {initials}
        </span>
        <span className="account-menu__meta">
          <span className="account-menu__name">{name}</span>
          <span className="account-menu__role">{roleLabel}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`account-menu__chev ${open ? "account-menu__chev--open" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="account-menu__panel"
        >
          <div className="account-menu__header" role="presentation">
            <p className="account-menu__header-name">{name}</p>
            <p className="account-menu__header-role">{roleLabel}</p>
          </div>

          <Link
            href="/onboarding"
            role="menuitem"
            className="account-menu__item touch-target"
            onClick={() => setOpen(false)}
          >
            <UserRound size={18} aria-hidden className="shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold">ملفي المهني</span>
              <span className="block text-[11px] font-normal text-[rgba(14,52,53,0.55)]">
                بياناتك المهنية وتفضيلات تجربتك في حكيم
              </span>
            </span>
          </Link>

          <Link
            href="/dashboard/billing"
            role="menuitem"
            className="account-menu__item touch-target"
            onClick={() => setOpen(false)}
          >
            <Wallet size={18} aria-hidden className="shrink-0" />
            <span>{billingLabel}</span>
          </Link>

          <div className="account-menu__sep" role="separator" />

          {!clerkEnabled || !clerkMounted ? (
            <button
              type="button"
              role="menuitem"
              className={logoutClass}
              onClick={() => void logoutPlain()}
            >
              {logoutInner}
            </button>
          ) : (
            <SignOutButton redirectUrl={AFTER_LOGOUT}>
              <button
                type="button"
                role="menuitem"
                className={logoutClass}
                onClick={() => {
                  setOpen(false);
                  void clearOwnerSession();
                }}
              >
                {logoutInner}
              </button>
            </SignOutButton>
          )}
        </div>
      ) : null}
    </div>
  );
}
