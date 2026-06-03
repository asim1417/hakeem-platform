import Link from "next/link";
import { BookOpen, Briefcase, FileClock, GraduationCap, LayoutDashboard, Paperclip, Scale, Settings, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

const nav = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/library", label: "المكتبة النظامية", icon: BookOpen },
  { href: "/dashboard/cases", label: "القضايا", icon: Briefcase },
  { href: "/dashboard/consultations", label: "الاستشارات", icon: ShieldCheck },
  { href: "/dashboard/simulations", label: "القاضي حكيم", icon: Scale },
  { href: "/dashboard/training", label: "التدريب", icon: GraduationCap },
  { href: "/dashboard/attachments", label: "المرفقات", icon: Paperclip },
  { href: "/admin", label: "الإدارة", icon: Settings },
  { href: "/audit-logs", label: "سجل التدقيق", icon: FileClock }
];

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "محامٍ",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب"
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="legal-luxury-surface min-h-screen text-ink">
      <aside className="fixed right-0 top-0 hidden h-screen w-64 border-l border-[#C09B5A]/25 bg-[#FBF8F1] px-4 py-6 shadow-[0_0_35px_rgba(11,31,58,0.08)] lg:block">
        <Link href="/" className="block">
          <p className="font-display-ar text-xs font-semibold text-[#C09B5A]">المنصة القانونية الموحدة</p>
          <h2 className="font-judicial mt-1 text-4xl font-bold text-[#0B1F3A]">حكيم</h2>
        </Link>
        {user ? (
          <div className="mt-5 rounded-md border border-[#C09B5A]/25 bg-white/70 p-3">
            <p className="font-display-ar font-bold text-[#0B1F3A]">{user.name}</p>
            <p className="mt-1 text-xs text-gray-600">{roleLabels[user.role] ?? user.role}</p>
            <LogoutButton />
          </div>
        ) : null}
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#0B1F3A] hover:bg-[#E8D5A8]/35">
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pr-64">
        <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
