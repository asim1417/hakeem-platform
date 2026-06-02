import { getLibraryStats, searchLegalArticles } from "@/lib/modules/library/library-service";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";
  const [stats, articles] = await Promise.all([
    getLibraryStats().catch(() => ({ total: 0, laws: [] })),
    searchLegalArticles(q, 30).catch(() => [])
  ]);

  return (
    <div>
      <header>
        <p className="text-sm font-semibold text-gold">مصدر الحقيقة الوحيد</p>
        <h1 className="mt-2 text-3xl font-bold text-olive">المكتبة النظامية</h1>
        <p className="mt-2 text-gray-600">تشمل مبدئيًا {stats.total || "1,981"} مادة سعودية وتغذي الاستشارات والمحاكاة والتدريب.</p>
        {stats.total === 0 ? (
          <p className="mt-3 rounded-md bg-white p-3 text-sm text-gray-600">
            لم يتم الاتصال بقاعدة PostgreSQL بعد. ستظهر المواد النظامية بعد تشغيل قاعدة البيانات وتنفيذ الاستيراد.
          </p>
        ) : null}
      </header>

      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className="focus-ring w-full rounded-md border border-black/10 bg-white px-4 py-3"
          placeholder="ابحث باسم النظام أو نص المادة أو الكلمات المفتاحية"
        />
        <button className="focus-ring rounded-md bg-olive px-5 py-3 text-white">بحث</button>
      </form>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stats.laws.map((law) => (
          <div key={law.lawName} className="rounded-md border border-black/10 bg-white p-4">
            <h2 className="font-bold text-olive">{law.lawName}</h2>
            <p className="mt-1 text-sm text-gray-600">{law._count._all} مادة</p>
          </div>
        ))}
      </section>

      <section className="mt-6 space-y-3">
        {articles.length === 0 ? (
          <div className="rounded-md border border-black/10 bg-white p-5 text-gray-700">
            لا توجد مادة نظامية مطابقة في قاعدة البيانات الحالية.
          </div>
        ) : null}
        {articles.map((article) => (
          <article key={article.id} className="rounded-md border border-black/10 bg-white p-5">
            <p className="text-sm text-gold">{article.lawName} · المادة {article.articleNumber}</p>
            <h2 className="mt-1 text-lg font-bold text-olive">{article.title}</h2>
            <p className="mt-3 leading-8 text-gray-700">{article.content}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
