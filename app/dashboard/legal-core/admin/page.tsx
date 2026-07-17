import Link from "next/link";
import { ShieldCheck, Quote, Scale, BookOpen, Database, ClipboardCheck, AlertTriangle } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalCoreStatCard, LegalTopicBadge } from "@/components/legal-core";
import { LegalCoreTabs } from "@/components/legal-core/LegalCoreTabs";

export const dynamic = "force-dynamic";

// لوحة حوكمة ومراجعة المحتوى القانوني (لأصحاب إدارة النواة).
// قراءة وتجميع لقوائم المراجعة + روابط لأدوات الإجراء. آمنة عند غياب الجداول.
export default async function LegalContentAdminPage() {
  await requirePagePermission("LEGAL_CORE_ADMIN");

  const [
    principlesPending,
    principlesReviewed,
    caseLinksPending,
    articlesNeedingEnrichment,
    decreesFilled,
    fiqhSources,
    fiqhTexts,
    fiqhAlignmentsPending
  ] = await Promise.all([
    prisma.judicialPrinciple.count({ where: { reviewStatus: "needs_review" } }).catch(() => 0),
    prisma.judicialPrinciple.count({ where: { reviewStatus: "reviewed" } }).catch(() => 0),
    prisma.legalArticleCaseLink.count({ where: { reviewStatus: "needs_review" } }).catch(() => 0),
    prisma.legalArticle.count({ where: { OR: [{ classification: null }, { chapter: null }, { keywords: { isEmpty: true } }] } }).catch(() => 0),
    prisma.legalArticle.count({ where: { NOT: [{ royalDecree: null }, { royalDecree: "" }] } }).catch(() => 0),
    // الجداول الفقهية الجديدة — تُعيد 0 بأمان قبل تطبيق الترحيل على القاعدة.
    (prisma as { fiqhSource?: { count: () => Promise<number> } }).fiqhSource?.count().catch(() => 0) ?? 0,
    (prisma as { fiqhText?: { count: () => Promise<number> } }).fiqhText?.count().catch(() => 0) ?? 0,
    (prisma as { fiqhArticleAlignment?: { count: (a: unknown) => Promise<number> } }).fiqhArticleAlignment
      ?.count({ where: { reviewStatus: "needs_review", deletedAt: null } })
      .catch(() => 0) ?? 0
  ]);

  const queues = [
    { key: "principles", label: "مبادئ قضائية بانتظار المراجعة", count: principlesPending, href: "/dashboard/legal-core/principles?status=needs_review", icon: Quote, tone: principlesPending ? "amber" : "emerald" },
    { key: "fiqh", label: "مواءمات فقهية بانتظار المراجعة", count: fiqhAlignmentsPending, href: "/dashboard/legal-core/admin", icon: Scale, tone: fiqhAlignmentsPending ? "amber" : "emerald" },
    { key: "caselinks", label: "استشهادات قضائية بانتظار الاعتماد", count: caseLinksPending, href: "/dashboard/legal-core/citations/dashboard", icon: ClipboardCheck, tone: caseLinksPending ? "amber" : "emerald" },
    { key: "enrich", label: "مواد تحتاج إثراء (تصنيف/باب/كلمات)", count: articlesNeedingEnrichment, href: "/dashboard/legal-core/quality", icon: AlertTriangle, tone: articlesNeedingEnrichment ? "amber" : "emerald" }
  ] as const;

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

        <section className="grid gap-4 md:grid-cols-3">
          <LegalCoreStatCard label="مبادئ معتمدة" value={principlesReviewed} hint="بعد المراجعة البشرية" tone={principlesReviewed ? "emerald" : "amber"} />
          <LegalCoreStatCard label="مواد موثّقة المرسوم" value={decreesFilled} hint="مرسوم ملكي مُستخرَج" tone={decreesFilled ? "emerald" : "amber"} />
          <LegalCoreStatCard label="مصادر فقهية مُدخَلة" value={fiqhSources} hint={`${fiqhTexts.toLocaleString("ar-SA")} نصّ فقهي`} tone={fiqhSources ? "emerald" : "amber"} />
        </section>

        <LegalCoreCard title="قوائم المراجعة البشرية" subtitle="الربط الآلي اقتراح يخضع للاعتماد" icon={<ShieldCheck size={18} />}>
          <div className="grid gap-3 md:grid-cols-2">
            {queues.map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.key} href={q.href} className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/60 p-4 transition hover:border-[var(--gold)]">
                  <span className="inline-flex items-center gap-2 font-display-ar text-sm font-bold text-[var(--navy)]">
                    <Icon size={17} className="text-[var(--gold)]" /> {q.label}
                  </span>
                  <LegalTopicBadge tone={q.tone}>{q.count.toLocaleString("ar-SA")}</LegalTopicBadge>
                </Link>
              );
            })}
          </div>
        </LegalCoreCard>

        <LegalCoreCard title="الطبقة الفقهية المنضبطة" subtitle="مساندة غير ملزمة — منفصلة تمامًا عن النص النظامي" icon={<BookOpen size={18} />}>
          <div className="space-y-3 text-sm leading-7 text-[var(--ink-70)]">
            <p>
              البنية جاهزة لاستقبال المصادر والنصوص الفقهية ومواءمتها بالمواد، مع وجه الصلة ونوع الصلة ودرجة الثقة وحالة المراجعة.
              لا تُنشر أي مواءمة على واجهة المستخدم إلا بعد مراجعة بشرية أو موسومة «مواءمة آلية غير معتمدة».
            </p>
            <div className="flex flex-wrap gap-2">
              <LegalTopicBadge tone={fiqhSources ? "emerald" : "amber"}>{fiqhSources.toLocaleString("ar-SA")} مصدر</LegalTopicBadge>
              <LegalTopicBadge tone={fiqhTexts ? "emerald" : "amber"}>{fiqhTexts.toLocaleString("ar-SA")} نصّ</LegalTopicBadge>
              <LegalTopicBadge tone={fiqhAlignmentsPending ? "amber" : "emerald"}>{fiqhAlignmentsPending.toLocaleString("ar-SA")} مواءمة بانتظار المراجعة</LegalTopicBadge>
            </div>
            <p className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3 text-xs leading-6 text-[var(--navy)]">
              للتعبئة من مكتبة تراث المفتوحة (محدودة ومُسنَدة، بلا سحب جماعي):
              <span className="font-mono-legal" dir="ltr"> npm run import:fiqh -- --apply --limit 50 --q "خيار العيب"</span>
            </p>
          </div>
        </LegalCoreCard>
      </div>
    </LegalCoreShell>
  );
}
