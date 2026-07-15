import Link from "next/link";

export const metadata = {
  title: "واجهة المطوّرين (API) — منصة حكيم",
  description: "بوابة المطوّرين لمنصة حكيم: تكامل خارجي مع النواة القانونية السعودية عبر API بمفتاح.",
};

const BASE = "https://hakeem-platform.vercel.app";

const endpoints: Array<{ method: string; path: string; desc: string }> = [
  { method: "GET", path: "/api/legal/search?q=&limit=", desc: "بحث قانوني هجين في النواة (نصّي + دلالي + رسم معرفي)" },
  { method: "GET", path: "/api/legal/systems?q=&page=&pageSize=", desc: "قائمة الأنظمة مع بحث وتصفية وترقيم" },
  { method: "GET", path: "/api/legal/systems/{id}", desc: "تفاصيل نظام ومواده مجمّعة بالفصول" },
  { method: "GET", path: "/api/legal/articles/{id}", desc: "مادة + صيغة الاستناد الرسمية + المعرّف التشريعي (ELI)" },
  { method: "GET", path: "/api/legal/articles/{id}/related", desc: "مواد ذات صلة + الإحالات الداخلية" },
  { method: "GET", path: "/api/legal/articles/{id}/fiqh", desc: "مواءمة فقهية مساندة (غير مُلزِمة، مُعلّمة صراحةً)" },
];

const steps: Array<{ n: string; h: string; p: string }> = [
  { n: "١", h: "اطلب مفتاحًا", p: "تواصل مع مسؤول منصّة حكيم للحصول على مفتاح API خاص بك، مع تحديد الاستخدام المتوقّع وحدّ المعدّل المناسب." },
  { n: "٢", h: "مرّر المفتاح", p: "أرسل المفتاح في ترويسة كل طلب: Authorization: Bearer hk_live_… (أو x-api-key)." },
  { n: "٣", h: "ابدأ التكامل", p: "استعلم عن الأنظمة والمواد والبحث القانوني. راجع مواصفة OpenAPI للتفاصيل الكاملة." },
];

const card = "rounded-2xl border border-[var(--gold-border,rgba(192,155,90,.28))] bg-white p-6 shadow-sm";

export default function DevelopersPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,var(--parchment),#F3EEE2)] text-[var(--navy)]">
      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* Hero */}
        <header className="rounded-3xl border border-[rgba(192,155,90,.22)] bg-[linear-gradient(135deg,var(--navy),#13294B)] p-10 text-white shadow-lg">
          <p className="text-sm font-semibold tracking-wide text-[#D9C08A]">حكيم · واجهة المطوّرين</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">API المعرفة القانونية السعودية</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/80">
            تكامل موقعك أو نظام الذكاء الاصطناعي لديك مع النواة القانونية لمنصّة حكيم: بحث في الأنظمة والمواد والمبادئ،
            مع استناد رسمي إلى المصدر — بلا اختلاق ولا هلوسة. الوصول عبر مفتاح API بنطاق <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">legal:read</code>.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/api-docs" className="rounded-lg bg-[var(--gold)] px-5 py-3 font-semibold text-[var(--navy)] transition hover:opacity-90">
              توثيق الواجهات التفاعلي ↗
            </Link>
            <a href="/api/openapi" className="rounded-lg border border-white/25 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              مواصفة OpenAPI (JSON)
            </a>
          </div>
        </header>

        {/* Quickstart */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">البدء السريع</h2>
          <div className={`${card} mt-4`}>
            <p className="text-sm font-semibold text-[var(--navy)]">١) المصادقة — مرّر مفتاحك في الترويسة:</p>
            <pre dir="ltr" className="mt-3 overflow-x-auto rounded-lg bg-[var(--navy)] p-4 text-sm leading-6 text-[#E9E2D0]">
{`Authorization: Bearer hk_live_XXXXXXXXXXXXXXXX`}
            </pre>
            <p className="mt-5 text-sm font-semibold text-[var(--navy)]">٢) مثال بحث (cURL):</p>
            <pre dir="ltr" className="mt-3 overflow-x-auto rounded-lg bg-[var(--navy)] p-4 text-sm leading-6 text-[#E9E2D0]">
{`curl -H "Authorization: Bearer hk_live_XXXX" \\
  "${BASE}/api/legal/search?q=%D8%A7%D9%84%D8%A5%D9%8A%D8%AC%D8%A7%D8%B1&limit=10"`}
            </pre>
            <p className="mt-5 text-sm font-semibold text-[var(--navy)]">٣) مثال (JavaScript):</p>
            <pre dir="ltr" className="mt-3 overflow-x-auto rounded-lg bg-[var(--navy)] p-4 text-sm leading-6 text-[#E9E2D0]">
{`const res = await fetch("${BASE}/api/legal/search?q=" + encodeURIComponent("فسخ عقد الإيجار"), {
  headers: { Authorization: "Bearer hk_live_XXXX" }
});
const data = await res.json();`}
            </pre>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">المسارات المتاحة</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[rgba(192,155,90,.28)] bg-white">
            <table className="w-full min-w-[680px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-[#F3EEE2] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th scope="col" className="w-20">الطريقة</th>
                  <th scope="col">المسار</th>
                  <th scope="col">الوظيفة</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e.path} className="border-b border-black/5 odd:bg-white even:bg-[var(--parchment)]">
                    <td className="px-4 py-3"><span className="rounded bg-[#E6F1EA] px-2 py-1 font-mono text-xs font-bold text-[var(--emerald)]">{e.method}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--navy)]" dir="ltr">{e.path}</td>
                    <td className="px-4 py-3 leading-7 text-gray-700">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            الرموز: <b>401</b> مفتاح مفقود/غير صالح · <b>403</b> نطاق غير كافٍ · <b>429</b> تجاوز حدّ المعدّل · <b>400</b> مدخل خاطئ.
          </p>
        </section>

        {/* How to get access */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">كيف تحصل على وصول</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className={card}>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--navy)] font-bold text-[#D9C08A]">{s.n}</div>
                <h3 className="mt-4 text-lg font-bold">{s.h}</h3>
                <p className="mt-2 text-sm leading-7 text-gray-700">{s.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Governance */}
        <section className="mt-10">
          <div className="rounded-2xl border border-[var(--gold)] bg-[#FBF6EA] p-6">
            <h2 className="text-xl font-bold">الحوكمة والحدود</h2>
            <ul className="mt-3 list-disc space-y-2 pr-5 leading-8 text-gray-700">
              <li>كل استشهاد بمادة أو حكم يأتي حصرًا من النواة القانونية الرسمية — لا يُختلق مصدر.</li>
              <li>المواءمة الفقهية مساندة وغير مُلزِمة، ومُعلّمة صراحةً في الاستجابة.</li>
              <li>لكل مفتاح حدّ معدّل ونطاق محدّد؛ ويمكن إيقافه في أي وقت.</li>
              <li>المخرجات مرجعية للبحث والتكامل، ولا تُعدّ رأيًا قانونيًا نهائيًا أو حكمًا.</li>
            </ul>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-black/10 pt-6 text-sm text-gray-600">
          <Link href="/legal" className="font-semibold text-[var(--navy)] hover:underline">تصفّح الأنظمة</Link>
          <Link href="/api-docs" className="font-semibold text-[var(--navy)] hover:underline">التوثيق التفاعلي</Link>
          <Link href="/terms" className="hover:underline">شروط الاستخدام</Link>
          <Link href="/privacy" className="hover:underline">الخصوصية</Link>
          <span className="ms-auto">© منصّة حكيم</span>
        </footer>
      </div>
    </main>
  );
}
