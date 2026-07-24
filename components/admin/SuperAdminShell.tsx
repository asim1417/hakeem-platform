import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { TopbarUserBar } from "@/components/LogoutButton";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { PLATFORM_WINDOW_HREF } from "@/lib/modules/auth/home-destination";
import type { SafeUser } from "@/lib/modules/auth/session";

/**
 * غلاف إدارة السوبر — ليس داشبورد العميل.
 * قائمة تشغيل + نافذة للمنصة عند الحاجة للمعاينة.
 */
export function SuperAdminShell({
  currentPath,
  user,
  children,
}: {
  currentPath: string;
  user: SafeUser | null;
  children: React.ReactNode;
}) {
  const clerkEnabled = isClerkConfigured();

  return (
    <div className="min-h-[100dvh] bg-[#F3EFE6]" dir="rtl" lang="ar">
      <header className="border-b border-[rgba(14,52,53,0.1)] bg-[#0E3435] text-[#FFFcf7]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <Link href="/admin" className="block">
              <p className="text-xs font-semibold tracking-wide text-[#C9A84C]">إدارة حكيم</p>
              <h1 className="truncate text-lg font-bold">لوحة التشغيل</h1>
            </Link>
            {user ? (
              <p className="mt-0.5 truncate text-xs text-white/65">
                {user.name} · سوبر أدمن
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={PLATFORM_WINDOW_HREF}
              className="touch-target inline-flex min-h-[44px] items-center rounded-md bg-[#C9A84C] px-3 py-2 text-sm font-semibold text-[#0E3435] hover:bg-[#E0C06A]"
            >
              نافذة المنصة
            </Link>
            {user ? (
              <div className="[&_.topbar-user__name]:text-[#FFFcf7] [&_.icon-pill]:border-white/25 [&_.icon-pill]:text-[#FFFcf7]">
                <TopbarUserBar
                  name={user.name}
                  logoutLabel="خروج"
                  clerkEnabled={clerkEnabled}
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <AdminNav currentPath={currentPath} variant="super" />
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
