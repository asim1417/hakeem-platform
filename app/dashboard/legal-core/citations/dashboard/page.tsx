import Link from "next/link";
import { FileSearch } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

const dashboardItems = [
  ["الإشارات المكتشفة", 0, "تظهر بعد اعتماد حفظ دائم للاستشهادات."],
  ["الإشارات المحلولة", 0, "المحلولة إلى مواد legal_articles."],
  ["الإشارات غير المحلولة", 0, "تحتاج مراجعة يدوية."],
  ["الإشارات المعتمدة", 0, "اعتماد دائم لاحقًا."],
  ["الإشارات المرفوضة", 0, "رفض دائم لاحقًا."]
] as const;

export default async function LegalCoreCitationsDashboardPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="لوحة التحكم في الاستشهادات"
          description="لوحة مبدئية لرصد الاستشهادات القضائية والفهارس العكسية. لا تعرض بيانات وهمية؛ ستتفعّل الأرقام بعد إضافة حفظ دائم دون تعديل schema الآن."
          actions={
            <Link className="btn btn-gold" href="/dashboard/legal-core/citations">
              <FileSearch size={16} />
              تحليل حكم جديد
            </Link>
          }
        />

        <section className="grid gap-4 md:grid-cols-5">
          {dashboardItems.map(([label, value, hint]) => (
            <LegalCoreStatCard key={label} label={label} value={value} hint={hint} tone={value ? "emerald" : "amber"} />
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          <LegalCoreCard title="فهرس حسب المادة" subtitle="المادة ← الأحكام التي استشهدت بها">
            <EmptyIndex />
          </LegalCoreCard>
          <LegalCoreCard title="فهرس حسب النظام" subtitle="النظام ← الاستشهادات المكتشفة">
            <EmptyIndex />
          </LegalCoreCard>
          <LegalCoreCard title="فهرس حسب نوع العلاقة" subtitle="أساس الحكم، قول خصوم، إجرائي، مرجع عام">
            <div className="flex flex-wrap gap-2">
              <LegalTopicBadge tone="emerald">أساس الحكم</LegalTopicBadge>
              <LegalTopicBadge>قول خصوم</LegalTopicBadge>
              <LegalTopicBadge tone="amber">إجرائي</LegalTopicBadge>
              <LegalTopicBadge tone="ruby">غير محلول</LegalTopicBadge>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-60)]">سيعرض هذا القسم الفهرس بعد تفعيل الحفظ الدائم للاستشهادات.</p>
          </LegalCoreCard>
        </div>
      </div>
    </LegalCoreShell>
  );
}

function EmptyIndex() {
  return (
    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
      لا توجد استشهادات معتمدة محفوظة حتى الآن.
    </div>
  );
}
