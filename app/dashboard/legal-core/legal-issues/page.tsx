import Link from "next/link";
import { Scale, ArrowRight, BookOpen } from "lucide-react";
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
  getSectionBooks,
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
  searchParams?: { section?: string; book?: string; page?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const overview = getLegalIssuesOverview();
  const activeSection = searchParams?.section ?? overview.sections[0]?.slug;
  const activeBook = searchParams?.book;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  return (
    <LegalCoreShell>
      <div className="space-y-6">
        <LegalCorePageHeader
          title="المسائل القانونية"
          description="فهرس المسائل القانونية مربوطة بمواد الأنظمة السعودية الحقيقية — قيد المراجعة قبل الاعتماد."
          actions={
            <Link href="/dashboard/legal-core" className="btn ho-hero-outline">
              <ArrowRight size={16} /> النواة القانونية
            </Link>
          }
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <LegalCoreStatCard label="إجمالي المسائل" value={overview.total} hint="مربوطة بالأنظمة" />
          <LegalCoreStatCard label="مطابقة عالية" value={overview.byStatus.linked ?? 0} hint="النظام يحوي أفضل مطابقة" tone="emerald" />
          <LegalCoreStatCard label="تحتاج مراجعة" value={(overview.byStatus.needs_review ?? 0) + (overview.byStatus.review_nizam ?? 0)} hint="قيد المراجعة" tone="amber" />
          <LegalCoreStatCard label="غير مقنّنة" value={overview.byStatus.uncodified_sharia ?? 0} hint="بلا مادة نظامية" tone="amber" />
        </section>

        {/* تخطيط الفهرس: عمود فهرس (يمين) + عمود المحتوى */}
        <section className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <IndexColumn sections={overview.sections} activeSection={activeSection} activeBook={activeBook} />
          <SectionList slug={activeSection} book={activeBook} page={page} />
        </section>
      </div>
    </LegalCoreShell>
  );
}

function IndexColumn({
  sections,
  activeSection,
  activeBook
}: {
  sections: { slug: string; title: string; count: number; linked: number }[];
  activeSection?: string;
  activeBook?: string;
}) {
  return (
    <aside className="self-start xl:sticky xl:top-6">
      <LegalCoreCard title="الفهرس" subtitle="الأقسام والكتب" icon={<BookOpen size={18} />}>
        <nav className="space-y-1">
          {sections.map((s) => {
            const isActive = s.slug === activeSection;
            const books = isActive ? getSectionBooks(s.slug) : [];
            return (
              <div key={s.slug}>
                <Link
                  href={`/dashboard/legal-core/legal-issues?section=${s.slug}`}
                  className={`flex items-center justify-between rounded-[var(--r-md)] px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[var(--gold-ghost)] font-bold text-[var(--navy)]" : "text-[var(--ink-70)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <span className="font-display-ar">{s.title}</span>
                  <span className="font-mono-legal text-[0.7rem] text-[var(--ink-60)]">{s.count.toLocaleString("ar-SA")}</span>
                </Link>
                {isActive ? (
                  <div className="my-1 mr-3 space-y-[2px] border-r border-[var(--gold-border)] pr-2">
                    {books.map((b) => {
                      const on = b.book === activeBook;
                      return (
                        <Link
                          key={b.book}
                          href={`/dashboard/legal-core/legal-issues?section=${s.slug}&book=${encodeURIComponent(b.book)}`}
                          className={`flex items-center justify-between rounded-[var(--r-sm)] px-2 py-[6px] text-[0.8rem] transition-colors ${
                            on ? "bg-[var(--navy)] text-white" : "text-[var(--ink-60)] hover:bg-[var(--gold-ghost)] hover:text-[var(--navy)]"
                          }`}
                        >
                          <span className="truncate">{b.book}</span>
                          <span className={`font-mono-legal text-[0.65rem] ${on ? "text-white/80" : "text-[var(--ink-50)]"}`}>
                            {b.count.toLocaleString("ar-SA")}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </LegalCoreCard>
    </aside>
  );
}

async function SectionList({ slug, book, page }: { slug?: string; book?: string; page: number }) {
  if (!slug) {
    return (
      <LegalCoreCard title="اختر قسماً">
        <p className="text-sm text-[var(--ink-60)]">اختر قسماً من الفهرس لعرض مسائله.</p>
      </LegalCoreCard>
    );
  }
  const { title, total, pageSize, items } = getLegalIssuesBySection(slug, page, 50, book);
  if (!total) {
    return (
      <LegalCoreCard title="القسم">
        <p className="text-sm text-[var(--ink-60)]">لا توجد مسائل لهذا الاختيار.</p>
      </LegalCoreCard>
    );
  }
  const articleIds = await resolveArticleIds(items);
  const pages = Math.ceil(total / pageSize);
  const base = `/dashboard/legal-core/legal-issues?section=${slug}${book ? `&book=${encodeURIComponent(book)}` : ""}`;

  return (
    <LegalCoreCard
      title={book ? `${title} ‹ ${book}` : title}
      subtitle={`${total.toLocaleString("ar-SA")} مسألة · صفحة ${page.toLocaleString("ar-SA")} من ${pages.toLocaleString("ar-SA")}${book ? "" : " · كل القسم"}`}
      icon={<Scale size={18} />}
    >
      <ol className="space-y-2">
        {items.map((issue, i) => {
          const id = issue.topArticle ? articleIds.get(`${issue.topArticle.lawName}|${issue.topArticle.articleNumber}`) : undefined;
          const order = (page - 1) * pageSize + i + 1;
          return (
            <li key={issue.issueId} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display-ar text-sm font-bold text-[var(--navy)]">
                  <span className="ml-2 font-mono-legal text-[0.7rem] text-[var(--ink-50)]">{order.toLocaleString("ar-SA")}.</span>
                  {issue.title}
                </p>
                <LegalTopicBadge tone={STATUS_TONE[issue.linkStatus] ?? "amber"}>
                  {STATUS_LABEL[issue.linkStatus] ?? issue.linkStatus}
                </LegalTopicBadge>
              </div>
              {issue.topArticle ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[var(--ink-60)]">المادة:</span>
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
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-center justify-between">
        <Link className={`btn btn-outline ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`${base}&page=${page - 1}`}>
          السابق
        </Link>
        <span className="font-mono-legal text-xs text-[var(--ink-60)]">
          {page.toLocaleString("ar-SA")} / {pages.toLocaleString("ar-SA")}
        </span>
        <Link className={`btn btn-outline ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={`${base}&page=${page + 1}`}>
          التالي
        </Link>
      </div>
    </LegalCoreCard>
  );
}
