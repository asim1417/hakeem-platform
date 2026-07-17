import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug, lawSlug } from "@/lib/modules/legal-core/eli";
import { PublicLegalShell, Crumb } from "@/components/public/PublicLegalShell";

export const revalidate = 3600;

const BASE = "https://hakeem-platform.vercel.app";

// يحسم النظام من slug: eliSlug أولًا، ثم id، ثم مطابقة اشتقاق الاسم (احتياطي نادر).
async function resolveSystem(slug: string) {
  const raw = slug.trim();
  const norm = lawSlug(raw); // تطبيع الوارد (ة→ه، الهمزات→ا) ليطابق eliSlug المطبَّع
  const byEli = await prisma.legalSystem.findFirst({ where: { eliSlug: norm } }).catch(() => null);
  if (byEli) return byEli;
  const byId = await prisma.legalSystem.findUnique({ where: { id: raw } }).catch(() => null);
  if (byId) return byId;
  const all = await prisma.legalSystem.findMany({ select: { id: true, name: true, eliSlug: true, articleCount: true, sortOrder: true, domainTitle: true } }).catch(() => []);
  return all.find((x) => resolveSystemSlug(x.eliSlug, x.name) === norm) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const system = await resolveSystem(decodeURIComponent(params.slug));
  if (!system) return { title: "نظام غير موجود — حكيم" };
  const canonical = `${BASE}/legal/${encodeURIComponent(resolveSystemSlug(system.eliSlug, system.name))}`;
  return {
    title: `${system.name} — الأنظمة القانونية السعودية | حكيم`,
    description: `نصّ نظام ${system.name} وموادّه كاملة مع الإسناد الرسمي في منصّة حكيم.`,
    alternates: { canonical },
  };
}

export default async function LegalSystemPage({ params }: { params: { slug: string } }) {
  const system = await resolveSystem(decodeURIComponent(params.slug));
  if (!system) notFound();

  const slug = resolveSystemSlug(system.eliSlug, system.name);
  const articles = await prisma.legalArticle
    .findMany({
      where: { OR: [{ legalSystemId: system.id }, { lawName: system.name }] },
      select: { id: true, articleNumber: true, title: true },
      orderBy: { articleNumber: "asc" },
    })
    .catch(() => []);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: system.name,
    legislationJurisdiction: "SA",
    inLanguage: "ar",
    url: `${BASE}/legal/${encodeURIComponent(slug)}`,
    hasPart: articles.slice(0, 200).map((a) => ({ "@type": "Legislation", name: `المادة ${a.articleNumber}`, url: `${BASE}/legal/${encodeURIComponent(slug)}/${a.articleNumber}` })),
  };

  return (
    <PublicLegalShell breadcrumb={<Crumb label={system.name} />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header>
        <h1 className="text-3xl font-bold leading-snug md:text-4xl">{system.name}</h1>
        <p className="mt-3 text-ink">
          {articles.length.toLocaleString("ar-SA")} مادة{system.domainTitle ? ` · ${system.domainTitle}` : ""}.
        </p>
      </header>

      {articles.length ? (
        <ul className="mt-6 divide-y divide-black/5 rounded-xl border border-[#C69763]/25 bg-ivory">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/legal/${encodeURIComponent(slug)}/${a.articleNumber}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-[var(--parchment)]">
                <span className="mt-0.5 shrink-0 rounded bg-[var(--navy)] px-2 py-1 font-mono text-xs font-bold text-[#E8D6BC]">م {a.articleNumber.toLocaleString("ar-SA")}</span>
                <span className="leading-7 text-[var(--navy)]">{a.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-[#C69763]/40 bg-ivory p-5 text-muted">لا توجد مواد منشورة لهذا النظام بعد.</p>
      )}
    </PublicLegalShell>
  );
}
