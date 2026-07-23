import Link from "next/link";

const SUPER_LINKS = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/services", label: "الخدمات" },
  { href: "/admin/jobs", label: "المهام" },
  { href: "/admin/audit", label: "التدقيق" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/roles", label: "الأدوار" },
  { href: "/admin/ai", label: "الذكاء" },
  { href: "/admin/settings", label: "الإعدادات" },
  { href: "/dashboard/legal-core/admin", label: "المحتوى القانوني" },
] as const;

/**
 * قائمة إدارية موحّدة لصفحات السوبر أدمن تحت /admin.
 */
export function SuperAdminNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="قائمة السوبر أدمن"
      className="mb-6 flex flex-wrap gap-2 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-3"
    >
      {SUPER_LINKS.map((link) => {
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
                ? "rounded-md bg-[#0E3435] px-3 py-2 text-sm font-semibold text-[#FFFcf7]"
                : "rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)] hover:bg-[#F7F2EA]"
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
