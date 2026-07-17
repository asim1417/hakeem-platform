"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type NavChild = { href: string; label: string; icon?: string };

/**
 * مجموعة تنقّل قابلة للطيّ/النشر داخل القائمة الجانبية (تنظيم هرميّ).
 * - `href` اختياريّ: إن وُجد فالعنوان رابطٌ يتنقّل + سهمٌ منفصل يطوي/ينشر (مثل «النواة»).
 *   وإن غاب فالعنوان نفسه زرّ طيّ/نشر بحت (مثل «اسأل حكيم» — الأوضاع هي الوجهات).
 * - يعتمد `usePathname` فقط (دون `useSearchParams`) تفاديًا لمتطلّب Suspense في البناء.
 * - إعادة تنظيم عرض فقط: لا يغيّر منطق الأوضاع/الوكيل/المصادقة — روابط قائمة لا أكثر.
 */
export function NavGroup({
  label,
  icon,
  href,
  children,
  defaultOpen = false,
}: {
  label: string;
  /** عنصرٌ مُصيَّر (لا مرجع مكوّن) — كي يعبر حدّ الخادم→العميل بأمان. */
  icon: ReactNode;
  href?: string;
  children: NavChild[];
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  const childBasePaths = children.map((c) => c.href.split("?")[0]);
  const childActive = childBasePaths.some((base) => pathname === base);
  const selfActive = href ? pathname === href || pathname.startsWith(`${href}/`) : false;
  const [open, setOpen] = useState(defaultOpen || childActive || selfActive);
  const groupId = `navgrp-${label}`;

  // يُبرَز الابن النشط فقط حين يتفرّد مساره (أوضاع «اسأل» تتشارك المسار نفسه فلا تُبرَز خطأً).
  const uniquePathMatch = childBasePaths.filter((base) => base === pathname).length === 1;

  return (
    <div className="nav-group">
      <div className="nav-group-head">
        {href ? (
          <Link href={href} className={`nav-btn nav-group-label ${selfActive ? "active" : ""}`}>
            {icon}
            <span>{label}</span>
          </Link>
        ) : (
          <button
            type="button"
            className="nav-btn nav-group-label"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={groupId}
          >
            {icon}
            <span>{label}</span>
          </button>
        )}
        <button
          type="button"
          className="nav-group-chevron"
          aria-expanded={open}
          aria-controls={groupId}
          aria-label={`${open ? "طيّ" : "نشر"} ${label}`}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown
            aria-hidden
            style={{ transform: open ? "none" : "rotate(90deg)", transition: "transform .18s" }}
          />
        </button>
      </div>
      <div id={groupId} className="nav-subitems" hidden={!open}>
        {children.map((c) => {
          const base = c.href.split("?")[0];
          const active = uniquePathMatch && base === pathname;
          return (
            <Link key={c.href} href={c.href} className={`nav-btn nav-subitem ${active ? "active" : ""}`}>
              {c.icon ? (
                <span className="nav-emoji" aria-hidden>
                  {c.icon}
                </span>
              ) : null}
              <span>{c.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
