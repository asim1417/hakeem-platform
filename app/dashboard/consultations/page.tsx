export default function ConsultationsPage() {
  return (
    <div>
      <p className="text-sm font-semibold text-gold">RAG محكوم بالمكتبة</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">الاستشارات القانونية</h1>
      <div className="mt-6 rounded-md border border-black/10 bg-white p-6">
        <h2 className="text-xl font-bold text-olive">بوابة ذكاء خلفية</h2>
        <p className="mt-3 leading-8 text-gray-700">
          المسار الأولي يرسل الوقائع إلى الخادم فقط، يسترجع مواد من جدول legal_articles، يمنع التوليد دون مصادر،
          ويسجل قرار الحارس والاستشهادات والمخرج في سجل التدقيق.
        </p>
        <p className="mt-4 rounded-md bg-sand p-4 text-sm leading-7 text-gray-700">
          مخرجات حكيم مساعدة وتعليمية ولا تعد رأيًا قانونيًا نهائيًا.
        </p>
      </div>
    </div>
  );
}
