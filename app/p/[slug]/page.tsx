import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomPageBySlug } from "@/lib/modules/site/site-store";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params) {
  const page = await getCustomPageBySlug(params.slug, { onlyEnabled: true });
  if (!page) return { title: "صفحة — حكيم" };
  return {
    title: `${page.title} — حكيم`,
    description: page.body.slice(0, 160),
  };
}

/**
 * صفحات مخصّصة ينشئها السوبر أدمن من /admin/site — نص عادي بلا HTML.
 */
export default async function CustomSitePage({ params }: Params) {
  const page = await getCustomPageBySlug(params.slug, { onlyEnabled: true });
  if (!page) notFound();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] opacity-[0.07]"
        style={{
          background:
            "radial-gradient(55% 90% at 50% 0%, var(--navy) 0%, transparent 70%)",
        }}
      />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-lg font-bold text-[var(--gold-bright)]">
            ح
          </span>
          <span className="text-base font-bold text-[var(--navy)]">حكيم</span>
        </Link>
      </header>

      <article className="relative mx-auto max-w-3xl px-6 pb-20 pt-4">
        <h1 className="font-judicial text-3xl font-bold text-[var(--navy)] md:text-4xl">
          {page.title}
        </h1>
        <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-[var(--ink)]">
          {page.body || "لا محتوى بعد."}
        </div>
      </article>
    </main>
  );
}
