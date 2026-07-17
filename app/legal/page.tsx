import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug } from "@/lib/modules/legal-core/eli";
import { PublicLegalShell } from "@/components/public/PublicLegalShell";

export const revalidate = 3600; // ISR: محتوى نظامي شبه ثابت

export const metadata = {
  title: "الأنظمة القانونية السعودية — منصّة حكيم",
  description: "فهرس عام للأنظمة القانونية السعودية وموادها: بحث ومطالعة نصوص المواد مع الإسناد الرسمي. مصدر موثّق داخل منصّة حكيم.",
  alternates: { canonical: "https://hakeem-platform.vercel.app/legal" },
};

export default async function LegalIndexPage() {
  type SysRow = { id: string; name: string; eliSlug: string | null; domainTitle: string | null; articleCount: number };
  const systems = await prisma.legalSystem
    .findMany({
      where: { articleCount: { gt: 0 } },
      select: { id: true, name: true, eliSlug: true, domainTitle: true, articleCount: true },
      orderBy: [{ sortOrder: "asc" }, { articleCount: "desc" }, { name: "asc" }],
    })
    .catch(() => [] as SysRow[]);

  // تجميع حسب المجال مع الحفاظ على الترتيب.
  const groups: { title: string; items: typeof systems }[] = [];
  for (const s of systems) {
    const title = s.domainTitle ?? "أنظمة أخرى";
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(s);
    else groups.push({ title, items: [s] });
  }

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "الأنظمة القانونية السعودية",
    description: "فهرس الأنظمة القانونية السعودية وموادها في منصّة حكيم.",
    url: "https://hakeem-platform.vercel.app/legal",
  };

  return (
    <PublicLegalShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">الأنظمة القانونية السعودية</h1>
        <p className="mt-3 max-w-3xl leading-8 text-ink">
          مطالعة عامة لنصوص الأنظمة ومَوادّها مع الإسناد الرسمي. {systems.length.toLocaleString("ar-SA")} نظامًا متاحًا للمطالعة.
          للتكامل البرمجي راجع <Link href="/developers" className="font-semibold text-[var(--navy)] underline">واجهة المطوّرين</Link>.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.title} className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--navy)]">
            <span className="h-4 w-1 rounded bg-[var(--gold)]" />
            {g.title}
            <span className="text-xs font-normal text-muted">({g.items.length.toLocaleString("ar-SA")})</span>
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {g.items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/legal/${encodeURIComponent(resolveSystemSlug(s.eliSlug, s.name))}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#C69763]/25 bg-ivory px-4 py-3 transition hover:border-[var(--gold)] hover:shadow-sm"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted">{s.articleCount.toLocaleString("ar-SA")} مادة</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicLegalShell>
  );
}
