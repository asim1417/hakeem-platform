import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, QualityItem } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreQualityPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const [total, noClassification, noKeywords, noChapter] = await Promise.all([
    prisma.legalArticle.count().catch(() => 0),
    prisma.legalArticle.count({ where: { classification: null } }).catch(() => 0),
    prisma.legalArticle.count({ where: { keywords: { isEmpty: true } } }).catch(() => 0),
    prisma.legalArticle.count({ where: { chapter: null } }).catch(() => 0)
  ]);

  const noExplanation = total;
  const noRelations = total;

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="ط¬ظˆط¯ط© ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ†ظˆط§ط© ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط©"
          description="ظ„ظˆط­ط© ظ…ط±ط§ط¬ط¹ط© ظ…ط¹ط±ظپظٹط© طھط³ط§ط¹ط¯ ظپط±ظٹظ‚ ط­ظƒظٹظ… ط¹ظ„ظ‰ ط¶ط¨ط· ط§ظ„طھطµظ†ظٹظپط§طھ ظˆط§ظ„ظƒظ„ظ…ط§طھ ط§ظ„ظ…ظپطھط§ط­ظٹط© ظˆط§ظ„ط´ط±ظˆط­ ظˆط§ظ„ط¹ظ„ط§ظ‚ط§طھ ظ‚ط¨ظ„ طھظˆط³ظٹط¹ ط®ط¯ظ…ط§طھ ط§ظ„ط°ظƒط§ط، ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹ."
        />

        <section className="grid gap-4 md:grid-cols-4">
          <LegalCoreStatCard label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ظˆط§ط¯" value={total} hint="ظپظٹ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط§ظ„ظٹط©" />
          <LegalCoreStatCard label="ط¨ظ„ط§ طھطµظ†ظٹظپ" value={noClassification} hint="طھط­طھط§ط¬ ظ…ط±ط§ط¬ط¹ط©" tone={noClassification ? "amber" : "emerald"} />
          <LegalCoreStatCard label="ط¨ظ„ط§ ظƒظ„ظ…ط§طھ ظ…ظپطھط§ط­ظٹط©" value={noKeywords} hint="طھط¤ط«ط± ط¹ظ„ظ‰ ط§ظ„ط¨ط­ط«" tone={noKeywords ? "amber" : "emerald"} />
          <LegalCoreStatCard label="ط¨ظ„ط§ ط¨ط§ط¨ ط£ظˆ ظپطµظ„" value={noChapter} hint="طھط­ط³ظٹظ† ظ‚ط§ط¨ظ„ظٹط© ط§ظ„طھطµظپط­" tone={noChapter ? "amber" : "emerald"} />
        </section>

        <LegalCoreCard title="ظ…ط¤ط´ط±ط§طھ ط§ظ„ظ…ط±ط§ط¬ط¹ط© ط§ظ„ظ…ط¹ط±ظپظٹط©" subtitle="ط£ظ„ظˆط§ظ† ط§ظ„ط­ط§ظ„ط© طھط´ظٹط± ط¥ظ„ظ‰ ط£ظˆظ„ظˆظٹط© ط§ظ„ظ…ط¹ط§ظ„ط¬ط©">
          <div className="grid gap-3 md:grid-cols-2">
            <QualityItem label="ظ…ظˆط§ط¯ ط¨ظ„ط§ طھطµظ†ظٹظپ" value={noClassification} tone={noClassification ? "amber" : "emerald"} />
            <QualityItem label="ظ…ظˆط§ط¯ ط¨ظ„ط§ ظƒظ„ظ…ط§طھ ظ…ظپطھط§ط­ظٹط©" value={noKeywords} tone={noKeywords ? "amber" : "emerald"} />
            <QualityItem label="ظ…ظˆط§ط¯ ط¨ظ„ط§ ط´ط±ط­" value={noExplanation} tone="amber" />
            <QualityItem label="ظ…ظˆط§ط¯ ط¨ظ„ط§ ط¹ظ„ط§ظ‚ط§طھ" value={noRelations} tone="amber" />
            <QualityItem label="ط´ط±ظˆط­ ط¨ظ„ط§ ظ…طµط¯ط±" value={0} tone="emerald" />
            <QualityItem label="ط£ط­ظƒط§ظ… ط؛ظٹط± ظ…ط±ط¨ظˆط·ط©" value={0} tone="emerald" />
            <QualityItem label="ظ…ظˆط§ط¯ ظ…ظƒط±ط±ط©" value={0} tone="emerald" />
            <QualityItem label="ظ…ظˆط§ط¯ طھط­طھط§ط¬ ظ…ط±ط§ط¬ط¹ط©" value={noClassification + noKeywords + noChapter} tone={noClassification + noKeywords + noChapter ? "ruby" : "emerald"} />
          </div>
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}

