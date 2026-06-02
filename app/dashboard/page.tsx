import { BookOpen, Briefcase, GraduationCap, Scale, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";

export default function DashboardPage() {
  return (
    <div>
      <header className="rounded-md bg-olive px-6 py-7 text-white">
        <p className="text-sm text-white/75">MVP المرحلة الأولى</p>
        <h1 className="mt-2 text-3xl font-bold">لوحة حكيم</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/80">
          نواة موحدة لإدارة المعرفة القانونية، القضايا، الاستشارات، المحاكاة القضائية، التدريب، والتدقيق.
        </p>
      </header>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard href="/dashboard/library" title="المكتبة النظامية" metric="9 أنظمة / 1,981 مادة" icon={BookOpen} description="مصدر الحقيقة الوحيد لكل الاستشهادات والاسترجاع السياقي." />
        <ModuleCard href="/dashboard/cases" title="القضايا والمرفقات" metric="خصوصية وتدقيق" icon={Briefcase} description="ملفات قضايا حقيقية مع سجل عمليات وربط بالبيّنات." />
        <ModuleCard href="/dashboard/consultations" title="الاستشارات" metric="RAG محكوم" icon={ShieldCheck} description="تحويل الوقائع إلى مخرجات تعليمية مساعدة مستندة إلى مواد محفوظة." />
        <ModuleCard href="/dashboard/simulations" title="المحاكاة القضائية" metric="7 مراحل" icon={Scale} description="تقييد الدعوى، الجلسات، الصلح، الحكم التدريبي، والاعتراض." />
        <ModuleCard href="/dashboard/training" title="التدريب والتعلم" metric="مسارات وتقييم" icon={GraduationCap} description="تمارين، اختبارات، شارات، نقاط، ومتابعة تقدم." />
      </section>
    </div>
  );
}
