import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell } from "@/components/legal-core";
import { MetricDefinitions, MetricRow, MetricTile } from "@/components/legal-core/LegalMetricsPanel";
import { getLegalMetrics } from "@/lib/modules/legal-core/metrics-server";
import { metric, type MetricId } from "@/lib/modules/legal-core/metrics";

export const dynamic = "force-dynamic";

// كل عدّاد هنا من legalMetricsService (HKM-023-A ل٠-١)؛ لا عدّ محلي ولا قيمة ثابتة.
const TOP: MetricId[] = ["articles.total", "articles.noClassification", "articles.noKeywords", "articles.noChapter"];
const INDICATORS: MetricId[] = [
  "articles.noClassification",
  "articles.noKeywords",
  "articles.noExplanation",
  "articles.noRelations",
  "explanations.withoutSource",
  "judgments.unlinked",
  "articles.duplicates",
  "articles.needsReview",
];

export default async function LegalCoreQualityPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const snapshot = await getLegalMetrics(["articles", "explanations", "judgments"]);

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="جودة بيانات النواة القانونية"
          description="لوحة مراجعة معرفية تساعد فريق حكيم على ضبط التصنيفات والكلمات المفتاحية والشروح والعلاقات قبل توسيع خدمات الذكاء القانوني."
        />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {TOP.map((id) => (
            <MetricTile key={id} metric={metric(snapshot, id)} />
          ))}
        </section>

        <LegalCoreCard title="مؤشرات المراجعة المعرفية" subtitle="الأرقام من خدمة العدّ الموحدة؛ ما له طابور يُفتح بالنقر، و«لا ينطبق» و«غير متاح» ليسا صفرًا">
          <div className="grid gap-3 md:grid-cols-2">
            {INDICATORS.map((id) => (
              <MetricRow key={id} metric={metric(snapshot, id)} />
            ))}
          </div>
          <div className="mt-4">
            <MetricDefinitions ids={[...new Set([...TOP, ...INDICATORS])]} snapshot={snapshot} />
          </div>
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
