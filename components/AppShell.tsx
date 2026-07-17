import Link from "next/link";
import { Briefcase, ClipboardCheck, Database, FileClock, FileSearch, Gavel, GraduationCap, LayoutDashboard, Paperclip, Search, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { LogoutButton, LogoutIconButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
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

// ── القائمة الرئيسية: روابط مسطّحة بلا طيّ/هرميّة ──
// «اسأل حكيم» رابطٌ واحد؛ الأوضاع الستّة تُختار من شريط الأوضاع داخل صفحة البحث نفسها.
// «النواة القانونية» رابطٌ واحد؛ المسائل والمبادئ يُوصَل إليهما من داخل صفحة النواة.
const primaryItems: NavItem[] = [
  { href: "/dashboard", key: "nav.home", icon: LayoutDashboard },
  { href: "/dashboard/legal-search", key: "nav.search", icon: Search },
  { href: "/dashboard/ask", key: "nav.ask", icon: Sparkles },
  { href: "/dashboard/simulations", key: "nav.interactiveJudge", icon: Gavel },
  { href: "/documents", key: "nav.docPlatform", icon: FileSearch },
  { href: "/dashboard/legal-core", key: "nav.legalCore", icon: Database },
];

// ── أدوات متقدّمة (تبقى للوصول — ليست ضمن «الرئيسية الستّة» لكن لا تُحذف) ──
const toolItems: NavItem[] = [
  { href: "/dashboard/legal-core/admin", key: "nav.contentAdmin", icon: ClipboardCheck },
  { href: "/dashboard/knowledge-graph", key: "nav.knowledgeGraph", icon: Database },
  { href: "/dashboard/legal-rag", key: "nav.rag", icon: Sparkles },
  { href: "/dashboard/training", key: "nav.training", icon: GraduationCap },
];

// ── الإدارة (لا تُلمس — أمن/صلاحيات) ──
const adminItems: NavItem[] = [
  { href: "/admin", key: "nav.settings", icon: Settings },
  { href: "/admin/ai", key: "nav.aiSettings", icon: Sparkles },
  { href: "/admin/users", key: "nav.users", icon: Users },
  { href: "/audit-logs", key: "nav.auditLog", icon: FileClock },
];

// ── ملفّاتي (تحت الحساب): الدعاوى · الاستشارات (سجلّ) · المرفقات — نُقلت من القائمة الرئيسية ──
const myFilesItems: NavItem[] = [
  { href: "/dashboard/cases", key: "nav.cases", icon: Briefcase },
  { href: "/dashboard/consultations", key: "nav.consultations", icon: ShieldCheck },
  { href: "/dashboard/attachments", key: "nav.attachments", icon: Paperclip },
];

// عنصر تنقّل مسطّح واحد (رابط) — يُستعمل في كل الأقسام غير القابلة للطيّ.
function renderNavItem(item: NavItem, t: (key: string) => string) {
  const Icon = item.icon;
  return (
    <Link key={item.href} href={item.href} className={`nav-btn ${item.active ? "active" : ""}`}>
      <Icon aria-hidden />
      {t(item.key)}
      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
    </Link>
  );
}

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

          {/* ── القائمة الرئيسية: روابط مسطّحة (بلا هرميّة) ── */}
          <nav className="nav-section" aria-label={t("a11y.mainNav")}>
            {primaryItems.map((item) => renderNavItem(item, t))}
          </nav>

          {/* ── أدوات متقدّمة ── */}
          <nav className="nav-section" style={{ marginTop: 6 }} aria-label={t("nav.tools")}>
            <div className="nav-section-label">{t("nav.tools")}</div>
            {toolItems.map((item) => renderNavItem(item, t))}
          </nav>

          {/* ── الإدارة ── */}
          <nav className="nav-section" style={{ marginTop: 6 }} aria-label={t("nav.admin")}>
            <div className="nav-section-label">{t("nav.admin")}</div>
            {adminItems.map((item) => renderNavItem(item, t))}
          </nav>

          {/* ── ملفّاتي (تحت الحساب) — تُدفع لأسفل بجوار كتلة الحساب ── */}
          <nav className="nav-section nav-account" aria-label={t("nav.myFiles")}>
            <div className="nav-section-label">{t("nav.myFiles")}</div>
            {myFilesItems.map((item) => renderNavItem(item, t))}
          </nav>

          <div className="sidebar-foot">
            <div className="user-av" aria-hidden>{initials}</div>
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
