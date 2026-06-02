import Link from "next/link";
import { BookOpen, Briefcase, FileClock, GraduationCap, LayoutDashboard, Scale, Settings, ShieldCheck } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/library", label: "المكتبة النظامية", icon: BookOpen },
  { href: "/dashboard/cases", label: "القضايا", icon: Briefcase },
  { href: "/dashboard/consultations", label: "الاستشارات", icon: ShieldCheck },
  { href: "/dashboard/simulations", label: "المحاكاة", icon: Scale },
  { href: "/dashboard/training", label: "التدريب", icon: GraduationCap },
  { href: "/admin", label: "الإدارة", icon: Settings },
  { href: "/audit-logs", label: "سجل التدقيق", icon: FileClock }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand text-ink">
      <aside className="fixed right-0 top-0 hidden h-screen w-64 border-l border-black/10 bg-white px-4 py-6 lg:block">
        <Link href="/" className="block">
          <p className="text-xs font-semibold text-gold">المنصة القانونية الموحدة</p>
          <h2 className="mt-1 text-3xl font-bold text-olive">حكيم</h2>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sand">
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
