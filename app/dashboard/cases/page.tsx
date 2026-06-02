export default function CasesPage() {
  return (
    <div>
      <p className="text-sm font-semibold text-gold">القضايا والمرفقات والبينات</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">ملفات القضايا</h1>
      <div className="mt-6 rounded-md border border-black/10 bg-white p-6">
        <h2 className="text-xl font-bold text-olive">نطاق MVP</h2>
        <p className="mt-3 leading-8 text-gray-700">
          يدعم المخطط ملفات قضايا حقيقية، مرفقات PDF/Word/صور، نصًا مستخرجًا، مالكًا للملف، وحالة تشغيلية.
          كل عمليات القراءة والتحليل تسجل في سجل التدقيق مراعاة للخصوصية والامتثال.
        </p>
      </div>
    </div>
  );
}
