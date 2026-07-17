import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug, buildArticleEli, lawSlug } from "@/lib/modules/legal-core/eli";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";
import { PublicLegalShell, Crumb } from "@/components/public/PublicLegalShell";

export const revalidate = 3600;
const BASE = "https://hakeem-platform.vercel.app";

async function resolveSystem(slug: string) {
  const raw = slug.trim();
  const norm = lawSlug(raw); // تطبيع الوارد ليطابق eliSlug المطبَّع
  const byEli = await prisma.legalSystem.findFirst({ where: { eliSlug: norm } }).catch(() => null);
  if (byEli) return byEli;
  const byId = await prisma.legalSystem.findUnique({ where: { id: raw } }).catch(() => null);
  if (byId) return byId;
  const all = await prisma.legalSystem.findMany({ select: { id: true, name: true, eliSlug: true } }).catch(() => []);
  const m = all.find((x) => resolveSystemSlug(x.eliSlug, x.name) === norm);
  return m ? prisma.legalSystem.findUnique({ where: { id: m.id } }).catch(() => null) : null;
}

async function loadArticle(slug: string, articleParam: string) {
  const n = Number(articleParam);
  if (!Number.isInteger(n) || n <= 0) return null;
  const system = await resolveSystem(slug);
  if (!system) return null;
  const article = await prisma.legalArticle
    .findFirst({ where: { AND: [{ OR: [{ legalSystemId: system.id }, { lawName: system.name }] }, { articleNumber: n }] } })
    .catch(() => null);
  if (!article) return null;
  return { system, article, n };
}

export async function generateMetadata({ params }: { params: { slug: string; article: string } }): Promise<Metadata> {
  const data = await loadArticle(decodeURIComponent(params.slug), params.article);
  if (!data) return { title: "مادة غير موجودة — حكيم" };
  const slug = resolveSystemSlug(data.system.eliSlug, data.system.name);
  const text = sanitizeDisplayText(data.article.content).slice(0, 155);
  return {
    title: `${data.system.name} — المادة ${data.n} | حكيم`,
    description: text,
    alternates: { canonical: `${BASE}/legal/${encodeURIComponent(slug)}/${data.n}` },
  };
}

export default async function LegalArticlePage({ params }: { params: { slug: string; article: string } }) {
  const data = await loadArticle(decodeURIComponent(params.slug), params.article);
  if (!data) notFound();
  const { system, article, n } = data;
  const slug = resolveSystemSlug(system.eliSlug, system.name);
  const content = sanitizeDisplayText(article.content);
  const eli = buildArticleEli(system.name, n, system.eliSlug).id;
  const citation = `${system.name}، المادة (${n})${article.royalDecree ? ` — ${article.royalDecree}` : ""}`;

  const [prev, next] = await Promise.all([
    prisma.legalArticle.findFirst({ where: { OR: [{ legalSystemId: system.id }, { lawName: system.name }], articleNumber: { lt: n } }, orderBy: { articleNumber: "desc" }, select: { articleNumber: true } }).catch(() => null),
    prisma.legalArticle.findFirst({ where: { OR: [{ legalSystemId: system.id }, { lawName: system.name }], articleNumber: { gt: n } }, orderBy: { articleNumber: "asc" }, select: { articleNumber: true } }).catch(() => null),
  ]);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: `${system.name} — المادة ${n}`,
    legislationJurisdiction: "SA",
    inLanguage: "ar",
    isPartOf: { "@type": "Legislation", name: system.name, url: `${BASE}/legal/${encodeURIComponent(slug)}` },
    text: content,
    url: `${BASE}/legal/${encodeURIComponent(slug)}/${n}`,
  };

  return (
    <PublicLegalShell breadcrumb={<><Crumb href={`/legal/${encodeURIComponent(slug)}`} label={system.name} /><Crumb label={`المادة ${n}`} /></>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <article>
        <p className="text-sm font-semibold text-[#A9793F]">{system.name}</p>
        <h1 className="mt-2 text-3xl font-bold">المادة {n.toLocaleString("ar-SA")}</h1>
        {article.title && article.title !== String(n) ? <p className="mt-2 text-lg text-ink">{article.title}</p> : null}

        <div className="mt-6 whitespace-pre-wrap rounded-xl border border-[#C69763]/25 bg-ivory p-6 text-lg leading-9 text-[var(--navy)]">
          {content}
        </div>

        <div className="mt-4 rounded-lg border border-[#C69763]/40 bg-[#FBFAF6] p-4 text-sm leading-7 text-[var(--navy)]">
          <p><b>الاستناد الرسمي:</b> {citation}</p>
          <p className="mt-1 font-mono text-xs" dir="ltr"><b>ELI:</b> {eli}</p>
          <p className="mt-2 text-xs text-muted">النصّ النظامي هو المصدر الأصلي؛ يُرجى التحقّق من مصدره الرسمي عند الاعتماد.</p>
        </div>

        <nav className="mt-6 flex items-center justify-between text-sm">
          {prev ? (
            <Link href={`/legal/${encodeURIComponent(slug)}/${prev.articleNumber}`} className="rounded-md border border-[#C69763]/40 px-4 py-2 font-semibold hover:bg-[#C69763]/10">← المادة {prev.articleNumber.toLocaleString("ar-SA")}</Link>
          ) : <span />}
          <Link href={`/legal/${encodeURIComponent(slug)}`} className="rounded-md px-4 py-2 text-[var(--navy)] hover:underline">كل مواد النظام</Link>
          {next ? (
            <Link href={`/legal/${encodeURIComponent(slug)}/${next.articleNumber}`} className="rounded-md border border-[#C69763]/40 px-4 py-2 font-semibold hover:bg-[#C69763]/10">المادة {next.articleNumber.toLocaleString("ar-SA")} →</Link>
          ) : <span />}
        </nav>
      </article>
    </PublicLegalShell>
  );
}
