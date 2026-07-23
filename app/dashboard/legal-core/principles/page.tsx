import Link from "next/link";
import { Scale, Quote, ShieldCheck } from "lucide-react";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { canUser } from "@/lib/modules/auth/rbac";
import { prisma } from "@/lib/prisma";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { PrincipleReviewControls } from "@/components/PrincipleReviewControls";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";
import { LegalCoreTabs } from "@/components/legal-core/LegalCoreTabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// المبادئ القضائية المستخرجة من الأحكام — تخضع للمراجعة قبل الاعتماد.
export default async function JudicialPrinciplesPage({
  searchParams
}: {
  searchParams?: { q?: string; court?: string; status?: string; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser().catch(() => null);
  const canReview = user ? await canUser(user.id, "LEGAL_CORE_EDIT").catch(() => false) : false;
  const canManage = user ? await canUser(user.id, "LEGAL_CORE_ADMIN").catch(() => false) : false;

  const q = (searchParams?.q ?? "").trim();
  const court = (searchParams?.court ?? "").trim();
  const status = (searchParams?.status ?? "").trim();
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const where = {
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { principleText: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(court ? { court } : {}),
    // افتراضيًا نُخفي المرفوضة ما لم تُطلب صراحةً.
    ...(status ? { reviewStatus: status } : { reviewStatus: { not: "rejected" } })
  };

  const [total, reviewed, pendingCount, courtsRaw, principles] = await Promise.all([
    prisma.judicialPrinciple.count().catch(() => 0),
    prisma.judicialPrinciple.count({ where: { reviewStatus: "reviewed" } }).catch(() => 0),
    prisma.judicialPrinciple.count({ where: { reviewStatus: "needs_review" } }).catch(() => 0),
    prisma.judicialPrinciple.groupBy({ by: ["court"], _count: { _all: true }, orderBy: { _count: { court: "desc" } }, take: 12 }).catch(() => [] as Array<{ court: string | null; _count: { _all: number } }>),
    prisma.judicialPrinciple
      .findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, title: true, principleText: true, court: true, topic: true, confidence: true, reviewStatus: true, sourceCaseId: true }
      })
      .catch(() => [])
  ]);

  const filteredCount = await prisma.judicialPrinciple.count({ where }).catch(() => 0);
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const courts = courtsRaw.filter((c) => c.court);

  const qs = (patch: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (court) sp.set("court", court);
    if (status) sp.set("status", status);
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v == null) sp.delete(k);
      else sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <LegalCoreShell>
      <LegalCoreTabs canManage={canManage} />
      <div className="space-y-7">
        <LegalCorePageHeader
          eyebrow="حكيم | النواة القانونية"
          title="المبادئ القضائية"
          description="المبادئ والقواعد المستقرّة المستخرجة من الأحكام القضائية، مع إسناد كل مبدأ إلى حكمه المصدر. الاستخراج الآلي اقتراح يخضع للمراجعة قبل الاعتماد."
          actions={
            <Link href="/dashboard/legal-core" className="btn ho-hero-outline">
              <Scale size={16} /> النواة القانونية
            </Link>
          }
        />

        <section className="grid gap-4 md:grid-cols-3">
          <LegalCoreStatCard label="إجمالي المبادئ" value={total} hint="مستخرجة من الأحكام" tone={total ? "emerald" : "amber"} />
          <LegalCoreStatCard label="مبادئ معتمدة" value={reviewed} hint="بعد المراجعة البشرية" tone={reviewed ? "emerald" : "amber"} />
          <LegalCoreStatCard label="بانتظار المراجعة" value={pendingCount} hint="اقتراحات آلية تنتظر الاعتماد" tone={pendingCount ? "amber" : "emerald"} />
        </section>

        {/* المرشّحات */}
        <form className="flex flex-wrap items-end gap-3 rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]" action="/dashboard/legal-core/principles">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-[var(--ink-60)]" htmlFor="q">بحث في المبادئ</label>
            <input id="q" name="q" defaultValue={q} placeholder="كلمة في المبدأ أو عنوانه..." className="h-10 w-full rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--ink-60)]" htmlFor="court">المحكمة</label>
            <select id="court" name="court" defaultValue={court} className="h-10 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory px-3 text-sm">
              <option value="">كل المحاكم</option>
              {courts.map((c) => (
                <option key={c.court} value={c.court ?? ""}>{c.court} ({c._count._all})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--ink-60)]" htmlFor="status">الحالة</label>
            <select id="status" name="status" defaultValue={status} className="h-10 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory px-3 text-sm">
              <option value="">الكل (عدا المرفوض)</option>
              <option value="reviewed">معتمد</option>
              <option value="needs_review">بانتظار المراجعة</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
          <button type="submit" className="btn btn-gold h-10">تطبيق</button>
        </form>

        <LegalCoreCard title={`النتائج (${filteredCount.toLocaleString("ar-SA")})`} icon={<Quote size={18} />}>
          {principles.length ? (
            <div className="space-y-3">
              {principles.map((p) => (
                <article key={p.id} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-display-ar text-base font-bold text-[var(--navy)]">{p.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {p.court ? <LegalTopicBadge>{p.court}</LegalTopicBadge> : null}
                      <LegalTopicBadge tone={p.reviewStatus === "reviewed" ? "emerald" : p.reviewStatus === "rejected" ? "ruby" : "amber"}>
                        {p.reviewStatus === "reviewed" ? "معتمد" : p.reviewStatus === "rejected" ? "مرفوض" : "بانتظار المراجعة"}
                      </LegalTopicBadge>
                    </div>
                  </div>
                  <p className="mt-3 leading-8 text-[var(--ink-80)]">{p.principleText}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link className="btn btn-gold" href={`/dashboard/legal-core/judgments/${p.sourceCaseId}`}>
                      <Scale size={15} /> الحكم المصدر
                    </Link>
                    <LegalCopyButton text={`${p.title}: ${p.principleText}`} label="نسخ المبدأ" />
                    {canReview ? <PrincipleReviewControls id={p.id} status={p.reviewStatus} /> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-6 text-center text-sm leading-7 text-[var(--navy)]">
              <ShieldCheck className="mx-auto mb-2 text-[var(--gold)]" size={22} />
              لا توجد مبادئ قضائية بعد. تُستخرَج المبادئ من الأحكام القضائية وتُراجَع قبل اعتمادها، وستظهر هنا فور إضافتها.
            </div>
          )}

          {pageCount > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Link aria-disabled={page <= 1} className={`btn btn-outline ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/dashboard/legal-core/principles${qs({ page: page - 1 })}`}>
                السابق
              </Link>
              <span className="text-sm text-[var(--ink-60)]">صفحة {page.toLocaleString("ar-SA")} من {pageCount.toLocaleString("ar-SA")}</span>
              <Link aria-disabled={page >= pageCount} className={`btn btn-outline ${page >= pageCount ? "pointer-events-none opacity-40" : ""}`} href={`/dashboard/legal-core/principles${qs({ page: page + 1 })}`}>
                التالي
              </Link>
            </div>
          ) : null}
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
