import Link from "next/link";

type NavLink = { href: string; label: string };
export type AdminNavSection = { key: string; title: string; links: readonly NavLink[] };

const SUPER_LINKS: readonly NavLink[] = [
  { href: "/admin", label: "مركز الإدارة" },
  { href: "/admin/inbox", label: "صندوق المراسلات" },
  { href: "/admin/site", label: "لوحة الموقع" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/billing", label: "الفوترة" },
  { href: "/admin/usage", label: "الاستهلاك" },
  { href: "/admin/usage/week", label: "رصد الأسبوع" },
  { href: "/admin/jobs", label: "المهام" },
  { href: "/admin/reports", label: "البلاغات" },
  { href: "/admin/services", label: "الخدمات" },
  { href: "/admin/audit", label: "التدقيق" },
  { href: "/admin/governance", label: "الحوكمة المعمارية" },
  { href: "/admin/roles", label: "الأدوار" },
  { href: "/admin/owner", label: "المدراء" },
  { href: "/admin/ai", label: "الذكاء" },
  { href: "/admin/api-keys", label: "مفاتيح API" },
  { href: "/admin/mcp-connections", label: "روابط الموصل" },
  { href: "/admin/settings", label: "الإعدادات" },
];

/** روابط مدير النظام — بدون أقسام السوبر الحصرية (فوترة/مهام/إعدادات/ذكاء/بلاغات). */
const SYSTEM_LINKS: readonly NavLink[] = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/usage", label: "الاستهلاك" },
  { href: "/admin/usage/week", label: "رصد الأسبوع" },
  { href: "/admin/governance", label: "الحوكمة المعمارية" },
  { href: "/admin/roles", label: "الأدوار" },
  { href: "/admin/owner", label: "المدراء" },
  { href: "/admin/api-keys", label: "مفاتيح API" },
  { href: "/admin/mcp-connections", label: "روابط الموصل" },
];

// HKM-023-A ل١٢-١٠ / ع-٦: قسم واضح للمحتوى القانوني بدل رابطين في آخر القائمة.
// صفحات النواة القانونية (عرضها بصلاحيات LEGAL_CORE_*، ومدير النظام يمر بها).
const LEGAL_CORE_LINKS: readonly NavLink[] = [
  { href: "/dashboard/legal-core/admin", label: "مركز المحتوى القانوني" },
  { href: "/dashboard/legal-core/quality", label: "جودة البيانات" },
  { href: "/dashboard/legal-core/citations/dashboard", label: "تغطية الاستشهادات" },
  { href: "/dashboard/legal-core/principles", label: "المبادئ القضائية" },
  { href: "/dashboard/legal-core/systems", label: "الأنظمة" },
  { href: "/dashboard/legal-core/judgments", label: "الأحكام" },
];

// مكتب التحرير (HKM-023): يحرسه تكليف المكتب، وSUPER_ADMIN يملكه كاملًا؛ مدير النظام بلا تكليف لا يدخله.
const EDITORIAL_DESK_LINKS: readonly NavLink[] = [
  { href: "/admin/legal", label: "مكتب التحرير" },
  { href: "/admin/legal/queue", label: "طابور المكتب" },
  { href: "/admin/legal/audit", label: "سجل المكتب" },
];

export const ADMIN_NAV_SECTIONS: Record<"super" | "system", readonly AdminNavSection[]> = {
  super: [
    { key: "general", title: "الإدارة العامة", links: SUPER_LINKS },
    { key: "legal", title: "المحتوى القانوني", links: [...EDITORIAL_DESK_LINKS, ...LEGAL_CORE_LINKS] },
  ],
  system: [
    { key: "general", title: "الإدارة العامة", links: SYSTEM_LINKS },
    { key: "legal", title: "المحتوى القانوني", links: LEGAL_CORE_LINKS },
  ],
};

/** الرابط النشط = أطول href يطابق المسار (فـ /admin/legal/queue لا يُنشّط «مكتب التحرير» معه). */
export function activeAdminHref(currentPath: string, links: readonly NavLink[]): string | null {
  let best: string | null = null;
  for (const link of links) {
    const hit = link.href === "/admin" ? currentPath === "/admin" : currentPath === link.href || currentPath.startsWith(`${link.href}/`);
    if (hit && (!best || link.href.length > best.length)) best = link.href;
  }
  return best;
}

export type AdminNavVariant = "super" | "system";

/**
 * تنقّل إداري فرعي — ليس قائمة منتج ثانية.
 * في وضع system يظهر كتسمية «أقسام الإدارة» داخل محتوى AppShell لتقليل الإحساس بالتكرار.
 */
export function AdminNav({
  currentPath,
  variant = "super",
}: {
  currentPath: string;
  variant?: AdminNavVariant;
}) {
  const sections = ADMIN_NAV_SECTIONS[variant];
  const active = activeAdminHref(currentPath, sections.flatMap((section) => section.links));
  const aria = variant === "super" ? "قائمة السوبر أدمن" : "أقسام الإدارة";

  return (
    <nav
      aria-label={aria}
      className={
        variant === "system"
          ? "mb-5 rounded-[0.75rem] border border-dashed border-[rgba(14,52,53,0.18)] bg-[rgba(255,252,247,0.65)] px-3 py-2.5"
          : "mb-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-3"
      }
    >
      {variant === "system" ? (
        <p className="mb-2 w-full text-xs font-semibold text-[rgba(14,52,53,0.55)]">
          أقسام الإدارة — اختر القسم دون مغادرة مساحة العمل
        </p>
      ) : null}
      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.key}
            role="group"
            aria-labelledby={`admin-nav-${variant}-${section.key}`}
            className={section.key === "legal" ? "border-t border-[rgba(14,52,53,0.1)] pt-3" : undefined}
          >
            <p id={`admin-nav-${variant}-${section.key}`} className="mb-2 text-xs font-bold text-[rgba(14,52,53,0.6)]">
              {section.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => {
                const isActive = link.href === active;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      isActive
                        ? "touch-target inline-flex min-h-[44px] items-center rounded-md bg-[#0E3435] px-3 py-2 text-sm font-semibold text-[#FFFcf7]"
                        : "touch-target inline-flex min-h-[44px] items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)] hover:bg-[#F7F2EA]"
                    }
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** توافق خلفي مع الاستيرادات القديمة. */
export function SuperAdminNav({ currentPath }: { currentPath: string }) {
  return <AdminNav currentPath={currentPath} variant="super" />;
}
