import Link from "next/link";
import { Search } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { listSystems } from "@/lib/modules/library/library-service";
import { LegalCorePageHeader, LegalCoreShell, LegalSystemCard, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreSystemsPage({
  searchParams
}: {
  searchParams?: { q?: string; classification?: string; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const q = (searchParams?.q ?? "").trim();
  const classification = (searchParams?.classification ?? "").trim();
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const { items, total, pageSize, classifications } = await listSystems({ q, classification, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qp = (extra: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (classification) sp.set("classification", classification);
    for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
    const s = sp.toString();
    return `/dashboard/legal-core/systems${s ? `?${s}` : ""}`;
  };

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="الأنظمة القانونية"
          description="بطاقات معرفية لكل نظام مع عدد المواد والتصنيف، مع بحث وتصفية وترقيم للوصول السريع."
        />

        {/* بحث + تصفية */}
        <form action="/dashboard/legal-core/systems" className="flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--parchment)] p-4">
          <div className="flex flex-1 items-center gap-2 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white px-3 py-2">
            <Search size={16} className="text-[var(--gold)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ابحث باسم النظام..."
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none"
            />
          </div>
          {classification ? <input type="hidden" name="classification" value={classification} /> : null}
          <button type="submit" className="btn btn-gold">بحث</button>
          {q || classification ? (
            <Link href="/dashboard/legal-core/systems" className="btn btn-outline">مسح</Link>
          ) : null}
        </form>

        {classifications.length ? (
          <div className="flex flex-wrap gap-2">
            <Link href={q ? `/dashboard/legal-core/systems?q=${encodeURIComponent(q)}` : "/dashboard/legal-core/systems"} className={!classification ? "opacity-100" : "opacity-70"}>
              <LegalTopicBadge tone={!classification ? "emerald" : "amber"}>الكل</LegalTopicBadge>
            </Link>
            {classifications.map((c) => {
              const sp = new URLSearchParams();
              if (q) sp.set("q", q);
              sp.set("classification", c);
              return (
                <Link key={c} href={`/dashboard/legal-core/systems?${sp.toString()}`} className={classification === c ? "opacity-100" : "opacity-70"}>
                  <LegalTopicBadge tone={classification === c ? "emerald" : "amber"}>{c}</LegalTopicBadge>
                </Link>
              );
            })}
          </div>
        ) : null}

        <p className="font-mono-legal text-xs text-[var(--ink-60)]">
          {total.toLocaleString("ar-SA")} نظاماً · صفحة {page.toLocaleString("ar-SA")} من {pages.toLocaleString("ar-SA")}
        </p>

        {items.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((system) => <LegalSystemCard key={system.lawName} system={system} />)}
          </section>
        ) : (
          <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-6 text-center text-sm text-[var(--navy)]">
            لا توجد أنظمة مطابقة لبحثك.
          </div>
        )}

        {/* ترقيم */}
        <div className="flex items-center justify-between">
          <Link className={`btn btn-outline ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={qp({ page: page - 1 })}>السابق</Link>
          <span className="font-mono-legal text-xs text-[var(--ink-60)]">{page.toLocaleString("ar-SA")} / {pages.toLocaleString("ar-SA")}</span>
          <Link className={`btn btn-outline ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={qp({ page: page + 1 })}>التالي</Link>
        </div>
      </div>
    </LegalCoreShell>
  );
}
