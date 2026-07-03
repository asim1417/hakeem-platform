import Link from "next/link";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { LoginPopover } from "@/components/home/LoginPopover";

export const dynamic = "force-dynamic";

/**
 * صفحة البحث العامة (Search-First) — متاحة للزائر دون تسجيل دخول.
 * خارج /dashboard فلا يحرسها الـ middleware. للقراءة فقط، مواد نظامية فقط،
 * بنفس قيود واجهة البحث العامة (limit آمن). فتح المادة كاملةً والاستشهاد
 * والاستشارة الذكية تبقى خلف الدخول.
 */
export default async function PublicSearchPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  const query = (searchParams.q ?? "").trim().slice(0, 200);
  // محرّك البحث: النواة (searchLegalCore) — نفس محرّك الشات والقاضي: خريطة مفاهيم + مكنز + ترتيب صلة.
  const response = query
    ? await searchLegalCore({ query, limit: 12, includeSnippets: true, includeRelatedTerms: false })
    : null;
  const hits = response?.results ?? null;

  return (
    <main className="min-h-screen bg-[var(--hakeem-bg)]">
      {/* شريط علوي */}
      <header className="sticky top-0 z-20 border-b border-[var(--ink-08)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-lg font-bold text-[var(--gold-bright)]">
              ح
            </span>
            <span className="text-base font-bold text-[var(--navy)]">حكيم</span>
          </Link>
          <LoginPopover />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        {/* صندوق البحث */}
        <form action="/search" className="flex items-center gap-2 rounded-[var(--r-xl)] border border-[var(--ink-15)] bg-white p-2 shadow-[var(--sh-sm)] focus-within:border-[var(--gold)]">
          <span aria-hidden className="ms-2 text-xl text-[var(--ink-40)]">⌕</span>
          <input
            name="q"
            defaultValue={query}
            autoFocus={!query}
            aria-label="بحث قانوني"
            placeholder="اكتب رقم مادة، اسم نظام، رقم قضية، أو وصف واقعة..."
            className="h-11 w-full border-0 bg-transparent px-1 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
          />
          <button type="submit" className="focus-ring shrink-0 rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)]">
            ابحث
          </button>
        </form>

        {/* لافتة الزائر */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-3">
          <p className="text-sm leading-7 text-[var(--navy)]">
            تتصفّح كزائر — البحث في الأنظمة متاح. للاستشهاد الكامل، الحفظ، و«اسأل حكيم» الذكي سجّل الدخول.
          </p>
          <LoginPopover />
        </div>

        {/* النتائج (محرّك النواة searchLegalCore) */}
        {hits === null ? (
          <div className="mt-10 rounded-[var(--r-xl)] border border-dashed border-[var(--ink-15)] bg-[var(--hakeem-bg-soft)] p-10 text-center">
            <p className="font-display-ar text-lg font-bold text-[var(--navy)]">ابدأ بكتابة عبارة بحث</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">بحث النواة الذكي في مواد الأنظمة — خريطة مفاهيم ومكنز وترتيب صلة، يتصدّر الأكثر صلة لا الأكثر تكراراً.</p>
          </div>
        ) : (
          <section className="mt-5">
            <p className="mb-3 text-sm text-[var(--ink-60)]">
              {hits.length ? `أعلى ${hits.length.toLocaleString("ar-SA")} نتيجة صلةً لـ «${query}»` : ""}
            </p>

            {hits.length ? (
              <div className="space-y-4">
                {hits.map((hit) => (
                  <article key={hit.articleId} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-5 shadow-[var(--sh-xs)] transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-sm)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono-legal text-sm text-[var(--gold-dark)]">{hit.citationLabel}</p>
                      <span className="font-mono-legal text-[11px] text-[var(--ink-40)]">{hit.systemName}</span>
                    </div>
                    <p className="mt-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--parchment)] p-4 font-judicial text-lg leading-9 text-[var(--ink)]">
                      {hit.snippet}
                    </p>
                    <div className="mt-4">
                      <Link
                        href={`/dashboard/legal-core/search?q=${encodeURIComponent(`${hit.systemName} ${hit.articleNumber}`)}`}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--gold-ghost)]"
                      >
                        فتح المادة كاملةً في النواة (يتطلب الدخول) ↗
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[var(--r-xl)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-8 text-center font-display-ar text-[var(--navy)]">
                لم يتم العثور على نتائج مطابقة. جرّب صياغة أخرى.
              </div>
            )}
          </section>
        )}

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-7 text-[var(--ink-40)]">
          بحث النواة الذكي على مواد الأنظمة. التنبيه المهني: المخرجات مساعدة وتعليمية ولا تُعدّ رأيًا قانونيًا نهائيًا.
        </p>
      </div>
    </main>
  );
}
