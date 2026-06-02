import { ConsultationForm } from "@/components/ConsultationForm";

export default function ConsultationsPage() {
  return (
    <div>
      <p className="text-sm font-semibold text-gold">RAG محكوم بالمكتبة</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">الاستشارات القانونية</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        أدخل الواقعة والسؤال القانوني ليتم تحليلها عبر الخادم فقط، مع حصر الاستشهادات في مواد المكتبة النظامية.
      </p>
      <div className="mt-6">
        <ConsultationForm />
      </div>
    </div>
  );
}
