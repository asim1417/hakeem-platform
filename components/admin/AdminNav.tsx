import Link from "next/link";

const SUPER_LINKS = [
  { href: "/admin", label: "مركز الإدارة" },
  { href: "/admin/inbox", label: "صندوق المراسلات" },
  { href: "/admin/site", label: "لوحة الموقع" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/billing", label: "الفوترة" },
  { href: "/admin/jobs", label: "المهام" },
  { href: "/admin/reports", label: "البلاغات" },
  { href: "/admin/services", label: "الخدمات" },
  { href: "/admin/audit", label: "التدقيق" },
  { href: "/admin/roles", label: "الأدوار" },
  { href: "/admin/owner", label: "المدراء" },
  { href: "/admin/ai", label: "الذكاء" },
  { href: "/admin/api-keys", label: "مفاتيح API" },
  { href: "/admin/settings", label: "الإعدادات" },
  { href: "/dashboard/legal-core/admin", label: "المحتوى القانوني" },
] as const;

/** روابط مدير النظام — بدون أقسام السوبر الحصرية (فوترة/مهام/إعدادات/ذكاء/بلاغات). */
const SYSTEM_LINKS = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/roles", label: "الأدوار" },
  { href: "/admin/owner", label: "المدراء" },
  { href: "/admin/api-keys", label: "مفاتيح API" },
  { href: "/dashboard/legal-core/admin", label: "المحتوى القانوني" },
] as const;

export type AdminNavVariant = "super" | "system";

/**
 * قائمة إدارية موحّدة — تظهر حسب الدور دون كسر فصل السوبر/مدير النظام.
 */
export function AdminNav({
  currentPath,
  variant = "super",
}: {
  currentPath: string;
  variant?: AdminNavVariant;
}) {
  const links = variant === "super" ? SUPER_LINKS : SYSTEM_LINKS;
  const aria = variant === "super" ? "قائمة السوبر أدمن" : "قائمة مدير النظام";

  return (
    <nav
      aria-label={aria}
      className="mb-6 flex flex-wrap gap-2 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-3"
    >
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? currentPath === "/admin"
            : currentPath === link.href || currentPath.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "touch-target inline-flex min-h-[44px] items-center rounded-md bg-[#0E3435] px-3 py-2 text-sm font-semibold text-[#FFFcf7]"
                : "touch-target inline-flex min-h-[44px] items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)] hover:bg-[#F7F2EA]"
            }
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** توافق خلفي مع الاستيرادات القديمة. */
export function SuperAdminNav({ currentPath }: { currentPath: string }) {
  return <AdminNav currentPath={currentPath} variant="super" />;
}
