import Link from "next/link";
import { BookOpen, FileText, Gavel, Search, Sparkles } from "lucide-react";
import { CenterSearch } from "@/components/CenterSearch";
import { Hero, SectionTitle, Card, CardGrid } from "@/components/ui/design-system";
import { prisma } from "@/lib/prisma";
import { formatFileSize, parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";
import { activityLabel, statusLabel } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [
    legalSystems,
    legalArticles,
    consultations,
    simulations,
    auditLogs,
    cases,
    users,
    attachments,
    recentActivities,
    recentConsultations,
    recentCases,
    recentSimulations,
    recentAttachments,
    recentUsers
  ] =
    await Promise.all([
    prisma.legalSystem.count(),
    prisma.legalArticle.count(),
    prisma.consultation.count(),
    prisma.simulation.count(),
    prisma.auditEvent.count(),
    prisma.caseFile.count(),
    prisma.user.count(),
    prisma.attachment.count(),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true, email: true } } }
    }),
    prisma.consultation.findMany({
      // استشارات حقيقية مكتملة فقط — نستبعد المسوّدات والمحجوبة وبيانات الاختبار (BLOCKED/DRAFT)
      where: { status: "GENERATED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, facts: true, createdAt: true }
    }),
    prisma.caseFile.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true }
    }),
    prisma.simulation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, stage: true, updatedAt: true }
    }),
    prisma.attachment.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fileName: true, mimeType: true, extractedText: true, createdAt: true }
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    })
  ]);

  return {
    legalSystems,
    legalArticles,
    consultations,
    simulations,
    auditLogs,
    cases,
    users,
    attachments,
    recentActivities,
    recentConsultations,
    recentCases,
    recentSimulations,
    recentAttachments,
    recentUsers
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const stats = await getDashboardStats().catch(() => null);
  const showWelcome = searchParams?.welcome === "1";

  return (
    <div>
      {showWelcome ? (
        <div className="mb-4 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-5 py-4 text-sm leading-7 text-[var(--navy)]">
          <p className="font-display-ar text-base font-bold">مرحبًا بك في حكيم — بدأت تجربتك المجانية</p>
          <p className="mt-1 text-[var(--ink-70)]">
            يمكنك الآن البحث في الأنظمة، سؤال حكيم، وتجربة المحاكاة القضائية. هذه التجربة مجانية للبدء دون بطاقة دفع.
          </p>
        </div>
      ) : null}

      {/* الترويسة الموحّدة (نظام التصميم) — تحوي صندوق البحث المركزيّ بخياريه */}
      <Hero
        center
        eyebrow="المصدر القانوني الموثّق · بحث ذكي"
        title="ابحث في الأنظمة السعودية، أو اسأل حكيم"
        lede="بمصدرٍ موثّق من النواة القانونية — من الواقعة إلى الاستراتيجية."
      >
        <CenterSearch />
      </Hero>

      {/* تابع عملك — أهمّ ما يحتاجه المستخدم العائد */}
      {!stats ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          تعذر تحميل بيانات الرئيسية.
        </div>
      ) : (
        <>
          <SectionTitle>تابع عملك</SectionTitle>
          <section className="grid gap-4 xl:grid-cols-3">
            <RecentList
              title="آخر الاستشارات"
              empty="لا استشارات بعد."
              items={stats.recentConsultations.map((item) => ({
                id: item.id,
                title: item.facts.slice(0, 90),
                meta: `استشارة مؤصّلة · ${item.createdAt.toLocaleString("ar-SA")}`
              }))}
            />
            <RecentList
              title="آخر القضايا"
              empty="لا قضايا بعد."
              items={stats.recentCases.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${statusLabel(item.status)} · ${item.updatedAt.toLocaleString("ar-SA")}`
              }))}
            />
            <RecentList
              title="آخر جلسات القاضي التفاعلي"
              empty="لا جلسات بعد."
              items={stats.recentSimulations.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${stageLabel(item.stage)} · ${item.updatedAt.toLocaleString("ar-SA")}`
              }))}
            />
          </section>
        </>
      )}

      {/* الوجهات الرئيسية — بطاقات نظام التصميم الموحّد */}
      <SectionTitle>الوجهات الرئيسية</SectionTitle>
      <CardGrid>
        <Card
          href="/dashboard/legal-search"
          title="البحث الشامل"
          icon={Search}
          description="ابحث في كامل القاعدة دفعةً واحدة: الأنظمة والمواد والأحكام والمبادئ — مع فلاتر وترتيب بالصلة."
        />
        <Card
          href="/dashboard/legal-core"
          title="النواة القانونية"
          badge={`${(stats?.legalArticles ?? 0).toLocaleString("ar-SA")} مادة`}
          icon={BookOpen}
          description="المكتبة النظامية ومصدر الحقيقة الوحيد — الأنظمة والمواد والأحكام والمبادئ والمسائل القانونية."
        />
        <Card
          href="/dashboard/ask"
          title="اسأل حكيم"
          badge="٦ أوضاع"
          icon={Sparkles}
          description="مدخل واحد بأوضاع: اسأل · حلّل قضية · خطة عمل · تقدير حكم · استشارة · محادثة — يبحث في النواة ويصوغ إجابة مؤصّلة."
        />
        <Card
          href="/dashboard/simulations"
          title="القاضي التفاعلي"
          badge={`${(stats?.simulations ?? 0).toLocaleString("ar-SA")} جلسة`}
          icon={Gavel}
          description="قاعة مرافعة افتراضية: تقييد الدعوى، الجلسات، الحكم، والاعتراض."
        />
        <Card
          href="/documents"
          title="منصة الوثائق"
          icon={FileText}
          description="حمّل مستندك (Word · PDF · صور ممسوحة) واستخرج نصّه العربيّ فورًا مع دعم القراءة الضوئية."
        />
      </CardGrid>

      {/* نظرة عامة — مؤشرات مصغّرة */}
      {stats ? (
        <>
          <SectionTitle>نظرة عامة</SectionTitle>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="الأنظمة القانونية" value={stats.legalSystems} href="/dashboard/legal-core/systems" />
            <StatCard label="المواد النظامية" value={stats.legalArticles} href="/dashboard/legal-core/search" />
            <StatCard label="القضايا" value={stats.cases} />
            <StatCard label="الاستشارات" value={stats.consultations} />
            <StatCard label="جلسات القاضي" value={stats.simulations} />
            <StatCard label="المرفقات" value={stats.attachments} />
            <StatCard label="المستخدمون" value={stats.users} />
            <StatCard label="سجلات التدقيق" value={stats.auditLogs} />
          </section>

          <SectionTitle>نشاط النظام</SectionTitle>
          <section className="grid gap-4 xl:grid-cols-3">
            <RecentList
              title="آخر الأنشطة"
              empty="لا توجد أنشطة حديثة."
              items={stats.recentActivities.map((item) => ({
                id: item.id,
                title: `${subjectLabel(item.subject)} · ${activityLabel(item.action)}`,
                meta: `${item.actor?.name ?? "النظام"} · ${item.createdAt.toLocaleString("ar-SA")}`
              }))}
            />
            <RecentList
              title="آخر المرفقات"
              empty="لا توجد مرفقات حديثة."
              items={stats.recentAttachments.map((item) => {
                const metadata = parseAttachmentMetadata(item.extractedText);
                return {
                  id: item.id,
                  title: item.fileName,
                  meta: `${item.mimeType} · ${formatFileSize(metadata.size)} · ${item.createdAt.toLocaleString("ar-SA")}`
                };
              })}
            />
            <RecentList
              title="آخر المستخدمين"
              empty="لا توجد إضافات مستخدمين حديثة."
              items={stats.recentUsers.map((item) => ({
                id: item.id,
                title: item.name,
                meta: `${roleLabel(item.role)} · ${item.createdAt.toLocaleString("ar-SA")}`
              }))}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    SYSTEM_ADMIN: "مدير النظام",
    LAWYER: "محامٍ",
    TRAINER: "مدرب / مشرف",
    TRAINEE: "متدرب"
  };
  return labels[role] ?? role;
}

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <p className="text-sm text-[var(--doc-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--petrol)] tabular-nums">{value.toLocaleString("ar-SA")}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-[14px] border border-[var(--doc-line)] bg-[var(--doc-ivory)] p-4 transition hover:border-[var(--copper)] hover:shadow-[var(--sh-sm)]">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-[14px] border border-[var(--doc-line)] bg-[var(--doc-ivory)] p-4">{inner}</div>;
}

function RecentList({
  title,
  empty,
  items
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--doc-line)] bg-[var(--doc-ivory)] p-5">
      <h3 className="text-base font-bold text-[var(--petrol)]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 rounded-[var(--r-md)] bg-[var(--doc-surface)] p-4 text-sm text-[var(--doc-muted)]">{empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[var(--r-md)] border border-[var(--doc-line)] p-3">
              <p className="line-clamp-2 font-semibold text-[var(--petrol)]">{item.title}</p>
              <p className="mt-1 text-xs text-[var(--doc-muted)]">{item.meta}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function subjectLabel(subject: string) {
  const labels: Record<string, string> = {
    AUTH: "الدخول",
    LIBRARY: "المكتبة",
    CASE: "القضايا",
    CONSULTATION: "الاستشارات",
    SIMULATION: "المحاكاة",
    TRAINING: "التدريب",
    AI_GATEWAY: "بوابة الذكاء",
    ADMIN: "الإدارة"
  };
  return labels[subject] ?? subject;
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    CLAIM_FILING: "تقييد الدعوى",
    INITIAL_ADMISSIBILITY: "فحص القبول",
    HEARING_RECORD: "ضبط الجلسة",
    PLAINTIFF_STATEMENT: "مداخلة المدعي",
    DEFENDANT_RESPONSE: "جواب المدعى عليه",
    PROCEDURAL_DECISION: "قرار إجرائي",
    PLEADING: "المرافعة",
    SETTLEMENT: "الصلح",
    CLOSE_PLEADING: "قفل باب المرافعة",
    TRAINING_JUDGMENT: "الحكم التدريبي",
    OBJECTION: "الاعتراض"
  };
  return labels[stage] ?? stage;
}
