import { BookOpen, Briefcase, GraduationCap, Scale, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [legalSystems, legalArticles, consultations, simulations, auditLogs, cases] = await Promise.all([
    prisma.legalSystem.count(),
    prisma.legalArticle.count(),
    prisma.consultation.count(),
    prisma.simulation.count(),
    prisma.auditEvent.count(),
    prisma.caseFile.count()
  ]);

  return { legalSystems, legalArticles, consultations, simulations, auditLogs, cases };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats().catch(() => null);

  return (
    <div>
      <header className="rounded-md bg-olive px-6 py-7 text-white">
        <p className="text-sm text-white/75">MVP المرحلة الأولى</p>
        <h1 className="mt-2 text-3xl font-bold">لوحة حكيم</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/80">
          مؤشرات حية من قاعدة البيانات لوحدات المعرفة القانونية، القضايا، الاستشارات، المحاكاة، والتدقيق.
        </p>
      </header>

      {!stats ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          تعذر تحميل مؤشرات لوحة التحكم.
        </div>
      ) : (
        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="الأنظمة القانونية" value={stats.legalSystems} />
          <StatCard label="المواد النظامية" value={stats.legalArticles} />
          <StatCard label="الاستشارات" value={stats.consultations} />
          <StatCard label="جلسات المحاكاة" value={stats.simulations} />
          <StatCard label="سجلات التدقيق" value={stats.auditLogs} />
          <StatCard label="القضايا" value={stats.cases} />
        </section>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          href="/dashboard/library"
          title="المكتبة النظامية"
          metric={`${(stats?.legalArticles ?? 0).toLocaleString("ar-SA")} مادة`}
          icon={BookOpen}
          description="مصدر الحقيقة الوحيد لكل الاستشهادات والاسترجاع السياقي."
        />
        <ModuleCard
          href="/dashboard/cases"
          title="القضايا والمرفقات"
          metric={`${(stats?.cases ?? 0).toLocaleString("ar-SA")} قضية`}
          icon={Briefcase}
          description="ملفات قضايا حقيقية مع سجل عمليات وربط بالبينات."
        />
        <ModuleCard
          href="/dashboard/consultations"
          title="الاستشارات"
          metric={`${(stats?.consultations ?? 0).toLocaleString("ar-SA")} استشارة`}
          icon={ShieldCheck}
          description="تحويل الوقائع إلى مخرجات تعليمية مساعدة مستندة إلى مواد محفوظة."
        />
        <ModuleCard
          href="/dashboard/simulations"
          title="المحاكاة القضائية"
          metric={`${(stats?.simulations ?? 0).toLocaleString("ar-SA")} جلسة`}
          icon={Scale}
          description="تقييد الدعوى، الجلسات، الصلح، الحكم التدريبي، والاعتراض."
        />
        <ModuleCard
          href="/dashboard/training"
          title="التدريب والتعلم"
          metric="مسارات وتقييم"
          icon={GraduationCap}
          description="تمارين، اختبارات، شارات، نقاط، ومتابعة تقدم."
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-olive">{value.toLocaleString("ar-SA")}</p>
    </div>
  );
}
