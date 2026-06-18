import Link from "next/link";
import { Briefcase, Database, FileClock, GraduationCap, LayoutDashboard, LogOut, Paperclip, Scale, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { TopbarBreadcrumb } from "@/components/TopbarBreadcrumb";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  active?: boolean;
};

const navSections: Array<{ items: NavItem[] }> = [
  {
    items: [{ href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard }]
  },
  {
    items: [
      { href: "/dashboard/cases", label: "الدعاوى", icon: Briefcase, badge: "٤" },
      { href: "/dashboard/consultations", label: "الاستشارات", icon: ShieldCheck },
      { href: "/dashboard/attachments", label: "المرفقات", icon: Paperclip }
    ]
  },
  {
    items: [
      { href: "/dashboard/ask", label: "اسأل حكيم", icon: Sparkles },
      { href: "/dashboard/simulations", label: "القاضي التفاعلي", icon: Scale, active: true }
    ]
  },
  {
    items: [
      { href: "/dashboard/legal-core", label: "النواة القانونية — المكتبة النظامية", icon: Database },
      { href: "/dashboard/knowledge-graph", label: "الرسم المعرفي (اختبار)", icon: Database },
      { href: "/dashboard/legal-search", label: "البحث الهجين (اختبار)", icon: Database },
      { href: "/dashboard/legal-rag", label: "الذكاء القانوني RAG (اختبار)", icon: Sparkles },
      { href: "/dashboard/case-analysis", label: "تحليل القضايا (اختبار)", icon: Scale },
      { href: "/dashboard/legal-agent", label: "الوكيل القانوني (اختبار)", icon: Sparkles },
      { href: "/dashboard/judicial-simulation", label: "المحاكاة القضائية (اختبار)", icon: Scale },
      { href: "/dashboard/training", label: "التدريب", icon: GraduationCap }
    ]
  },
  {
    items: [
      { href: "/admin", label: "الإعدادات", icon: Settings },
      { href: "/admin/ai", label: "إعدادات الذكاء", icon: Sparkles },
      { href: "/admin/users", label: "المستخدمون", icon: Users },
      { href: "/audit-logs", label: "سجل التدقيق", icon: FileClock }
    ]
  }
];

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "حساب محام - تدريبي",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب"
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  const initials =
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "ح";

  return (
    <div className="app" dir="rtl">
      <div className="sidebar-overlay" id="sidebar-overlay" aria-hidden />
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-inner">
          <Link href="/dashboard" className="brand">
            <div className="brand-mark">ح</div>
            <div className="brand-label">
              <h1>حكيم</h1>
              <p>منصة المحاكاة القضائية السعودية</p>
            </div>
          </Link>

          {navSections.map((section, sectionIndex) => (
            <nav className="nav-section" style={{ marginTop: sectionIndex ? 6 : 0 }} key={sectionIndex}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={`nav-btn ${item.active ? "active" : ""}`}>
                    <Icon />
                    {item.label}
                    {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
          ))}

          <div className="sidebar-foot">
            <div className="user-av">{initials}</div>
            <div className="user-info min-w-0 flex-1">
              <div className="uname truncate">{user?.name ?? "المستخدم التجريبي"}</div>
              <div className="urole truncate">{user ? roleLabels[user.role] ?? user.role : "حساب محام - تدريبي"}</div>
            </div>
          </div>
          {user ? <LogoutButton /> : null}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <MobileNav />
            <TopbarBreadcrumb />
          </div>
          <div className="topbar-right">
            <form className="search-box" action="/dashboard/legal-core/search">
              <span>⌕</span>
              <input name="q" aria-label="بحث" placeholder="بحث في النواة القانونية..." />
            </form>
            <div className="icon-pill" title="تسجيل الخروج">
              <LogOut size={16} />
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
