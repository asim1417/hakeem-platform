"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

function useLogout() {
  const router = useRouter();
  return async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };
}

export function LogoutButton() {
  const logout = useLogout();
  return (
    <button type="button" onClick={() => void logout()} className="focus-ring mt-3 w-full rounded-md border border-[#C09B5A]/30 px-3 py-2 text-sm font-semibold text-[#0B1F3A] hover:bg-[#E8D5A8]/30">
      تسجيل الخروج
    </button>
  );
}

/** زرّ أيقوني لتسجيل الخروج في الشريط العلوي — متاح بقارئ الشاشة. */
export function LogoutIconButton({ label }: { label: string }) {
  const logout = useLogout();
  return (
    <button type="button" onClick={() => void logout()} className="icon-pill focus-ring" aria-label={label} title={label}>
      <LogOut size={16} aria-hidden />
    </button>
  );
}
