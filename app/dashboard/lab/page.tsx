import { Bot, Database, GraduationCap, Sparkles } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { requireUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// المختبر التجريبي — يجمع القدرات التجريبية (غير المكتملة) في مكان واحد موسوم،
// بدل بعثرتها في القائمة الرئيسية. خدمات الذكاء المكتملة أوضاعٌ داخل «اسأل حكيم».
export default async function LabPage() {
  await requireUser();

  return (
    <div dir="rtl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">قيد التطوير</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">المختبر التجريبي</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          قدرات تجريبية تحت التطوير — نعرضها للاستكشاف مع وسمها بوضوح. قد تتغيّر مخرجاتها أو تكتمل لاحقًا.
        </p>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          href="/dashboard/knowledge-graph"
          title="الرسم المعرفي"
          metric="علاقات قانونية"
          badge="تجريبيّ"
          icon={Database}
          description="استكشاف العلاقات بين المواد والأحكام والمبادئ (يدعم/يفسّر/يعارض) كشبكة معرفية."
        />
        <ModuleCard
          href="/dashboard/legal-rag"
          title="الذكاء القانوني RAG"
          metric="استرجاع وتوليد"
          badge="تجريبيّ"
          icon={Sparkles}
          description="خطّ استرجاع هجين ثمّ توليد مؤصَّل باستشهادات — بيئة اختبار للاسترجاع المعزّز."
        />
        <ModuleCard
          href="/dashboard/training"
          title="التدريب والتعلّم"
          metric="مسارات ونقاط"
          badge="تجريبيّ"
          icon={GraduationCap}
          description="تمارين ومسارات تدريبية مع نقاط وشارات ومتابعة تقدّم."
        />
        <ModuleCard
          href="/dashboard/agents"
          title="الوكلاء المخصّصون"
          metric="طبقة تكوين"
          icon={Bot}
          description="وكلاء ممارسة (تقاضٍ تجاريّ · إفلاس · معاون قاضٍ) فوق المحرّك الموحّد بحرّاسٍ برمجيّة، وحاسبة مهلة حيّة."
        />
      </section>
    </div>
  );
}
