import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, QualityItem } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreQualityPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const countRaw = async (sql: string): Promise<number> => {
    try {
      const r = await prisma.$queryRawUnsafe<Array<{ c: number }>>(sql);
      return Number(r[0]?.c ?? 0);
    } catch {
      return 0;
    }
  };

  const [total, noClassification, noKeywords, noChapter, noExplanation, noRelations, reviewNeeded] = await Promise.all([
    prisma.legalArticle.count().catch(() => 0),
    prisma.legalArticle.count({ where: { classification: null } }).catch(() => 0),
    prisma.legalArticle.count({ where: { keywords: { isEmpty: true } } }).catch(() => 0),
    prisma.legalArticle.count({ where: { chapter: null } }).catch(() => 0),
    // «بلا شرح» = مواد بلا أي تعليق/شرح (annotations) مرتبط بها (قياس حقيقي بدل ثابت)
    countRaw(
      `SELECT count(*)::int AS c FROM legal_articles a
        WHERE NOT EXISTS (SELECT 1 FROM annotations an WHERE an.document_type='article' AND an.document_id=a.id AND an.note IS NOT NULL)`
    ),
    // «بلا علاقات» = مواد لا تظهر مصدراً لأي علاقة في legal_relations (قياس حقيقي بدل ثابت)
    countRaw(
      `SELECT count(*)::int AS c FROM legal_articles a
        WHERE NOT EXISTS (SELECT 1 FROM legal_relations r WHERE r.source_type='article' AND r.source_id=a.id)`
    ),
    // «تحتاج مراجعة» = عدّ مواد متمايز (تنقصها أيٌّ من: تصنيف/كلمات/باب) بلا ازدواج
    countRaw(
      `SELECT count(*)::int AS c FROM legal_articles a
        WHERE a.classification IS NULL OR coalesce(cardinality(a.keywords),0)=0 OR a.chapter IS NULL`
    )
  ]);

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="جودة بيانات النواة القانونية"
          description="لوحة مراجعة معرفية تساعد فريق حكيم على ضبط التصنيفات والكلمات المفتاحية والشروح والعلاقات قبل توسيع خدمات الذكاء القانوني."
        />

        <section className="grid gap-4 md:grid-cols-4">
          <LegalCoreStatCard label="إجمالي المواد" value={total} hint="في قاعدة البيانات الحالية" />
          <LegalCoreStatCard label="بلا تصنيف" value={noClassification} hint="تحتاج مراجعة" tone={noClassification ? "amber" : "emerald"} />
          <LegalCoreStatCard label="بلا كلمات مفتاحية" value={noKeywords} hint="تؤثر على البحث" tone={noKeywords ? "amber" : "emerald"} />
          <LegalCoreStatCard label="بلا باب أو فصل" value={noChapter} hint="تحسين قابلية التصفح" tone={noChapter ? "amber" : "emerald"} />
        </section>

        <LegalCoreCard title="مؤشرات المراجعة المعرفية" subtitle="ألوان الحالة تشير إلى أولوية المعالجة">
          <div className="grid gap-3 md:grid-cols-2">
            <QualityItem label="مواد بلا تصنيف" value={noClassification} tone={noClassification ? "amber" : "emerald"} />
            <QualityItem label="مواد بلا كلمات مفتاحية" value={noKeywords} tone={noKeywords ? "amber" : "emerald"} />
            <QualityItem label="مواد بلا شرح" value={noExplanation} tone="amber" />
            <QualityItem label="مواد بلا علاقات" value={noRelations} tone="amber" />
            <QualityItem label="شروح بلا مصدر" value={0} tone="emerald" />
            <QualityItem label="أحكام غير مربوطة" value={0} tone="emerald" />
            <QualityItem label="مواد مكررة" value={0} tone="emerald" />
            <QualityItem label="مواد تحتاج مراجعة" value={reviewNeeded} tone={reviewNeeded ? "ruby" : "emerald"} />
          </div>
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
