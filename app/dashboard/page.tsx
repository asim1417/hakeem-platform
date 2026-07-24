import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, FileText, Gavel, Scale, Search, Sparkles } from "lucide-react";
import { CenterSearch } from "@/components/CenterSearch";
import { Hero, SectionTitle, Card, CardGrid } from "@/components/ui/design-system";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { QuotaCounter } from "@/components/billing/QuotaCounter";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { PlatformWindowBanner } from "@/components/admin/PlatformWindowBanner";
import { awardDailyVisit } from "@/lib/modules/credits/engagement";
import { getCurrentUser, type SafeUser } from "@/lib/modules/auth/session";
import {
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";
import {
  attachmentListWhere,
  caseListWhere,
  consultationListWhere,
  isSystemAdmin,
  simulationListWhere
} from "@/lib/modules/auth/ownership";
import { prisma } from "@/lib/prisma";
import { formatFileSize, parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";
import { activityLabel, statusLabel } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

async function getDashboardStats(user: SafeUser | null) {
  const admin = user ? isSystemAdmin(user) : false;
  const caseWhere = user ? caseListWhere(user) : { ownerId: "__none__" };
  const consultationWhere = user
    ? { ...consultationListWhere(user), status: "GENERATED" as const }
    : { userId: "__none__", status: "GENERATED" as const };
  const simulationWhere = user ? simulationListWhere(user) : { userId: "__none__" };
  const attachmentWhere = user ? attachmentListWhere(user) : { id: "__none__" };

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
  ] = await Promise.all([
    prisma.legalSystem.count(),
    prisma.legalArticle.count(),
    prisma.consultation.count({ where: consultationWhere }),
    prisma.simulation.count({ where: simulationWhere }),
    admin ? prisma.auditEvent.count() : Promise.resolve(0),
    prisma.caseFile.count({ where: caseWhere }),
    admin ? prisma.user.count() : Promise.resolve(0),
    prisma.attachment.count({ where: attachmentWhere }),
    admin
      ? prisma.auditEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { actor: { select: { name: true, email: true } } }
        })
      : Promise.resolve([]),
    prisma.consultation.findMany({
      where: consultationWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, facts: true, createdAt: true }
    }),
    prisma.caseFile.findMany({
      where: caseWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true }
    }),
    prisma.simulation.findMany({
      where: simulationWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, stage: true, updatedAt: true }
    }),
    prisma.attachment.findMany({
      where: attachmentWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fileName: true, mimeType: true, extractedText: true, createdAt: true }
    }),
    admin
      ? prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, email: true, role: true, createdAt: true }
        })
      : Promise.resolve([])
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
    recentUsers,
    isAdmin: admin
  };
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { welcome?: string; platform?: string };
}) {
  const me = await getCurrentUser().catch(() => null);
  const platformWindow =
    searchParams?.platform === "1" || searchParams?.platform === "true";
  // السوبر يدخل الإدارة افتراضياً — `/dashboard?platform=1` نافذة معاينة للمنصة.
  if (
    me &&
    isSuperAdmin(me) &&
    isSuperAdminPanelEnabled() &&
    !platformWindow
  ) {
    redirect("/admin");
  }

  const stats = await getDashboardStats(me).catch(() => null);
  const showWelcome = searchParams?.welcome === "1";
  if (me) void awardDailyVisit(me.id).catch(() => undefined);

  const firstName = me?.name?.split(/\s+/).filter(Boolean)[0] || "بك";
  const hasRecentWork = Boolean(
    stats &&
      (stats.recentConsultations.length > 0 ||
        stats.recentCases.length > 0 ||
        stats.recentSimulations.length > 0)
  );
  const isNewUser = Boolean(stats && !hasRecentWork && stats.cases === 0 && stats.consultations === 0 && stats.simulations === 0);
  const showPlatformBanner =
    Boolean(me && isSuperAdmin(me) && isSuperAdminPanelEnabled() && platformWindow);

  return (
    <div>
      {showPlatformBanner ? <PlatformWindowBanner /> : null}
      {(showWelcome || isNewUser) && me ? (
        <div className="mb-5 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-5 py-5 text-[var(--navy)]">
          <p className="font-display-ar text-lg font-bold">
            {showWelcome ? `مرحبًا ${firstName} — بدأت تجربتك في حكيم` : `مرحبًا ${firstName}`}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-70)]">
            تابع أعمالك، اسأل حكيم، أو ابدأ قضية في المعاون القضائي. ابدأ من أهم خدمة لك الآن.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/ask"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              اسأل حكيم
            </Link>
            <Link
              href="/dashboard/judicial-assistant"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              المعاون القضائي
            </Link>
            <Link
              href="/dashboard/legal-core"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              المكتبة القانونية
            </Link>
          </div>
        </div>
      ) : me ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ink-60)]">لوحة التحكم</p>
            <h1 className="text-2xl font-bold text-[var(--navy)]">مرحبًا {firstName}</h1>
          </div>
          <Link
            href="/dashboard/ask"
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            اسأل حكيم
          </Link>
        </div>
      ) : null}

      <QuotaCounter />
      <OnboardingBanner />
      {!isNewUser ? <CreditsWidget /> : null}

      <Hero
        center
        eyebrow="المصدر القانوني الموثّق · بحث ذكي"
        title="ابحث في الأنظمة السعودية، أو اسأل حكيم"
        lede="بمصدرٍ موثّق من النواة القانونية — من الواقعة إلى الاستراتيجية."
      >
        <CenterSearch />
      </Hero>

      {!stats ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          تعذر تحميل بيانات الرئيسية.
        </div>
      ) : hasRecentWork ? (
        <>
          <SectionTitle>تابع عملك</SectionTitle>
          <section className="grid gap-4 xl:grid-cols-3">
            {stats.recentConsultations.length > 0 ? (
              <RecentList
                title="آخر الاستشارات"
                empty="لا استشارات بعد."
                items={stats.recentConsultations.map((item) => ({
                  id: item.id,
                  title: item.facts.slice(0, 90),
                  meta: `استشارة مؤصّلة · ${item.createdAt.toLocaleString("ar-SA")}`
                }))}
              />
            ) : null}
            {stats.recentCases.length > 0 ? (
              <RecentList
                title="آخر القضايا"
                empty="لا قضايا بعد."
                items={stats.recentCases.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${statusLabel(item.status)} · ${item.updatedAt.toLocaleString("ar-SA")}`
                }))}
              />
            ) : null}
            {stats.recentSimulations.length > 0 ? (
              <RecentList
                title="آخر جلسات القاضي التفاعلي"
                empty="لا جلسات بعد."
                items={stats.recentSimulations.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${stageLabel(item.stage)} · ${item.updatedAt.toLocaleString("ar-SA")}`
                }))}
              />
            ) : null}
          </section>
        </>
      ) : null}

      <SectionTitle>{isNewUser ? "ابدأ من هنا" : "الوجهات الرئيسية"}</SectionTitle>
      <CardGrid>
        {TRADITIONAL_SEARCH_ENABLED ? (
          <Card
            href="/dashboard/legal-search"
            title="البحث الشامل"
            icon={Search}
            description="ابحث في كامل القاعدة دفعةً واحدة: الأنظمة والمواد والأحكام والمبادئ — مع فلاتر وترتيب بالصلة."
          />
        ) : null}
        <Card
          href="/dashboard/ask"
          title="اسأل حكيم"
          badge="الأهم"
          icon={Sparkles}
          description="مدخل واحد بأوضاع: اسأل · حلّل قضية · خطة عمل · تقدير حكم — يبحث في النواة ويصوغ إجابة مؤصّلة."
        />
        <Card
          href="/dashboard/judicial-assistant"
          title="المعاون القضائي"
          icon={Scale}
          description="مساحة قضية: وقائع، تحليل، ومخرجات قابلة للمتابعة."
        />
        <Card
          href="/dashboard/legal-core"
          title="النواة القانونية"
          badge={`${(stats?.legalArticles ?? 0).toLocaleString("ar-SA")} مادة`}
          icon={BookOpen}
          description="المكتبة النظامية ومصدر الحقيقة — الأنظمة والمواد والأحكام والمبادئ."
        />
        {!isNewUser ? (
          <>
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
              description="حمّل مستندك واستخرج نصّه العربيّ فورًا مع دعم القراءة الضوئية."
            />
          </>
        ) : null}
      </CardGrid>

      {stats && !isNewUser ? (
        <>
          <SectionTitle>نظرة عامة</SectionTitle>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="الأنظمة القانونية" value={stats.legalSystems} href="/dashboard/legal-core/systems" />
            <StatCard label="المواد النظامية" value={stats.legalArticles} href={TRADITIONAL_SEARCH_ENABLED ? "/dashboard/legal-core/search" : "/dashboard/legal-core"} />
            <StatCard label="قضاياي" value={stats.cases} />
            <StatCard label="استشاراتي" value={stats.consultations} />
            <StatCard label="جلساتي" value={stats.simulations} />
            <StatCard label="مرفقاتي" value={stats.attachments} />
            {stats.isAdmin ? (
              <>
                <StatCard label="المستخدمون" value={stats.users} />
                <StatCard label="سجلات التدقيق" value={stats.auditLogs} />
              </>
            ) : null}
          </section>

          {stats.isAdmin ? (
            <>
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
          ) : stats.recentAttachments.length > 0 ? (
            <>
              <SectionTitle>مرفقاتي الأخيرة</SectionTitle>
              <section className="grid gap-4 xl:grid-cols-1">
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
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPER_ADMIN: "سوبر أدمن",
    SYSTEM_ADMIN: "مدير النظام",
    LAWYER: "محامٍ",
    TRAINER: "مدرب / مشرف",
    TRAINEE: "متدرب",
    JUDGE: "قاضٍ"
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
      <Link
        href={href}
        className="block rounded-[14px] border border-[var(--doc-line)] bg-[var(--doc-ivory)] p-4 transition hover:border-[var(--copper)] hover:shadow-[var(--sh-sm)]"
      >
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
