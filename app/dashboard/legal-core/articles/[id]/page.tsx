import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FileText, Link2, Pencil, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import {
  ComparativeLawPanel,
  ExplanationPanel,
  LegalCitationBlock,
  LegalCoreCard,
  LegalCorePageHeader,
  LegalCoreShell,
  LegalTopicBadge,
  RelatedMaterialsPanel
} from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreArticlePage({ params, searchParams }: { params: { id: string }; searchParams?: { q?: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const article = await prisma.legalArticle.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!article) notFound();

  const related = await prisma.legalArticle.findMany({
    where: {
      id: { not: article.id },
      OR: [{ lawName: article.lawName }, article.classification ? { classification: article.classification } : { lawName: article.lawName }]
    },
    orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
    take: 6,
    select: { id: true, lawName: true, articleNumber: true, title: true }
  });

  const citation = `${article.lawName}طŒ ط§ظ„ظ…ط§ط¯ط© ${article.articleNumber}: ${article.content}`;
  const query = (searchParams?.q ?? "").trim();
  const matches = buildArticleMatches(article.content, query);

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title={`ط§ظ„ظ…ط§ط¯ط© ${article.articleNumber.toLocaleString("ar-SA")}`}
          description={`${article.lawName}${article.chapter ? ` | ${article.chapter}` : ""}`}
          actions={
            <>
              <LegalCopyButton text={article.content} label="ظ†ط³ط® ظ†طµ ط§ظ„ظ…ط§ط¯ط©" />
              <button className="btn btn-outline" type="button"><Pencil size={16} /> طھط­ط±ظٹط±</button>
              <Link className="btn btn-gold" href={`/dashboard/simulations?article=${article.id}`}><Scale size={16} /> ط§ط³طھط®ط¯ط§ظ… ظپظٹ ط§ظ„ظ‚ط§ط¶ظٹ ط­ظƒظٹظ…</Link>
              <Link className="btn ho-hero-outline" href={`/dashboard/consultations?article=${article.id}`}><FileText size={16} /> ط§ط³طھط®ط¯ط§ظ… ظپظٹ ط§ظ„ط§ط³طھط´ط§ط±ط©</Link>
            </>
          }
        />

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <article className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--parchment)] p-8 shadow-[var(--sh-md)]">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gold-border)] pb-5">
                <div>
                  <p className="font-mono-legal text-sm text-[var(--gold)]">{article.lawName}</p>
                  <h2 className="mt-2 font-judicial text-4xl font-bold text-[var(--navy)]">ط§ظ„ظ…ط§ط¯ط© {article.articleNumber.toLocaleString("ar-SA")}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LegalTopicBadge tone="emerald">{article.status || "ط³ط§ط±ظٹط©"}</LegalTopicBadge>
                  {article.classification ? <LegalTopicBadge>{article.classification}</LegalTopicBadge> : null}
                </div>
              </div>
              {article.chapter ? <p className="mb-4 font-display-ar text-sm font-semibold text-[var(--ink-60)]">{article.chapter}</p> : null}
              {query ? (
                <div className="mb-5 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
                  <p className="font-display-ar text-sm font-bold text-[var(--navy)]">
                    عدد المطابقات داخل المادة: {matches.count.toLocaleString("ar-SA")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="btn btn-outline" href="#match-1">المطابقة التالية</a>
                    <a className="btn btn-outline" href={`#match-${Math.max(matches.count, 1)}`}>المطابقة السابقة</a>
                  </div>
                </div>
              ) : null}
              <p className="font-judicial text-2xl leading-[2.3] text-[var(--ink)]">
                <ArticleTextWithMatches text={article.content} query={query} />
              </p>
            </article>

            <div className="grid gap-4 md:grid-cols-2">
              {["ط§ظ„ط´ط±ط­", "ط´ط±ظˆط· ط§ظ„طھط·ط¨ظٹظ‚", "ط§ظ„ط¢ط«ط§ط±", "ط§ظ„ط§ط³طھط«ظ†ط§ط،ط§طھ", "ط§ظ„ظ…ط³ط§ط¦ظ„ ط§ظ„ظ…ط±طھط¨ط·ط©", "ط§ظ„ط£ط­ظƒط§ظ… ط§ظ„ظ‚ط¶ط§ط¦ظٹط©", "ط§ظ„ظ…ط¨ط§ط¯ط¦", "ط§ظ„ظ‚ظˆط§ظ„ط¨ ط§ظ„ظ…ط±طھط¨ط·ط©"].map((section) => (
                <LegalCoreCard key={section} title={section}>
                  <p className="text-sm leading-7 text-[var(--ink-60)]">ظ„ظ… ظٹطھظ… ط¥ط«ط±ط§ط، ظ‡ط°ط§ ط§ظ„ظ‚ط³ظ… ط¨ط¹ط¯ ط¨ظ…ط­طھظˆظ‰ ظ…ط¹طھظ…ط¯. ظٹط¨ظ‚ظ‰ ظ†طµ ط§ظ„ظ…ط§ط¯ط© ظ‡ظˆ ط§ظ„ظ…طµط¯ط± ط§ظ„ظ†ط¸ط§ظ…ظٹ ط§ظ„ط£طµظ„ظٹ.</p>
                </LegalCoreCard>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <LegalCoreCard title="ط±ط£ط³ ط§ظ„ظ…ط§ط¯ط©" subtitle="ط¨ظٹط§ظ†ط§طھ طھط¹ط±ظٹظپظٹط© ط³ط±ظٹط¹ط©" icon={<BookOpen size={18} />}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">ط§ظ„ظ†ط¸ط§ظ…</dt><dd className="text-left font-semibold text-[var(--navy)]">{article.lawName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط©</dt><dd className="font-mono-legal text-[var(--gold)]">{article.articleNumber.toLocaleString("ar-SA")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">ط§ظ„طھطµظ†ظٹظپ</dt><dd>{article.classification ?? "ط؛ظٹط± ظ…ط­ط¯ط¯"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">طھط§ط±ظٹط® ط§ظ„ظ†ظپط§ط°</dt><dd>{article.effectiveFrom ? article.effectiveFrom.toLocaleDateString("ar-SA") : "ط؛ظٹط± ظ…ط¯ط®ظ„"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-outline" type="button"><Link2 size={16} /> ط±ط¨ط· ط¨ظ…ط³ط£ظ„ط©</button>
                <button className="btn btn-outline" type="button"><Scale size={16} /> ط±ط¨ط· ط¨ط­ظƒظ…</button>
              </div>
            </LegalCoreCard>

            <LegalCitationBlock lawName={article.lawName} articleNumber={article.articleNumber} content={article.content} />
            <ExplanationPanel />
            <ComparativeLawPanel />
            <RelatedMaterialsPanel articles={related} />
          </aside>
        </section>
      </div>
    </LegalCoreShell>
  );
}

function buildArticleMatches(text: string, query: string) {
  if (!query) return { count: 0 };
  const normalizedText = normalizeArabicText(text);
  const normalizedQuery = normalizeArabicText(query);
  if (!normalizedQuery) return { count: 0 };
  let count = 0;
  let index = normalizedText.indexOf(normalizedQuery);
  while (index >= 0) {
    count += 1;
    index = normalizedText.indexOf(normalizedQuery, index + normalizedQuery.length);
  }
  return { count };
}

function ArticleTextWithMatches({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const normalizedText = normalizeArabicText(text);
  const normalizedQuery = normalizeArabicText(query);
  const index = normalizedText.indexOf(normalizedQuery);
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark id="match-1" className="scroll-mt-28 rounded bg-[var(--gold-ghost)] px-1 text-[var(--navy)]">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

