import { Database, GraduationCap, Sparkles } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";
import { requireUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/** المختبر — قدرات غير مكتملة تُعرض بوسم «قريبًا» كإجراء تسويقي. */
export default async function LabPage() {
  await requireUser();

  return (
    <div dir="rtl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">تحديثات قادمة</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">المختبر</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          خدمات تحت التجهيز النهائي. نعرضها مسبقًا بوسم{" "}
          <ComingSoonBadge className="align-middle" /> لتعريفك بما سيصل قريبًا.
        </p>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          href="/dashboard/knowledge-graph"
          title="الرسم المعرفي"
          metric="علاقات قانونية"
          comingSoon
          icon={Database}
          description="استكشاف العلاقات بين المواد والأحكام والمبادئ (يدعم/يفسّر/يعارض) كشبكة معرفية."
        />
        <ModuleCard
          href="/dashboard/legal-rag"
          title="الذكاء القانوني المُسنَد"
          metric="استرجاع وتوليد"
          comingSoon
          icon={Sparkles}
          description="خطّ استرجاع هجين ثمّ توليد مؤصَّل باستشهادات من المكتبة القانونية."
        />
        <ModuleCard
          href="/dashboard/training"
          title="التدريب والتعلّم"
          metric="مسارات ونقاط"
          comingSoon
          icon={GraduationCap}
          description="تمارين ومسارات تدريبية مع نقاط وشارات ومتابعة تقدّم."
        />
      </section>
    </div>
  );
}
