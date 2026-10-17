import Link from "next/link";

const TABS = [
  { href: "/admin/legal", label: "لوحة الحالة" },
  { href: "/admin/legal/queue", label: "طابور الاعتماد" },
  { href: "/admin/legal/new", label: "تغيير حالة نظام" },
  { href: "/admin/legal/audit", label: "سجل التدقيق" },
];

export function DeskNav({ current }: { current: string }) {
  return (
    <nav aria-label="مكتب التحرير" className="mt-4 -mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-semibold ${
              active ? "bg-[#0E3435] text-white" : "text-[#0E3435] hover:bg-[rgba(14,52,53,0.06)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DeskHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <>
      <p className="text-sm font-semibold text-[#8B6914]">مكتب التحرير التشريعي</p>
      <h1 className="mt-2 text-2xl font-bold text-[#0E3435] sm:text-3xl">{title}</h1>
      {lead ? <p className="mt-2 max-w-3xl text-sm leading-7 text-[rgba(18,33,31,0.72)]">{lead}</p> : null}
    </>
  );
}
