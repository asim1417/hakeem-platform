import Link from "next/link";
import { BookOpen, Database, FileSearch, Gavel, Quote, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { canUser } from "@/lib/modules/auth/rbac";
import { getLibraryStats, searchLegalArticles } from "@/lib/modules/library/library-service";
import { LegalArticleCard, LegalCoreCard, LegalCorePageHeader, LegalCoreSearchBar, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";
import { MetricTile } from "@/components/legal-core/LegalMetricsPanel";
import { LegalCoreTabs } from "@/components/legal-core/LegalCoreTabs";
import { ReindexButton } from "@/components/legal-core/ReindexButton";
import { CoreIntelligenceDashboard } from "@/components/CoreIntelligenceDashboard";
import { getLegalMetrics } from "@/lib/modules/legal-core/metrics-server";
import { metric, type MetricId } from "@/lib/modules/legal-core/metrics";

export const dynamic = "force-dynamic";

// العدّادات من legalMetricsService (HKM-023-A ل٠-١)، بالتعريفات نفسها في /quality و/admin.
const TILES: MetricId[] = [
  "systems.total",
  "articles.total",
  "articles.classifications",
  "explanations.total",
  "articles.needsReview",
  "issues.total",
  "judgments.total",
  "principles.total",
  "articles.decreeFilled"
];

export default async function LegalCoreDashboardPage() {
  const currentUser = await requirePagePermission("LEGAL_CORE_VIEW");
  const canManage = await canUser(currentUser.id, "LEGAL_CORE_ADMIN");

  const [stats, recentArticles, snapshot] = await Promise.all([
    getLibraryStats().catch(() => ({ total: 0, systemCount: 0, laws: [] })),
    searchLegalArticles("", 4).catch(() => []),
    getLegalMetrics(["systems", "articles", "explanations", "issues", "judgments", "principles"])
  ]);

  return (
    <LegalCoreShell>
      <LegalCoreTabs canManage={canManage} />
      {canManage ? <div className="mb-5"><ReindexButton /></div> : null}
      <div className="space-y-7">
        <LegalCorePageHeader
          title="النواة القانونية الموحدة"
          description="مركز إدارة الأنظمة والمواد والشروح والتصنيفات والقانون المقارن، ومصدر المعرفة الموحد لخدمات حكيم."
          actions={
            <>
              {TRADITIONAL_SEARCH_ENABLED ? <Link href="/dashboard/legal-core/search" className="btn btn-gold"><FileSearch size={16} /> البحث القانوني</Link> : null}
              <Link href="/dashboard/legal-core/citations" className="btn ho-hero-outline"><Quote size={16} /> التقاط الاستشهاد</Link>
              <Link href="/dashboard/legal-core/systems" className="btn ho-hero-outline"><BookOpen size={16} /> الأنظمة</Link>
              <Link href="/dashboard/legal-core/judgments" className="btn ho-hero-outline"><Scale size={16} /> الأحكام القضائية</Link>
              <Link href="/dashboard/legal-core/objection-methods" className="btn ho-hero-outline"><Gavel size={16} /> طرق الاعتراض</Link>
              <Link href="/dashboard/legal-core/legal-issues" className="btn ho-hero-outline"><Scale size={16} /> المسائل القانونية</Link>
              <Link href="/dashboard/legal-core/principles" className="btn ho-hero-outline"><Quote size={16} /> المبادئ القضائية</Link>
              <Link href="/dashboard/legal-core/citations/dashboard" className="btn ho-hero-outline"><Quote size={16} /> تغطية الربط</Link>
              <Link href="/dashboard/legal-core/quality" className="btn ho-hero-outline"><Database size={16} /> جودة البيانات</Link>
            </>
          }
        />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {TILES.map((id) => (
            <MetricTile key={id} metric={metric(snapshot, id)} />
          ))}
          <LegalCoreStatCard label="حالة المصدر" value="موحد" hint="legal_articles فقط" tone="emerald" />
        </section>

        <LegalCoreSearchBar systems={stats.laws} />

        {/* مركز التشغيل الذكي — ربط النواة بخدمات حكيم (إضافي، لا يغيّر بقية الصفحة) */}
        <CoreIntelligenceDashboard />

        <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <LegalCoreCard title="أحدث المواد في المستودع" subtitle="عرض هادئ لأحدث المواد المتاحة للبحث والاستشهاد" icon={<BookOpen size={18} />}>
            <div className="space-y-3">
              {recentArticles.map((article) => <LegalArticleCard key={article.id} article={article} />)}
            </div>
          </LegalCoreCard>

          <LegalCoreCard title="مركز المعرفة القانونية" subtitle="طبقات النواة التي ستخدم القاضي حكيم والاستشارات" icon={<Scale size={18} />}>
            <div className="grid gap-3">
              {["الأنظمة والمواد", "الشروح وشروط التطبيق", "الأحكام والمبادئ", "القانون المقارن", "القوالب المرتبطة"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-4">
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
