"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// تبويبات المكتبة النظامية: المواد · المسائل · المبادئ — تصفّحٌ داخل الصفحة بدل عناصر منفصلة في القائمة.
// «إدارة المحتوى» تبويبٌ إضافيّ يظهر لأصحاب صلاحية إدارة النواة فقط (canManage).
const BASE_TABS = [
  { href: "/dashboard/legal-core", label: "المواد" },
  { href: "/dashboard/legal-core/legal-issues", label: "المسائل القانونية" },
  { href: "/dashboard/legal-core/principles", label: "المبادئ القضائية" },
];

const MANAGE_TAB = { href: "/dashboard/legal-core/admin", label: "إدارة المحتوى" };

export function LegalCoreTabs({ canManage = false }: { canManage?: boolean }) {
  const pathname = usePathname();
  const tabs = canManage ? [...BASE_TABS, MANAGE_TAB] : BASE_TABS;
  return (
    <nav className="lc-tabs" aria-label="أقسام المكتبة النظامية" dir="rtl">
      {tabs.map((tab) => {
        // «المواد» نشط على الجذر فقط؛ الآخران على مسارهما (أو ما تحته).
        const active =
          tab.href === "/dashboard/legal-core"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`lc-tab ${active ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
