import Link from "next/link";
import { BookOpen, Bot, FileText, FolderClosed, Gavel, LayoutDashboard, Scale, Search, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { TRADITIONAL_SEARCH_ENABLED, AI_SEARCH_HOME } from "@/lib/modules/config/search-visibility";
import { isPlatformAdmin } from "@/lib/modules/auth/super-admin";
import { getNavVisibility } from "@/lib/modules/admin/nav-visibility";
import { Suspense } from "react";
import { LogoutButton, TopbarUserBar } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { SidebarNav } from "@/components/SidebarNav";
import { TopbarBreadcrumb } from "@/components/TopbarBreadcrumb";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DashboardHomeLink, SafeBackButton } from "@/components/nav/SafeBackButton";
import { ScrollRestorer } from "@/components/nav/ScrollRestorer";
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
const baseNavItems: NavItem[] = [
  { href: "/dashboard", key: "nav.home", icon: LayoutDashboard },
  { href: "/dashboard/judicial-assistant", key: "nav.judicialAssistant", icon: Scale },
  { href: "/dashboard/legal-search", key: "nav.search", icon: Search },
  { href: "/dashboard/simulations", key: "nav.interactiveJudge", icon: Gavel },
  { href: "/dashboard/legal-core", key: "nav.library", icon: BookOpen },
  { href: "/documents", key: "nav.docPlatform", icon: FileText },
  { href: "/dashboard/agents", key: "nav.agents", icon: Bot },
  { href: "/dashboard/files", key: "nav.myFiles", icon: FolderClosed },
];

const adminNavItem: NavItem = { href: "/admin", key: "nav.settings", icon: Settings };

// عنصر تنقّل مسطّح واحد (رابط) — يُستعمل في كل الأقسام غير القابلة للطيّ.
const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "سوبر أدمن",
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "حساب محام - تدريبي",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب",
  JUDGE: "قاضٍ"
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, t } = getTranslator();
  const user = await getCurrentUser().catch(() => null);
  const clerkEnabled = isClerkConfigured();
  const isAdmin = isPlatformAdmin(user);
  const navVisibility = await getNavVisibility().catch(() => ({
    agents: true,
    documents: true,
    simulations: true,
    traditionalSearch: TRADITIONAL_SEARCH_ENABLED,
  }));
  // إخفاء عناصر القائمة حسب رايات السوبر أدمن (واجهة فقط — الخدمات الخلفية تعمل).
  const visibleNav = baseNavItems.filter((i) => {
    if (i.href === "/dashboard/legal-search") return navVisibility.traditionalSearch;
    if (i.href === "/dashboard/agents") return navVisibility.agents;
    if (i.href === "/documents") return navVisibility.documents;
    if (i.href === "/dashboard/simulations") return navVisibility.simulations;
    return true;
  });
  const navItems = isAdmin ? [...visibleNav, adminNavItem] : visibleNav;
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

          {/* ── القائمة: إعدادات الإدارة للمدير فقط ── */}
          <SidebarNav
            label={t("a11y.mainNav")}
            items={navItems.map((item) => {
              const Icon = item.icon;
              return { href: item.href, label: t(item.key), icon: <Icon aria-hidden /> };
            })}
          />

          <div className="sidebar-foot">
            <div className="user-av" aria-hidden>
              {initials}
            </div>
            <div className="user-info min-w-0 flex-1">
              <div className="uname truncate">{user?.name ?? "المستخدم التجريبي"}</div>
              <div className="urole truncate">
                {user ? roleLabels[user.role] ?? user.role : "حساب محام - تدريبي"}
              </div>
              <Link
                href="/dashboard/billing"
                className="sidebar-foot-link mt-1 block truncate font-semibold text-[var(--gold-pale)] hover:underline"
              >
                الفوترة والخطط
              </Link>
              <Link
                href="/onboarding"
                className="sidebar-foot-link mt-0.5 block truncate font-semibold text-white/70 hover:underline"
              >
                الحساب والإعدادات
              </Link>
            </div>
          </div>
          {user ? <LogoutButton clerkEnabled={clerkEnabled} /> : null}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <MobileNav />
            <Suspense fallback={null}>
              <SafeBackButton />
            </Suspense>
            <DashboardHomeLink />
            <TopbarBreadcrumb />
          </div>
          <div className="topbar-right">
            {/* صندوق البحث العلويّ: يوجَّه للبحث الذكيّ (اسأل حكيم) حين يُخفى البحث التقليديّ. */}
            <form className="search-box" action={TRADITIONAL_SEARCH_ENABLED ? "/dashboard/legal-search" : AI_SEARCH_HOME} role="search">
              <span aria-hidden>⌕</span>
              <input name="q" aria-label={t("topbar.search")} placeholder={t("topbar.searchPlaceholder")} autoComplete="off" />
            </form>
            <LanguageToggle current={locale} switchLabel={LOCALE_LABEL[locale === "ar" ? "en" : "ar"]} />
            {user ? (
              <TopbarUserBar
                name={user.name}
                logoutLabel={t("topbar.logout")}
                clerkEnabled={clerkEnabled}
              />
            ) : null}
          </div>
        </header>
        <ScrollRestorer />
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
