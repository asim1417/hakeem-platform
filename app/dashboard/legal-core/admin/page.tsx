import Link from "next/link";
import { Quote, BookOpen, Database } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";
import { LegalCoreTabs } from "@/components/legal-core/LegalCoreTabs";
import { LegalMetricsPanel } from "@/components/legal-core/LegalMetricsPanel";
import { PreambleManager } from "@/components/legal-core/PreambleManager";
import { getLegalMetrics } from "@/lib/modules/legal-core/metrics-server";
import { formatMetricValue, metric, type MetricValue } from "@/lib/modules/legal-core/metrics";

export const dynamic = "force-dynamic";

const badgeTone = (v: MetricValue, attention = false): "emerald" | "amber" | "gold" =>
  v.kind !== "count" ? "gold" : attention ? (v.value ? "amber" : "emerald") : v.value ? "emerald" : "amber";

// لوحة حوكمة ومراجعة المحتوى القانوني (لأصحاب إدارة النواة).
// كل عدّاد من legalMetricsService (HKM-023-A ل٠-١)، وكل عدّاد له طابور يُفتح بالنقر (ل٠-٢).
export default async function LegalContentAdminPage() {
  await requirePagePermission("LEGAL_CORE_ADMIN");

  const snapshot = await getLegalMetrics();
  const fiqhSources = metric(snapshot, "fiqh.sources").value;
  const fiqhTexts = metric(snapshot, "fiqh.texts").value;
  const fiqhPending = metric(snapshot, "fiqh.alignmentsPending").value;

  return (
    <LegalCoreShell>
      <LegalCoreTabs canManage />
      <div className="space-y-7">
        <LegalCorePageHeader
          eyebrow="حكيم | النواة القانونية"
          title="إدارة ومراجعة المحتوى القانوني"
          description="مركز حوكمة المحتوى: قوائم المراجعة البشرية، حالة الطبقة الفقهية المنضبطة، ومؤشرات جودة البيانات. كل ربط آلي يخضع للمراجعة قبل الاعتماد، والطبقة الفقهية مساندة غير ملزمة منفصلة عن النص النظامي."
          actions={
            <Link href="/dashboard/legal-core" className="btn ho-hero-outline"><Database size={16} /> النواة القانونية</Link>
          }
        />

        <LegalMetricsPanel snapshot={snapshot} title="عدّادات المحتوى القانوني وطوابيره" />

        <LegalCoreCard title="ديباجات الأنظمة" subtitle="ديباجة/مرسوم كلّ نظام — قابلةٌ للبحث والاستشهاد (تُخزَّن مادّةً رقم صفر)" icon={<Quote size={18} />}>
          <PreambleManager />
        </LegalCoreCard>

        <LegalCoreCard title="الطبقة الفقهية المنضبطة" subtitle="مساندة غير ملزمة — منفصلة تمامًا عن النص النظامي" icon={<BookOpen size={18} />}>
          <div className="space-y-3 text-sm leading-7 text-[var(--ink-70)]">
            <p>
              البنية جاهزة لاستقبال المصادر والنصوص الفقهية ومواءمتها بالمواد، مع وجه الصلة ونوع الصلة ودرجة الثقة وحالة المراجعة.
              لا تُنشر أي مواءمة على واجهة المستخدم إلا بعد مراجعة بشرية أو موسومة «مواءمة آلية غير معتمدة».
            </p>
            <div className="flex flex-wrap gap-2">
              <LegalTopicBadge tone={badgeTone(fiqhSources)}>مصادر: {formatMetricValue(fiqhSources)}</LegalTopicBadge>
              <LegalTopicBadge tone={badgeTone(fiqhTexts)}>نصوص: {formatMetricValue(fiqhTexts)}</LegalTopicBadge>
              <LegalTopicBadge tone={badgeTone(fiqhPending, true)}>مواءمات بانتظار المراجعة: {formatMetricValue(fiqhPending)}</LegalTopicBadge>
            </div>
            <p className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3 text-xs leading-6 text-[var(--navy)]">
              تُدخَل النصوص الفقهية من مصادر التراث المفتوحة بصورة محدودة ومُسنَدة (دفعات مختارة، بلا سحب جماعي)، ثم تُواءم بالمواد وتُراجَع بشريًا قبل الاعتماد.
            </p>
          </div>
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
