import Link from "next/link";
import type { EditorialAccess } from "@/lib/modules/editorial/types";

export interface DeskNavAccess {
  propose: boolean;
  audit: boolean;
  settings: boolean;
}

/** ما يظهر من ألسنة المكتب: لا لسان لمن لا يملك فعله (ق١٥-١). */
export function deskNavAccess(access: EditorialAccess): DeskNavAccess {
  return {
    propose: access.editorLaws,
    audit: access.superAdmin || (!access.agent && (access.qaView || access.reviewer)),
    settings: access.superAdmin,
  };
}

export function DeskNav({ current, access }: { current: string; access: DeskNavAccess }) {
  const tabs = [
    { href: "/admin/legal", label: "لوحة الحالة", show: true },
    { href: "/admin/legal/queue", label: "طابور الاعتماد", show: true },
    { href: "/admin/legal/new", label: "تغيير حالة نظام", show: access.propose },
    { href: "/admin/legal/audit", label: "سجل التدقيق", show: access.audit },
    { href: "/admin/legal/settings", label: "الإعدادات", show: access.settings },
  ].filter((t) => t.show || t.href === current);
  return (
    <nav aria-label="مكتب التحرير" className="dk-nav">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? "page" : undefined} className="dk-nav__link">
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function DeskHeader({ title, lead, queue = false }: { title: string; lead?: string; queue?: boolean }) {
  return (
    <header>
      <p className="dk-eyebrow">مكتب التحرير التشريعي</p>
      <h1 className="dk-h1">{title}</h1>
      {lead ? <p className={`dk-lead${queue ? " dk-lead--queue" : ""}`}>{lead}</p> : null}
    </header>
  );
}
