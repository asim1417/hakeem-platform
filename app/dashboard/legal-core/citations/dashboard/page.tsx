import Link from "next/link";
import { FileSearch, ScrollText } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";
import { MetricDefinitions, MetricTile } from "@/components/legal-core/LegalMetricsPanel";
import { getLegalMetrics } from "@/lib/modules/legal-core/metrics-server";
import { formatMetricValue, metric, metricNumber, type MetricId } from "@/lib/modules/legal-core/metrics";

export const dynamic = "force-dynamic";

// كل رقم هنا من legalMetricsService (HKM-023-A ل٠-١): «أحكام بلا رابط» هو نفسه في /quality.
const TILES: MetricId[] = ["judgments.total", "judgments.linked", "judgments.unlinked", "citations.total", "citations.articlesLinked"];

export default async function LegalCoreCitationsDashboardPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const snapshot = await getLegalMetrics(["judgments", "citations"]);
  const total = metric(snapshot, "judgments.total");
  const linked = metric(snapshot, "judgments.linked");
  const totalN = metricNumber(total.value);
  const linkedN = metricNumber(linked.value);
  const coverage = totalN && linkedN !== null ? Math.round((linkedN / totalN) * 1000) / 10 : null;
  const ar = (n: number) => n.toLocaleString("ar-SA");

  const relations = snapshot.breakdowns.citationsByRelation;
  const reviews = snapshot.breakdowns.citationsByStatus;
  const maxRel = relations?.ok ? relations.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1 : 1;

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="تغطية ربط المواد بالأحكام"
          description="رصد فعلي لربط مواد النواة القانونية بالأحكام القضائية: كم حكماً مرتبط، كم بلا رابط، ونسبة التغطية — أرقام حيّة من قاعدة البيانات."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-gold" href="/dashboard/legal-core/judgments">
                <ScrollText size={16} />
                تصفّح الأحكام
              </Link>
              <Link className="btn btn-outline" href="/dashboard/legal-core/citations">
                <FileSearch size={16} />
                تحليل حكم جديد
              </Link>
            </div>
          }
        />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {TILES.map((id) => (
            <MetricTile key={id} metric={metric(snapshot, id)} />
          ))}
        </section>

        <LegalCoreCard
          title="نسبة تغطية الربط"
          subtitle={`${formatMetricValue(linked.value)} من ${formatMetricValue(total.value)} حكم مرتبط بمواد النواة`}
        >
          <div className="flex items-center gap-4">
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[var(--ink-08)]">
              <div
                className="absolute inset-y-0 right-0 rounded-full"
                style={{ width: `${coverage ?? 0}%`, background: "linear-gradient(90deg, var(--emerald), #2E8B6A)" }}
              />
            </div>
            <span className="font-mono-legal text-2xl font-bold text-[var(--navy)]">{coverage === null ? "غير متاح" : `${ar(coverage)}٪`}</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">
            النسبة تمثّل الأحكام التي اكتُشف لها سند نظامي واحد على الأقل. الأحكام بلا رابط قد لا تستشهد بمواد، أو أن موادها غير مستوردة بعد في النواة.
          </p>
        </LegalCoreCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <LegalCoreCard title="الروابط حسب نوع العلاقة" subtitle="توزيع استشهادات المواد على أنواع العلاقة">
            {!relations?.ok ? (
              <Unavailable />
            ) : relations.rows.length ? (
              <div className="space-y-3">
                {relations.rows.map((r) => (
                  <div key={r.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-[var(--ink-80)]">{r.label}</span>
                      <span className="font-mono-legal text-[var(--navy)]">{ar(r.count)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--ink-08)]">
                      <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.round((r.count / maxRel) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyIndex />
            )}
          </LegalCoreCard>

          <LegalCoreCard title="الروابط حسب حالة التوثيق" subtitle="حالة مراجعة الاستشهادات المسترجَعة">
            {!reviews?.ok ? (
              <Unavailable />
            ) : reviews.rows.length ? (
              <div className="flex flex-wrap gap-2">
                {reviews.rows.map((r) => (
                  <LegalTopicBadge key={r.key} tone={r.key === "verified" ? "emerald" : r.key === "rejected" ? "ruby" : "amber"}>
                    {r.label}: {ar(r.count)}
                  </LegalTopicBadge>
                ))}
              </div>
            ) : (
              <EmptyIndex />
            )}
            <p className="mt-4 text-sm leading-7 text-[var(--ink-60)]">
              الروابط المسترجَعة آلياً تحتاج تدقيقاً قانونياً بشرياً قبل اعتمادها كسند رسمي — وفق سياسة حالات التوثيق في حكيم.
            </p>
          </LegalCoreCard>
        </div>

        <MetricDefinitions ids={TILES} snapshot={snapshot} />
      </div>
    </LegalCoreShell>
  );
}

function EmptyIndex() {
  return (
    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
      لا توجد روابط محفوظة حتى الآن.
    </div>
  );
}

function Unavailable() {
  return (
    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--ink-15)] p-5 text-center text-sm leading-7 text-[var(--ink-60)]">
      — غير متاح: تعذّرت قراءة جدول الروابط.
    </div>
  );
}
