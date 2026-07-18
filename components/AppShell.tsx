import Link from "next/link";
import { BookOpen, FileText, FlaskConical, FolderClosed, Gavel, LayoutDashboard, Search, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { LogoutButton, LogoutIconButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { SidebarNav } from "@/components/SidebarNav";
import { TopbarBreadcrumb } from "@/components/TopbarBreadcrumb";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getTranslator } from "@/lib/i18n/server";
import { DIR, LOCALE_LABEL } from "@/lib/i18n/dictionaries";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  /** مفتاح الترجمة في القاموس */
  key: string;
  icon: LucideIcon;
  badge?: string;
  active?: boolean;
};

// ── القائمة النهائية: ثمانية عناصر مسطّحة، بأيقونات موحّدة، بلا هرميّة ──
// «اسأل حكيم» وأوضاعه مدخلها الصفحة الرئيسية (صندوق البحث + الأوضاع)، فلا يظهر كعنصر مستقلّ.
// المسائل والمبادئ داخل المكتبة (تبويبات)؛ التجريبيّ داخل المختبر؛ الملفّات والإعدادات صفحتا تجميع.
const navItems: NavItem[] = [
  { href: "/dashboard", key: "nav.home", icon: LayoutDashboard },
  { href: "/dashboard/legal-search", key: "nav.search", icon: Search },
  { href: "/dashboard/simulations", key: "nav.interactiveJudge", icon: Gavel },
  { href: "/dashboard/legal-core", key: "nav.library", icon: BookOpen },
  { href: "/documents", key: "nav.docPlatform", icon: FileText },
  { href: "/dashboard/lab", key: "nav.lab", icon: FlaskConical },
  { href: "/dashboard/files", key: "nav.myFiles", icon: FolderClosed },
  { href: "/admin", key: "nav.settings", icon: Settings },
];

// عنصر تنقّل مسطّح واحد (رابط) — يُستعمل في كل الأقسام غير القابلة للطيّ.
const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "حساب محام - تدريبي",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب"
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, t } = getTranslator();
  const user = await getCurrentUser().catch(() => null);
  const initials =
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "ح";

  return (
    <div className="app" dir={DIR[locale]}>
      <a href="#main-content" className="skip-link">{t("a11y.skipToContent")}</a>
      <div className="sidebar-overlay" id="sidebar-overlay" aria-hidden />
      <aside className="sidebar" id="sidebar" aria-label={t("a11y.mainNav")}>
        <div className="sidebar-inner">
          <Link href="/dashboard" className="brand">
            <div className="brand-mark" aria-hidden>ح</div>
            <div className="brand-label">
              <h1>حكيم</h1>
              <p>{t("brand.tagline")}</p>
            </div>
          </Link>

          {/* ── القائمة النهائية: ثمانية عناصر مسطّحة، تُبرز الصفحة الحالية ── */}
          <SidebarNav
            label={t("a11y.mainNav")}
            items={navItems.map((item) => {
              const Icon = item.icon;
              return { href: item.href, label: t(item.key), icon: <Icon aria-hidden /> };
            })}
          />

          <div className="sidebar-foot">
            <div className="user-av" aria-hidden>{initials}</div>
            <div className="user-info min-w-0 flex-1">
              <div className="uname truncate">{user?.name ?? "المستخدم التجريبي"}</div>
              <div className="urole truncate">{user ? roleLabels[user.role] ?? user.role : "حساب محام - تدريبي"}</div>
              <Link
                href="/dashboard/billing"
                className="mt-1 block truncate text-[11px] font-semibold text-[var(--gold-pale)] hover:underline"
              >
                الفوترة والخطط
              </Link>
              <Link
                href="/onboarding"
                className="mt-0.5 block truncate text-[11px] font-semibold text-white/70 hover:underline"
              >
                الملف والنقاط
              </Link>
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
            <form className="search-box" action="/dashboard/legal-search" role="search">
              <span aria-hidden>⌕</span>
              <input name="q" aria-label={t("topbar.search")} placeholder={t("topbar.searchPlaceholder")} />
            </form>
            <LanguageToggle current={locale} switchLabel={LOCALE_LABEL[locale === "ar" ? "en" : "ar"]} />
            <LogoutIconButton label={t("topbar.logout")} />
          </div>
        </header>
        <div className="content" id="main-content">{children}</div>
        <footer className="app-foot">
          <span>{t("footer.tagline")}</span>
          <nav className="app-foot-links" aria-label={locale === "ar" ? "روابط نظامية" : "Legal links"}>
            <Link href="/privacy">{t("footer.privacy")}</Link>
            <Link href="/terms">{t("footer.terms")}</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
