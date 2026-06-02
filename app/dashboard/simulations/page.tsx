const stages = [
  "تقييد الدعوى",
  "فحص القبول المبدئي",
  "ضبط الجلسة",
  "مداخلة المدعي",
  "رد المدعى عليه",
  "قرار إجرائي",
  "المرافعة",
  "الصلح",
  "قفل باب المرافعة",
  "الحكم التدريبي",
  "الاعتراض"
];

export default function SimulationsPage() {
  return (
    <div>
      <p className="text-sm font-semibold text-gold">محاكاة قضائية تدريبية</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المحاكاة</h1>
      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage} className="rounded-md border border-black/10 bg-white p-4">
            <p className="text-sm text-gold">المرحلة {index + 1}</p>
            <h2 className="mt-2 font-bold text-olive">{stage}</h2>
          </div>
        ))}
      </section>
      <p className="mt-6 rounded-md bg-white p-5 leading-8 text-gray-700">
        تم إنشاء جداول لحفظ جلسات المحاكاة ورسائلها وقراراتها ومفاتيح تصدير PDF/DOCX لاحقًا.
      </p>
    </div>
  );
}
