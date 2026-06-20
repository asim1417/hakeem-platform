import Link from "next/link";
import { Scale, ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import {
  LegalCoreCard,
  LegalCorePageHeader,
  LegalCoreShell,
  LegalCoreStatCard,
  LegalTopicBadge
} from "@/components/legal-core";
import {
  getLegalIssuesOverview,
  getLegalIssuesBySection,
  type LegalIssueItem
} from "@/lib/modules/legal-core/legal-issues";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  linked: "مطابقة عالية",
  needs_review: "مراجعة",
  review_nizam: "مراجعة النظام",
  uncodified_sharia: "حكم شرعي غير مقنّن"
};
const STATUS_TONE: Record<string, "emerald" | "amber"> = {
  linked: "emerald",
  needs_review: "amber",
  review_nizam: "amber",
  uncodified_sharia: "amber"
};

async function resolveArticleIds(items: LegalIssueItem[]): Promise<Map<string, string>> {
  const pairs = items
    .filter((i) => i.topArticle)
    .map((i) => ({ lawName: i.topArticle!.lawName, articleNumber: i.topArticle!.articleNumber }));
  if (!pairs.length) return new Map();
  const rows = await prisma.legalArticle
    .findMany({ where: { OR: pairs }, select: { id: true, lawName: true, articleNumber: true } })
    .catch(() => [] as { id: string; lawName: string; articleNumber: number }[]);
  return new Map(rows.map((r) => [`${r.lawName}|${r.articleNumber}`, r.id]));
}

export default async function LegalIssuesPage({
  searchParams
}: {
  searchParams?: { section?: string; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const overview = getLegalIssuesOverview();
  const section = searchParams?.section;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="المسائل القانونية"
          description="مسائل قانونية مستخرجة ومربوطة بمواد الأنظمة السعودية الحقيقية — قيد المراجعة قبل الاعتماد."
          actions={
            <Link href="/dashboard/legal-core" className="btn ho-hero-outline">
              <ArrowRight size={16} /> النواة القانونية
            </Link>
          }
        />

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <LegalCoreStatCard label="إجمالي المسائل" value={overview.total} hint="من الموسوعة، مربوطة بالأنظمة" />
          <LegalCoreStatCard label="مطابقة عالية" value={overview.byStatus.linked ?? 0} hint="النظام يحوي أفضل مطابقة" tone="emerald" />
          <LegalCoreStatCard label="تحتاج مراجعة" value={(overview.byStatus.needs_review ?? 0) + (overview.byStatus.review_nizam ?? 0)} hint="مطابقة/تعيين قيد المراجعة" tone="amber" />
          <LegalCoreStatCard label="أحكام غير مقنّنة" value={overview.byStatus.uncodified_sharia ?? 0} hint="بلا مادة نظامية مباشرة" tone="amber" />
          <LegalCoreStatCard label="الأقسام" value={overview.sections.length} hint="أقسام المسائل القانونية" />
        </section>

        {/* الأقسام */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.sections.map((s) => (
            <Link key={s.slug} href={`/dashboard/legal-core/legal-issues?section=${s.slug}`} className="block">
              <LegalCoreCard
                title={s.title}
                subtitle={`${s.count.toLocaleString("ar-SA")} مسألة · ${s.linked.toLocaleString("ar-SA")} مطابقة عالية`}
                icon={<Scale size={18} />}
              >
                <div className="flex items-center justify-between">
                  <LegalTopicBadge tone={section === s.slug ? "emerald" : "amber"}>
                    {section === s.slug ? "معروض" : "تصفّح"}
                  </LegalTopicBadge>
                  <span className="font-mono-legal text-xs text-[var(--ink-60)]">
                    {Math.round((s.linked / Math.max(s.count, 1)) * 100)}٪ مطابقة عالية
                  </span>
                </div>
              </LegalCoreCard>
            </Link>
          ))}
        </section>

        {/* قائمة مسائل القسم المختار */}
        {section ? <SectionList slug={section} page={page} /> : null}
      </div>
    </LegalCoreShell>
  );
}

async function SectionList({ slug, page }: { slug: string; page: number }) {
  const { title, total, pageSize, items } = getLegalIssuesBySection(slug, page);
  if (!total) {
    return (
      <LegalCoreCard title="القسم">
        <p className="text-sm text-[var(--ink-60)]">لا توجد مسائل في هذا القسم.</p>
      </LegalCoreCard>
    );
  }
  const articleIds = await resolveArticleIds(items);
  const pages = Math.ceil(total / pageSize);
  const base = `/dashboard/legal-core/legal-issues?section=${slug}`;

  return (
    <LegalCoreCard
      title={`مسائل: ${title}`}
      subtitle={`${total.toLocaleString("ar-SA")} مسألة · صفحة ${page.toLocaleString("ar-SA")} من ${pages.toLocaleString("ar-SA")}`}
      icon={<Scale size={18} />}
    >
      <div className="space-y-2">
        {items.map((issue) => {
          const id = issue.topArticle ? articleIds.get(`${issue.topArticle.lawName}|${issue.topArticle.articleNumber}`) : undefined;
          return (
            <div key={issue.issueId} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display-ar text-sm font-bold text-[var(--navy)]">{issue.title}</p>
                <LegalTopicBadge tone={STATUS_TONE[issue.linkStatus] ?? "amber"}>
                  {STATUS_LABEL[issue.linkStatus] ?? issue.linkStatus}
                </LegalTopicBadge>
              </div>
              <p className="mt-1 font-mono-legal text-[0.7rem] text-[var(--ink-60)]">
                {[issue.book, issue.chapter].filter(Boolean).join(" > ")}
              </p>
              {issue.topArticle ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[var(--ink-60)]">المادة المرتبطة:</span>
                  {id ? (
                    <Link href={`/dashboard/legal-core/articles/${id}`} className="font-mono-legal text-xs text-[var(--gold)] hover:underline">
                      {issue.topArticle.citation}
                    </Link>
                  ) : (
                    <span className="font-mono-legal text-xs text-[var(--gold)]">{issue.topArticle.citation}</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-60)]">حكم شرعي غير مقنّن — بلا مادة نظامية مباشرة.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link
          className={`btn btn-outline ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          href={`${base}&page=${page - 1}`}
        >
          السابق
        </Link>
        <span className="font-mono-legal text-xs text-[var(--ink-60)]">
          {page.toLocaleString("ar-SA")} / {pages.toLocaleString("ar-SA")}
        </span>
        <Link
          className={`btn btn-outline ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
          href={`${base}&page=${page + 1}`}
        >
          التالي
        </Link>
      </div>
    </LegalCoreCard>
  );
}
