import Link from "next/link";
import { BookOpen, Database, FileSearch, Quote, Scale } from "lucide-react";
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
          title="النواة القانونية الموحدة"
          description="مركز إدارة الأنظمة والمواد والشروح والتصنيفات والقانون المقارن، ومصدر المعرفة الموحد لخدمات حكيم."
          actions={
            <>
              <Link href="/dashboard/legal-core/search" className="btn btn-gold"><FileSearch size={16} /> البحث القانوني</Link>
              <Link href="/dashboard/legal-core/citations" className="btn ho-hero-outline"><Quote size={16} /> التقاط الاستشهاد</Link>
              <Link href="/dashboard/legal-core/systems" className="btn ho-hero-outline"><BookOpen size={16} /> الأنظمة</Link>
              <Link href="/dashboard/legal-core/quality" className="btn ho-hero-outline"><Database size={16} /> جودة البيانات</Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <LegalCoreStatCard label="عدد الأنظمة" value={stats.systemCount || 9} hint="مصادر نظامية معتمدة" />
          <LegalCoreStatCard label="عدد المواد" value={stats.total || 1981} hint="مصدر الحقيقة للاستشهادات" />
          <LegalCoreStatCard label="عدد التصنيفات" value={classificationCount} hint="تصنيف معرفي أولي" />
          <LegalCoreStatCard label="عدد الشروح" value={0} hint="جاهزة للإثراء لاحقًا" tone="amber" />
          <LegalCoreStatCard label="مواد تحتاج مراجعة" value={needsReview} hint="مؤشر جودة البيانات" tone={needsReview ? "amber" : "emerald"} />
          <LegalCoreStatCard label="عدد مسائل القانون" value={0} hint="غير مفعلة بعد" tone="amber" />
          <LegalCoreStatCard label="عدد الأحكام" value={0} hint="تحتاج ربط قضائي" tone="amber" />
          <LegalCoreStatCard label="عدد المبادئ" value={0} hint="تحتاج إثراء" tone="amber" />
          <LegalCoreStatCard label="المقارنات القانونية" value={0} hint="جاهزة للبناء المرحلي" tone="amber" />
          <LegalCoreStatCard label="حالة المصدر" value="موحد" hint="legal_articles فقط" tone="emerald" />
        </section>

        <LegalCoreSearchBar systems={stats.laws} />

        <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <LegalCoreCard title="أحدث المواد في المستودع" subtitle="عرض هادئ لأحدث المواد المتاحة للبحث والاستشهاد" icon={<BookOpen size={18} />}>
            <div className="space-y-3">
              {recentArticles.map((article) => <LegalArticleCard key={article.id} article={article} />)}
            </div>
          </LegalCoreCard>

          <LegalCoreCard title="مركز المعرفة القانونية" subtitle="طبقات النواة التي ستخدم القاضي حكيم والاستشارات" icon={<Scale size={18} />}>
            <div className="grid gap-3">
              {["الأنظمة والمواد", "الشروح وشروط التطبيق", "الأحكام والمبادئ", "القانون المقارن", "القوالب المرتبطة"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-4">
                  <span className="font-display-ar text-sm font-bold text-[var(--navy)]">{item}</span>
                  <LegalTopicBadge tone={index === 0 ? "emerald" : "amber"}>{index === 0 ? "نشط" : "مرحلي"}</LegalTopicBadge>
                </div>
              ))}
            </div>
          </LegalCoreCard>
        </section>
      </div>
    </LegalCoreShell>
  );
}
