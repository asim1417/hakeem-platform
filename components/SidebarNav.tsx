"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type SidebarNavItem = { href: string; label: string; icon: ReactNode };

/**
 * قائمة التنقّل الجانبية — تُبرز الصفحة الحالية عبر usePathname.
 * تستقبل الأيقونات كعناصر مُصيَّرة (ReactNode) كي تعبر حدّ الخادم→العميل بأمان.
 */
export function SidebarNav({ items, label }: { items: SidebarNavItem[]; label?: string }) {
  const pathname = usePathname();
  return (
    <nav className="nav-section" aria-label={label}>
      {items.map((item) => {
        // «الرئيسية» تُطابق تطابقًا تامًّا؛ البقية تُطابق مسارها أو ما تحته.
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`nav-btn ${active ? "active" : ""}`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
