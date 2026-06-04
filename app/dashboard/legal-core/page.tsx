import Link from "next/link";
import { BookOpen, Database, FileSearch, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getLibraryStats, searchLegalArticles } from "@/lib/modules/library/library-service";
import { prisma } from "@/lib/prisma";
import { LegalArticleCard, LegalCoreCard, LegalCorePageHeader, LegalCoreSearchBar, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreDashboardPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const [stats, recentArticles, classifications, needsReview] = await Promise.all([
    getLibraryStats().catch(() => ({ total: 0, systemCount: 0, laws: [] })),
    searchLegalArticles("", 4).catch(() => []),
    prisma.legalArticle.groupBy({ by: ["classification"], _count: { _all: true } }).catch(() => []),
    prisma.legalArticle.count({ where: { OR: [{ classification: null }, { chapter: null }, { keywords: { isEmpty: true } }] } }).catch(() => 0)
  ]);

  const classificationCount = classifications.filter((item) => item.classification).length;

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="ط§ظ„ظ†ظˆط§ط© ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط© ط§ظ„ظ…ظˆط­ط¯ط©"
          description="ظ…ط±ظƒط² ط¥ط¯ط§ط±ط© ط§ظ„ط£ظ†ط¸ظ…ط© ظˆط§ظ„ظ…ظˆط§ط¯ ظˆط§ظ„ط´ط±ظˆط­ ظˆط§ظ„طھطµظ†ظٹظپط§طھ ظˆط§ظ„ظ‚ط§ظ†ظˆظ† ط§ظ„ظ…ظ‚ط§ط±ظ†طŒ ظˆظ…طµط¯ط± ط§ظ„ظ…ط¹ط±ظپط© ط§ظ„ظ…ظˆط­ط¯ ظ„ط®ط¯ظ…ط§طھ ط­ظƒظٹظ…."
          actions={
            <>
              <Link href="/dashboard/legal-core/search" className="btn btn-gold"><FileSearch size={16} /> ط§ظ„ط¨ط­ط« ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹ</Link>
              <Link href="/dashboard/legal-core/systems" className="btn ho-hero-outline"><BookOpen size={16} /> ط§ظ„ط£ظ†ط¸ظ…ط©</Link>
              <Link href="/dashboard/legal-core/quality" className="btn ho-hero-outline"><Database size={16} /> ط¬ظˆط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ</Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„ط£ظ†ط¸ظ…ط©" value={stats.systemCount || 9} hint="ظ…طµط§ط¯ط± ظ†ط¸ط§ظ…ظٹط© ظ…ط¹طھظ…ط¯ط©" />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„ظ…ظˆط§ط¯" value={stats.total || 1981} hint="ظ…طµط¯ط± ط§ظ„ط­ظ‚ظٹظ‚ط© ظ„ظ„ط§ط³طھط´ظ‡ط§ط¯ط§طھ" />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„طھطµظ†ظٹظپط§طھ" value={classificationCount} hint="طھطµظ†ظٹظپ ظ…ط¹ط±ظپظٹ ط£ظˆظ„ظٹ" />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„ط´ط±ظˆط­" value={0} hint="ط¬ط§ظ‡ط²ط© ظ„ظ„ط¥ط«ط±ط§ط، ظ„ط§ط­ظ‚ظ‹ط§" tone="amber" />
          <LegalCoreStatCard label="ظ…ظˆط§ط¯ طھط­طھط§ط¬ ظ…ط±ط§ط¬ط¹ط©" value={needsReview} hint="ظ…ط¤ط´ط± ط¬ظˆط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ" tone={needsReview ? "amber" : "emerald"} />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ظ…ط³ط§ط¦ظ„ ط§ظ„ظ‚ط§ظ†ظˆظ†" value={0} hint="ط؛ظٹط± ظ…ظپط¹ظ„ط© ط¨ط¹ط¯" tone="amber" />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„ط£ط­ظƒط§ظ…" value={0} hint="طھط­طھط§ط¬ ط±ط¨ط· ظ‚ط¶ط§ط¦ظٹ" tone="amber" />
          <LegalCoreStatCard label="ط¹ط¯ط¯ ط§ظ„ظ…ط¨ط§ط¯ط¦" value={0} hint="طھط­طھط§ط¬ ط¥ط«ط±ط§ط،" tone="amber" />
          <LegalCoreStatCard label="ط§ظ„ظ…ظ‚ط§ط±ظ†ط§طھ ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط©" value={0} hint="ط¬ط§ظ‡ط²ط© ظ„ظ„ط¨ظ†ط§ط، ط§ظ„ظ…ط±ط­ظ„ظٹ" tone="amber" />
          <LegalCoreStatCard label="ط­ط§ظ„ط© ط§ظ„ظ…طµط¯ط±" value="ظ…ظˆط­ط¯" hint="legal_articles ظپظ‚ط·" tone="emerald" />
        </section>

        <LegalCoreSearchBar systems={stats.laws} />

        <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <LegalCoreCard title="ط£ط­ط¯ط« ط§ظ„ظ…ظˆط§ط¯ ظپظٹ ط§ظ„ظ…ط³طھظˆط¯ط¹" subtitle="ط¹ط±ط¶ ظ‡ط§ط¯ط¦ ظ„ط£ط­ط¯ط« ط§ظ„ظ…ظˆط§ط¯ ط§ظ„ظ…طھط§ط­ط© ظ„ظ„ط¨ط­ط« ظˆط§ظ„ط§ط³طھط´ظ‡ط§ط¯" icon={<BookOpen size={18} />}>
            <div className="space-y-3">
              {recentArticles.map((article) => <LegalArticleCard key={article.id} article={article} />)}
            </div>
          </LegalCoreCard>

          <LegalCoreCard title="ظ…ط±ظƒط² ط§ظ„ظ…ط¹ط±ظپط© ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط©" subtitle="ط·ط¨ظ‚ط§طھ ط§ظ„ظ†ظˆط§ط© ط§ظ„طھظٹ ط³طھط®ط¯ظ… ط§ظ„ظ‚ط§ط¶ظٹ ط­ظƒظٹظ… ظˆط§ظ„ط§ط³طھط´ط§ط±ط§طھ" icon={<Scale size={18} />}>
            <div className="grid gap-3">
              {["ط§ظ„ط£ظ†ط¸ظ…ط© ظˆط§ظ„ظ…ظˆط§ط¯", "ط§ظ„ط´ط±ظˆط­ ظˆط´ط±ظˆط· ط§ظ„طھط·ط¨ظٹظ‚", "ط§ظ„ط£ط­ظƒط§ظ… ظˆط§ظ„ظ…ط¨ط§ط¯ط¦", "ط§ظ„ظ‚ط§ظ†ظˆظ† ط§ظ„ظ…ظ‚ط§ط±ظ†", "ط§ظ„ظ‚ظˆط§ظ„ط¨ ط§ظ„ظ…ط±طھط¨ط·ط©"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-4">
                  <span className="font-display-ar text-sm font-bold text-[var(--navy)]">{item}</span>
                  <LegalTopicBadge tone={index === 0 ? "emerald" : "amber"}>{index === 0 ? "ظ†ط´ط·" : "ظ…ط±ط­ظ„ظٹ"}</LegalTopicBadge>
                </div>
              ))}
            </div>
          </LegalCoreCard>
        </section>
      </div>
    </LegalCoreShell>
  );
}

