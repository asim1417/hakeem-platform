"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void logout()} className="focus-ring mt-3 w-full rounded-md border border-[#C09B5A]/30 px-3 py-2 text-sm font-semibold text-[#0B1F3A] hover:bg-[#E8D5A8]/30">
      تسجيل الخروج
    </button>
  );
}
