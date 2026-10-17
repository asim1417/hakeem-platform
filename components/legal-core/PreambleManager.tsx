import Link from "next/link";
export function PreambleManager() {
  return <section className="rounded-xl border border-gold/30 bg-white p-6" dir="rtl">
    <h2 className="text-xl font-bold">إصدارات الديباجة</h2>
    <p className="my-4 leading-8">تُعدّ الديباجة في مكتب التحرير، ثم تُراجع وتُنشر مع حفظ النسخة السابقة وسند التغيير.</p>
    <Link className="inline-block rounded-lg bg-emerald-800 px-5 py-3 text-white" href="/admin/legal/systems">فتح مكتب التحرير</Link>
  </section>;
}
