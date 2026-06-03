import Link from "next/link";
import { BookOpen, Briefcase, FileClock, GraduationCap, LayoutDashboard, LogOut, Paperclip, Scale, Settings, ShieldCheck, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

const groups = [
  {
    title: "الرئيسية",
    items: [{ href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard }]
  },
  {
    title: "إدارة العمل القانوني",
    items: [
      { href: "/dashboard/cases", label: "القضايا", icon: Briefcase },
      { href: "/dashboard/consultations", label: "الاستشارات", icon: ShieldCheck },
      { href: "/dashboard/attachments", label: "المرفقات والبينات", icon: Paperclip }
    ]
  },
  {
    title: "القاضي حكيم",
    items: [{ href: "/dashboard/simulations", label: "المحاكاة القضائية", icon: Scale }]
  },
  {
    title: "المكتبة والتدريب",
    items: [
      { href: "/dashboard/library", label: "المكتبة النظامية", icon: BookOpen },
      { href: "/dashboard/training", label: "التدريب القانوني", icon: GraduationCap }
    ]
  },
  {
    title: "الإدارة",
    items: [
      { href: "/admin", label: "الإدارة", icon: Settings },
      { href: "/admin/users", label: "المستخدمون", icon: Users },
      { href: "/audit-logs", label: "سجل التدقيق", icon: FileClock }
    ]
  }
];

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "محامٍ",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب"
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  const initials = user?.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("") || "ح";

  return (
    <div className="app" dir="rtl">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <Link href="/dashboard" className="brand">
            <div className="brand-mark">ح</div>
            <div className="brand-label">
              <h1>حكيم</h1>
              <p>المنصة القانونية الموحدة</p>
            </div>
          </Link>

          <nav>
            {groups.map((group) => (
              <section key={group.title} className="nav-group">
                <div className="nav-group-title">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="nav-item">
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="user-av">{initials}</div>
            <div className="user-info min-w-0 flex-1">
              <div className="uname truncate">{user?.name ?? "مستخدم حكيم"}</div>
              <div className="urole truncate">{user ? roleLabels[user.role] ?? user.role : "جلسة غير مسجلة"}</div>
            </div>
            <div className="hidden">
              <LogOut size={14} />
            </div>
          </div>
          {user ? <LogoutButton /> : null}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <p className="t-display text-xs text-[var(--ink-60)]">منصة حكيم</p>
            <h2 className="t-head text-2xl font-bold text-[var(--navy)]">مساحة العمل القانونية</h2>
          </div>
          <div className="rounded-full border border-[var(--gold-border)] bg-[var(--paper)] px-4 py-2 t-mono text-xs text-[var(--navy)]">
            Modular Monolith · PostgreSQL
          </div>
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
