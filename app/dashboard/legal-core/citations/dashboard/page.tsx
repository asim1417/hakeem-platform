import Link from "next/link";
import { FileSearch, ScrollText } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";
import { relationTypeLabel } from "@/lib/i18n/enum-labels";

export const dynamic = "force-dynamic";

export default async function LegalCoreCitationsDashboardPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const [totalJudgments, linkedJudgments, totalLinks, linkedArticles, byRelation, byReview] = await Promise.all([
    prisma.judicialCase.count().catch(() => 0),
    prisma.judicialCase.count({ where: { articleLinks: { some: {} } } }).catch(() => 0),
    prisma.legalArticleCaseLink.count().catch(() => 0),
    prisma.legalArticle.count({ where: { caseLinks: { some: {} } } }).catch(() => 0),
    prisma.legalArticleCaseLink
      .groupBy({ by: ["relationType"], _count: { _all: true } })
      .catch(() => [] as Array<{ relationType: string; _count: { _all: number } }>),
    prisma.legalArticleCaseLink
      .groupBy({ by: ["reviewStatus"], _count: { _all: true } })
      .catch(() => [] as Array<{ reviewStatus: string; _count: { _all: number } }>)
  ]);

  const unlinked = Math.max(totalJudgments - linkedJudgments, 0);
  const coverage = totalJudgments ? Math.round((linkedJudgments / totalJudgments) * 1000) / 10 : 0;
  const ar = (n: number) => n.toLocaleString("ar-SA");

  const relations = [...byRelation].sort((a, b) => b._count._all - a._count._all);
  const reviews = [...byReview].sort((a, b) => b._count._all - a._count._all);
  const maxRel = relations.reduce((m, r) => Math.max(m, r._count._all), 0) || 1;

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

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <LegalCoreStatCard label="إجمالي الأحكام" value={ar(totalJudgments)} hint="أحكام مستوردة من مصدر وزارة العدل" />
          <LegalCoreStatCard label="أحكام مرتبطة بمواد" value={ar(linkedJudgments)} hint="لها رابط مادة واحد على الأقل" tone="emerald" />
          <LegalCoreStatCard label="أحكام بلا رابط" value={ar(unlinked)} hint="لم يُكتشف لها سند نظامي بعد" tone="amber" />
          <LegalCoreStatCard label="روابط المواد" value={ar(totalLinks)} hint="إجمالي استشهادات مادة↔حكم" tone="emerald" />
          <LegalCoreStatCard label="مواد لها روابط" value={ar(linkedArticles)} hint="مواد نظامية مستشهد بها في أحكام" />
        </section>

        <LegalCoreCard title="نسبة تغطية الربط" subtitle={`${ar(linkedJudgments)} من ${ar(totalJudgments)} حكم مرتبط بمواد النواة`}>
          <div className="flex items-center gap-4">
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[var(--ink-08)]">
              <div
                className="absolute inset-y-0 right-0 rounded-full"
                style={{ width: `${coverage}%`, background: "linear-gradient(90deg, var(--emerald), #2E8B6A)" }}
              />
            </div>
            <span className="font-mono-legal text-2xl font-bold text-[var(--navy)]">{ar(coverage)}٪</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">
            النسبة تمثّل الأحكام التي اكتُشف لها سند نظامي واحد على الأقل. الأحكام بلا رابط قد لا تستشهد بمواد، أو أن موادها غير مستوردة بعد في النواة.
          </p>
        </LegalCoreCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <LegalCoreCard title="الروابط حسب نوع العلاقة" subtitle="توزيع استشهادات المواد على أنواع العلاقة">
            {relations.length ? (
              <div className="space-y-3">
                {relations.map((r) => (
                  <div key={r.relationType}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-[var(--ink-80)]">{relationTypeLabel(r.relationType)}</span>
                      <span className="font-mono-legal text-[var(--navy)]">{ar(r._count._all)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--ink-08)]">
                      <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.round((r._count._all / maxRel) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyIndex />
            )}
          </LegalCoreCard>

          <LegalCoreCard title="الروابط حسب حالة التوثيق" subtitle="حالة مراجعة الاستشهادات المسترجَعة">
            {reviews.length ? (
              <div className="flex flex-wrap gap-2">
                {reviews.map((r) => {
                  const tone = r.reviewStatus === "verified" ? "emerald" : r.reviewStatus === "rejected" ? "ruby" : "amber";
                  const label =
                    r.reviewStatus === "verified"
                      ? "موثّق رسميًا"
                      : r.reviewStatus === "rejected"
                      ? "مرفوض"
                      : "مسترجع آليًا — يحتاج مراجعة";
                  return (
                    <LegalTopicBadge key={r.reviewStatus} tone={tone}>
                      {label}: {ar(r._count._all)}
                    </LegalTopicBadge>
                  );
                })}
              </div>
            ) : (
              <EmptyIndex />
            )}
            <p className="mt-4 text-sm leading-7 text-[var(--ink-60)]">
              الروابط المسترجَعة آلياً تحتاج تدقيقاً قانونياً بشرياً قبل اعتمادها كسند رسمي — وفق سياسة حالات التوثيق في حكيم.
            </p>
          </LegalCoreCard>
        </div>
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
