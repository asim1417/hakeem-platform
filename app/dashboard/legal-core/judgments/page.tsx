import Link from "next/link";
import { BookMarked, ExternalLink, Gavel, Search } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";

export const dynamic = "force-dynamic";

type JudgmentPoolItem = {
  judgmentTitle: string | null;
  caseNo: string | null;
  decisionNo: string | null;
  decisionDate: Date | null;
  _count: { articleLinks: number };
};

// درجة الصلة: تطابق العنوان (أقوى) ثم رقم القضية/القرار، مضافًا إليها إشارة السلطة
// (عدد روابط المواد، مُدرَّجة لوغاريتمياً). تطابق النصّ وحده = 0 هنا فيبقى أدنى من العنوان.
function scoreJudgment(j: JudgmentPoolItem, q: string): number {
  let s = 0;
  if (j.judgmentTitle && j.judgmentTitle.includes(q)) s += 100;
  if ((j.caseNo && j.caseNo.includes(q)) || (j.decisionNo && j.decisionNo.includes(q))) s += 60;
  s += Math.round(15 * Math.log10(1 + j._count.articleLinks));
  return s;
}
function dateDesc(a: { decisionDate: Date | null }, b: { decisionDate: Date | null }): number {
  return (b.decisionDate?.getTime() ?? 0) - (a.decisionDate?.getTime() ?? 0);
}

export default async function LegalCoreJudgmentsPage({
  searchParams
}: {
  searchParams?: { q?: string; court?: string; city?: string; classification?: string; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const query = (searchParams?.q ?? "").trim();
  const court = (searchParams?.court ?? "").trim();
  const city = (searchParams?.city ?? "").trim();
  const classification = (searchParams?.classification ?? "").trim();
  const page = Math.max(Number(searchParams?.page ?? 1), 1);
  const limit = 24;

  const where = {
    AND: [
      query
        ? {
            OR: [
              { judgmentTitle: { contains: query, mode: "insensitive" as const } },
              { judgmentText: { contains: query, mode: "insensitive" as const } },
              { appealText: { contains: query, mode: "insensitive" as const } },
              { caseNo: { contains: query, mode: "insensitive" as const } },
              { decisionNo: { contains: query, mode: "insensitive" as const } }
            ]
          }
        : {},
      court ? { court: { contains: court, mode: "insensitive" as const } } : {},
      city ? { cityName: { contains: city, mode: "insensitive" as const } } : {},
      classification ? { classification: { path: ["classification"], string_contains: classification } } : {}
    ].filter((item) => Object.keys(item).length > 0)
  };

  // مرحلة ①: بركة مرشّحين خفيفة (بلا نصّ الحكم الثقيل) لترتيبها بالصلة عند وجود استعلام.
  // بلا استعلام = تصفّح: نُبقي الأحدث أولاً. السقف يكفي الصفحة الأولى (لا ترقيم عميق في الواجهة).
  // بلا استعلام = تصفّح: نجلب الصفحة فقط (الأحدث). مع استعلام: نجلب بركةً لنرتّبها بالصلة.
  const POOL = 480;
  const poolTake = query ? POOL : limit;
  const poolSkip = query ? 0 : (page - 1) * limit;
  const [total, pool, totalLinks, courts, cities] = await Promise.all([
    prisma.judicialCase.count({ where }).catch(() => 0),
    prisma.judicialCase
      .findMany({
        where,
        orderBy: [{ decisionDate: "desc" }, { createdAt: "desc" }],
        skip: poolSkip,
        take: poolTake,
        select: {
          id: true,
          judgmentTitle: true,
          caseNo: true,
          decisionNo: true,
          court: true,
          cityName: true,
          decisionDateText: true,
          decisionDate: true,
          reviewStatus: true,
          _count: { select: { articleLinks: true } }
        }
      })
      .catch(() => []),
    prisma.legalArticleCaseLink.count().catch(() => 0),
    prisma.judicialCase.findMany({ distinct: ["court"], select: { court: true }, where: { court: { not: null } }, take: 60 }).catch(() => []),
    prisma.judicialCase.findMany({ distinct: ["cityName"], select: { cityName: true }, where: { cityName: { not: null } }, take: 60 }).catch(() => [])
  ]);

  // الترتيب بالصلة عند وجود استعلام: تطابق العنوان/رقم القضية أولاً، ثم إشارة السلطة (عدد
  // روابط المواد = مركزية الحكم)، ثم الأحدث. تطابق النصّ وحده يبقى أدنى من تطابق العنوان.
  // مع استعلام: نرتّب البركة بالصلة ثم نقتطع الصفحة. بلا استعلام: البركة هي الصفحة أصلاً.
  const approximate = query.length > 0 && total > POOL;
  const judgments = query
    ? [...pool]
        .sort((a, b) => scoreJudgment(b, query) - scoreJudgment(a, query) || dateDesc(a, b))
        .slice((page - 1) * limit, (page - 1) * limit + limit)
    : pool;

  // مرحلة ②: نجلب نصّ الحكم الثقيل لصفّ الصفحة فقط (≤ limit) لبناء المعاينة.
  const textById = judgments.length
    ? new Map(
        (
          await prisma.judicialCase
            .findMany({ where: { id: { in: judgments.map((j) => j.id) } }, select: { id: true, judgmentText: true } })
            .catch(() => [] as Array<{ id: string; judgmentText: string }>)
        ).map((r) => [r.id, sanitizeDisplayText(r.judgmentText)])
      )
    : new Map<string, string>();

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="الأحكام القضائية والاستشهادات"
          description="مستودع الأحكام المستوردة من قاعدة وزارة العدل، مع ربط آلي مبدئي بالمواد النظامية في النواة القانونية. كل ربط يحتاج مراجعة قانونية قبل اعتماده."
          actions={
            <>
              <Link className="btn btn-gold" href="/dashboard/legal-core/search">
                <Search size={16} />
                البحث القانوني
              </Link>
              <Link className="btn ho-hero-outline" href="/dashboard/legal-core/citations/dashboard">
                <BookMarked size={16} />
                تغطية الربط
              </Link>
              <Link className="btn ho-hero-outline" href="/dashboard/legal-core">
                <BookMarked size={16} />
                النواة القانونية
              </Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-3">
          <LegalCoreStatCard label="الأحكام المطابقة" value={total} hint="وفق المرشحات الحالية" />
          <LegalCoreStatCard label="روابط المواد" value={totalLinks} hint="استشهادات مرتبطة بمواد نظامية" tone="emerald" />
          <LegalCoreStatCard label="حالة المراجعة" value="needs_review" hint="روابط الأحكام تحتاج تدقيقًا قانونيًا" tone="amber" />
        </section>

        <form action="/dashboard/legal-core/judgments" className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <label className="relative">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gold)]" />
              <input
                name="q"
                defaultValue={query}
                className="w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] py-3 pl-4 pr-12 leading-7 outline-none focus:border-[var(--gold)]"
                placeholder="ابحث في عنوان الحكم أو نص الحكم أو رقم القضية..."
              />
            </label>
            <select name="court" defaultValue={court} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              <option value="">كل المحاكم</option>
              {courts.map((item) => (item.court ? <option key={item.court} value={item.court}>{item.court}</option> : null))}
            </select>
            <select name="city" defaultValue={city} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
              <option value="">كل المدن</option>
              {cities.map((item) => (item.cityName ? <option key={item.cityName} value={item.cityName}>{item.cityName}</option> : null))}
            </select>
            <button className="btn btn-gold min-w-[140px]" type="submit">
              <Search size={16} />
              بحث
            </button>
          </div>
        </form>

        <LegalCoreCard title="قائمة الأحكام" subtitle={`${total.toLocaleString("ar-SA")} حكمًا مطابقًا${query ? " — مرتّبة بالصلة (العنوان ثم الاستشهادات ثم الأحدث)" : " — الأحدث أولاً"}`}>
          {approximate ? (
            <div className="mb-4">
              <LegalTopicBadge tone="amber">استعلام واسع — رُتِّب أحدث {POOL.toLocaleString("ar-SA")} حكمًا بالصلة</LegalTopicBadge>
            </div>
          ) : null}
          {judgments.length ? (
            <div className="space-y-4">
              {judgments.map((judgment) => (
                <article key={judgment.id} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-legal text-sm text-[var(--gold)]">
                        {judgment.caseNo ? `قضية ${judgment.caseNo}` : "قضية غير مرقمة"} | {judgment.decisionNo ? `قرار ${judgment.decisionNo}` : "قرار غير مدخل"}
                      </p>
                      <h2 className="mt-2 font-display-ar text-lg font-bold leading-8 text-[var(--navy)]">
                        {judgment.judgmentTitle ?? "حكم قضائي مستورد يحتاج تسمية"}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--ink-60)]">
                        {[judgment.court, judgment.cityName, judgment.decisionDateText].filter(Boolean).join(" | ") || "بيانات المحكمة غير مكتملة"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <LegalTopicBadge tone="amber">{judgment.reviewStatus}</LegalTopicBadge>
                      <LegalTopicBadge tone={judgment._count.articleLinks ? "emerald" : "gold"}>
                        {judgment._count.articleLinks.toLocaleString("ar-SA")} رابط مادة
                      </LegalTopicBadge>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/55 p-4 font-judicial text-lg leading-9 text-[var(--ink)]">
                    {textById.get(judgment.id) ?? ""}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link className="btn btn-gold" href={`/dashboard/legal-core/judgments/${judgment.id}`}>
                      <ExternalLink size={16} />
                      فتح الحكم
                    </Link>
                    <Link className="btn btn-outline" href={`/dashboard/legal-core/search?q=${encodeURIComponent(query || judgment.judgmentTitle || judgment.caseNo || "")}&sourceType=judgment`}>
                      <Gavel size={16} />
                      البحث حول الحكم
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-6 text-center font-display-ar text-[var(--navy)]">
              لا توجد أحكام قضائية مستوردة مطابقة في قاعدة البيانات الحالية.
            </div>
          )}
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
