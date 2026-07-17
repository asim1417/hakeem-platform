"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// تبويبات المكتبة النظامية: المواد · المسائل · المبادئ — تصفّحٌ داخل الصفحة بدل عناصر منفصلة في القائمة.
const TABS = [
  { href: "/dashboard/legal-core", label: "المواد" },
  { href: "/dashboard/legal-core/legal-issues", label: "المسائل القانونية" },
  { href: "/dashboard/legal-core/principles", label: "المبادئ القضائية" },
];

export function LegalCoreTabs() {
  const pathname = usePathname();
  return (
    <nav className="lc-tabs" aria-label="أقسام المكتبة النظامية" dir="rtl">
      {TABS.map((tab) => {
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
