import Link from "next/link";
import { ConsultationForm } from "@/components/ConsultationForm";
import { requirePagePermission } from "@/lib/modules/auth/session";

export default async function ConsultationsPage({ searchParams }: { searchParams: { facts?: string } }) {
  await requirePagePermission("CONSULTATIONS_LIMITED");
  const defaultFacts = typeof searchParams?.facts === "string" ? searchParams.facts : "";
  return (
    <div>
      <p className="text-sm font-semibold text-gold">RAG محكوم بالمكتبة</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">الاستشارات القانونية</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        أدخل الواقعة والسؤال القانوني ليتم تحليلها عبر الخادم فقط، مع حصر الاستشهادات في مواد المكتبة النظامية.
      </p>
      {/* توحيد: «استشارة» متاحة الآن كوضع داخل «اسأل حكيم» (تُحفظ في سجلّك، باستدعاء وكيل واحد). */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold)] bg-[var(--gold-ghost)] px-3 py-2 text-sm text-[var(--navy)]">
        <span>📝 جديد: «استشارة» صارت وضعًا داخل «اسأل حكيم» — استشارة مؤصَّلة تُحفظ في سجلّك من مدخلٍ واحد.</span>
        <Link href="/dashboard/ask" className="font-semibold underline">
          جرّبها في اسأل حكيم ←
        </Link>
      </div>
      <div className="mt-6">
        <ConsultationForm defaultFacts={defaultFacts} />
      </div>
    </div>
  );
}
