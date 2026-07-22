import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { getSystemDetail } from "@/lib/modules/library/library-service";
import { LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

// شجرة عرض النظام: الفصول → المواد، مع فهرس جانبي للتنقّل السريع.
export default async function LegalSystemTreePage({ params }: { params: { id: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const detail = await getSystemDetail(decodeURIComponent(params.id)).catch(() => null);
  if (!detail || detail.articleCount === 0) notFound();

  const slug = (ch: string) => `ch-${ch.replace(/\s+/g, "-").slice(0, 40)}`;
  const multiChapter = detail.chapterCount > 1;

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          eyebrow="حكيم | شجرة النظام"
          title={detail.lawName}
          description={`${detail.classification ?? "تصنيف نظامي عام"} — عرض هرمي لمواد النظام مرتّبة، مع فهرس جانبي للتنقّل السريع.`}
          actions={
            <>
              <Link href="/dashboard/legal-core/systems" className="btn ho-hero-outline">
                <ArrowRight size={16} /> كل الأنظمة
              </Link>
              {TRADITIONAL_SEARCH_ENABLED ? (
                <Link href={`/dashboard/legal-search?q=${encodeURIComponent(detail.lawName)}`} className="btn btn-gold">
                  البحث داخل النظام
                </Link>
              ) : null}
            </>
          }
        />

        {/* مؤشرات */}
        <div className="flex flex-wrap gap-2">
          <LegalTopicBadge>{detail.articleCount.toLocaleString("ar-SA")} مادة</LegalTopicBadge>
          {multiChapter ? <LegalTopicBadge tone="emerald">{detail.chapterCount.toLocaleString("ar-SA")} فصل</LegalTopicBadge> : null}
          <LegalTopicBadge tone="emerald">ساري</LegalTopicBadge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* الفهرس الجانبي */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]">
              <h2 className="font-display-ar text-sm font-bold text-[var(--navy)]">فهرس النظام</h2>
              <nav className="mt-3 max-h-[70vh] space-y-1 overflow-auto pe-1">
                {detail.chapters.map((c) => (
                  <a
                    key={c.chapter}
                    href={`#${slug(c.chapter)}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--r-md)] px-2.5 py-1.5 text-sm text-[var(--ink-80)] transition hover:bg-[var(--gold-ghost)] hover:text-[var(--navy)]"
                  >
                    <span className="line-clamp-1">{c.chapter}</span>
                    <span className="shrink-0 font-mono-legal text-[11px] text-[var(--ink-40)] tabular-nums">{c.articles.length}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* الشجرة: فصول ومواد */}
          <div className="space-y-6">
            {detail.chapters.map((c) => (
              <section key={c.chapter} id={slug(c.chapter)} className="scroll-mt-4 rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
                <div className="flex items-center gap-2 border-b border-[var(--ink-08)] pb-3">
                  <BookOpen size={18} className="text-[var(--gold)]" />
                  <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">{c.chapter}</h3>
                  <span className="ms-auto font-mono-legal text-xs text-[var(--ink-40)] tabular-nums">{c.articles.length} مادة</span>
                </div>
                <ul className="mt-2 divide-y divide-[var(--ink-08)]">
                  {c.articles.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/legal-core/articles/${a.id}`}
                        className="flex items-start gap-3 rounded-[var(--r-md)] px-2 py-2.5 transition hover:bg-[var(--gold-ghost)]"
                      >
                        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-[var(--navy)] px-2 py-0.5 font-mono-legal text-[11px] text-[var(--gold-pale)] tabular-nums">
                          م {a.articleNumber.toLocaleString("ar-SA")}
                        </span>
                        <span className="font-display-ar text-sm leading-7 text-[var(--ink-80)]">{a.title}</span>
                        <FileText size={14} className="ms-auto mt-1 shrink-0 text-[var(--ink-40)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </LegalCoreShell>
  );
}
