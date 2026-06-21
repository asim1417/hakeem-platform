import Link from "next/link";
import { BookOpen, Briefcase, ClipboardList, Gavel, GraduationCap, Paperclip, Scale, ScanSearch, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { prisma } from "@/lib/prisma";
import { formatFileSize, parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";

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
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, facts: true, status: true, createdAt: true }
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

export default async function DashboardPage() {
  const stats = await getDashboardStats().catch(() => null);

  return (
    <div>
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">منصة حكيم القانونية</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">الرئيسية</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          ابدأ بالبحث في الأنظمة السعودية، أو اطرح واقعتك على «اسأل حكيم» — بمصدرٍ موثّق من النواة القانونية.
        </p>

        <form action="/dashboard/legal-core/search" className="mt-5 flex max-w-2xl items-center gap-2 rounded-[var(--r-xl)] bg-white p-2 shadow-[var(--sh-md)]">
          <span aria-hidden className="ms-2 text-xl text-[var(--ink-40)]">⌕</span>
          <input
            name="q"
            aria-label="بحث قانوني"
            placeholder="اكتب رقم مادة، اسم نظام، رقم قضية، أو وصف واقعة..."
            className="h-11 w-full border-0 bg-transparent px-1 text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
          />
          <button type="submit" className="focus-ring shrink-0 rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)]">
            ابحث
          </button>
        </form>
        <Link href="/dashboard/ask" className="focus-ring mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--gold-pale)] transition hover:text-white">
          ✦ أو اسأل حكيم مباشرةً ←
        </Link>
      </header>

      {/* تابع عملك — أهمّ ما يحتاجه المستخدم العائد */}
      {!stats ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          تعذر تحميل بيانات الرئيسية.
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-bold text-[var(--navy)]">تابع عملك</h2>
          <section className="mt-4 grid gap-4 xl:grid-cols-3">
            <RecentList
              title="آخر الاستشارات"
              empty="لا توجد استشارات حديثة."
              items={stats.recentConsultations.map((item) => ({
                id: item.id,
                title: item.facts.slice(0, 90),
                meta: `${item.status} · ${item.createdAt.toLocaleString("ar-SA")}`
              }))}
            />
            <RecentList
              title="آخر القضايا"
              empty="لا توجد قضايا حديثة."
              items={stats.recentCases.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.status} · ${item.updatedAt.toLocaleString("ar-SA")}`
              }))}
            />
            <RecentList
              title="آخر جلسات القاضي التفاعلي"
              empty="لا توجد جلسات حديثة."
              items={stats.recentSimulations.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${stageLabel(item.stage)} · ${item.updatedAt.toLocaleString("ar-SA")}`
              }))}
            />
          </section>
        </>
      )}

      {/* خدمات حكيم */}
      <h2 className="mt-8 text-lg font-bold text-[var(--navy)]">خدمات حكيم</h2>
      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          href="/dashboard/legal-core/search"
          title="النواة القانونية"
          metric={`${(stats?.legalArticles ?? 0).toLocaleString("ar-SA")} مادة`}
          icon={BookOpen}
          description="مصدر الحقيقة الوحيد لكل الاستشهادات والاسترجاع السياقي."
        />
        <ModuleCard
          href="/dashboard/ask"
          title="اسأل حكيم"
          metric="وكيل قانوني شفّاف"
          icon={Sparkles}
          description="اطرح واقعتك ليبحث في النواة ويصوغ إجابة مستندة بحالات توثيق."
        />
        <ModuleCard
          href="/dashboard/simulations"
          title="القاضي التفاعلي"
          metric={`${(stats?.simulations ?? 0).toLocaleString("ar-SA")} جلسة`}
          icon={Gavel}
          description="قاعة مرافعة افتراضية: تقييد الدعوى، الجلسات، الحكم، والاعتراض."
        />
        <ModuleCard
          href="/dashboard/judicial-simulation"
          title="المحاكاة القضائية"
          metric="تقدير الحكم المحتمل"
          icon={Scale}
          description="حلّل وقائعك ليحاكي حكيم نظر القاضي: التكييف، الدفوع، واتجاه الحكم المحتمل — بإسناد موثّق."
        />
        <ModuleCard
          href="/dashboard/case-analysis"
          title="تحليل القضايا"
          metric="تحليل مُسنَد"
          icon={ScanSearch}
          description="توصيف النزاع، الوقائع المنتِجة، عبء الإثبات، المخاطر، ونقاط القوة والضعف — مع تقدير قوة الدعوى."
        />
        <ModuleCard
          href="/dashboard/legal-agent"
          title="الوكيل القانوني"
          metric="خطة عمل عملية"
          icon={ClipboardList}
          description="يحوّل التحليل إلى خطة: استراتيجية، دفوع مصنّفة، بيّنات، خطة مرافعة، وتوصية — باستشهادات حقيقية فقط."
        />
        <ModuleCard
          href="/dashboard/consultations"
          title="الاستشارات"
          metric={`${(stats?.consultations ?? 0).toLocaleString("ar-SA")} استشارة`}
          icon={ShieldCheck}
          description="تحويل الوقائع إلى مخرجات تعليمية مساعدة مستندة إلى مواد محفوظة."
        />
        <ModuleCard
          href="/dashboard/cases"
          title="القضايا والمرفقات"
          metric={`${(stats?.cases ?? 0).toLocaleString("ar-SA")} قضية`}
          icon={Briefcase}
          description="ملفات قضايا حقيقية مع سجل عمليات وربط بالبينات."
        />
        <ModuleCard
          href="/dashboard/training"
          title="التدريب والتعلم"
          metric="مسارات وتقييم"
          icon={GraduationCap}
          description="تمارين، اختبارات، شارات، نقاط، ومتابعة تقدم."
        />
      </section>

      {/* نظرة عامة — مؤشرات مصغّرة */}
      {stats ? (
        <>
          <h2 className="mt-8 text-lg font-bold text-[var(--navy)]">نظرة عامة</h2>
          <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="الأنظمة القانونية" value={stats.legalSystems} href="/dashboard/legal-core/systems" />
            <StatCard label="المواد النظامية" value={stats.legalArticles} href="/dashboard/legal-core/search" />
            <StatCard label="القضايا" value={stats.cases} />
            <StatCard label="الاستشارات" value={stats.consultations} />
            <StatCard label="جلسات القاضي" value={stats.simulations} />
            <StatCard label="المرفقات" value={stats.attachments} />
            <StatCard label="المستخدمون" value={stats.users} />
            <StatCard label="سجلات التدقيق" value={stats.auditLogs} />
          </section>

          <h2 className="mt-8 text-lg font-bold text-[var(--navy)]">نشاط النظام</h2>
          <section className="mt-4 grid gap-4 xl:grid-cols-3">
            <RecentList
              title="آخر الأنشطة"
              empty="لا توجد أنشطة حديثة."
              items={stats.recentActivities.map((item) => ({
                id: item.id,
                title: `${subjectLabel(item.subject)} · ${item.action}`,
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
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-olive">{value.toLocaleString("ar-SA")}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-md border border-black/10 bg-white p-4 transition hover:border-olive/40 hover:shadow-sm">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-md border border-black/10 bg-white p-4">{inner}</div>;
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
    <div className="rounded-md border border-black/10 bg-white p-5">
      <h2 className="text-xl font-bold text-olive">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-md bg-sand p-4 text-gray-700">{empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-md border border-black/10 p-3">
              <p className="line-clamp-2 font-semibold text-olive">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">{item.meta}</p>
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
