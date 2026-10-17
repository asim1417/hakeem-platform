import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, getSiteUrl } from "@/lib/modules/config/site-url";
import { resolveSystemSlug, buildArticleEli, lawSlug } from "@/lib/modules/legal-core/eli";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";
import { PublicLegalShell, Crumb } from "@/components/public/PublicLegalShell";
import { ArticlePresentation, AsOfForm } from "@/components/legal/ArticlePresentation";
import { citationFlagsFromVerification, presentArticle } from "@/lib/modules/legal-core/verified-status";
import { loadSearchSurface, unitStatusAsOf, workStatusAsOf } from "@/lib/modules/legal-core/search-surface";
import { latestVerification, unitVersions } from "@/lib/modules/legal-core/verification-read";
import { effectiveArticleTexts, resolveEffectiveText } from "@/lib/modules/legal-core/effective-text";
import { articleKey, articleLabel } from "@/lib/modules/legal-core/article-key";

export const revalidate = 3600;

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
  // «20» للأصل و«20_bis» لـ«20 مكرر» (HKM-028، كمعرّف art_N_bis في hkn-uri).
  const m = /^(\d+)(?:_bis(\d*))?$/.exec(decodeURIComponent(articleParam));
  const n = m ? Number(m[1]) : NaN;
  const bis = m?.[2] !== undefined ? Number(m[2] || 1) : 0;
  if (!Number.isInteger(n) || n <= 0) return null;
  const system = await resolveSystem(slug);
  if (!system) return null;
  const article = await prisma.legalArticle
    .findFirst({ where: { AND: [{ OR: [{ legalSystemId: system.id }, { lawName: system.name }] }, { articleNumber: n, articleBis: bis }] } })
    .catch(() => null);
  if (!article) return null;
  return { system, article, n, bis, key: articleKey(n, bis) };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string; article: string };
  searchParams?: { asOf?: string };
}): Promise<Metadata> {
  const data = await loadArticle(decodeURIComponent(params.slug), params.article);
  if (!data) return { title: "مادة غير موجودة — حكيم" };
  const slug = resolveSystemSlug(data.system.eliSlug, data.system.name);
  // الوصف من النص الساري (المصدر الواحد)، لا من legal_articles.content مباشرة.
  const asOfRaw = searchParams?.asOf?.trim() ?? "";
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? new Date(`${asOfRaw}T12:00:00Z`) : undefined;
  const effective = (await effectiveArticleTexts([{ id: data.article.id, content: sanitizeDisplayText(data.article.content) }], asOf)).get(data.article.id);
  const text = sanitizeDisplayText(effective?.text ?? data.article.content).slice(0, 155);
  return {
    title: `${data.system.name} — المادة ${articleLabel(data.n, data.bis)} | حكيم`,
    description: text,
    alternates: { canonical: absoluteUrl(`/legal/${encodeURIComponent(slug)}/${data.key}`) },
  };
}

export default async function LegalArticlePage({
  params,
  searchParams,
}: {
  params: { slug: string; article: string };
  searchParams?: { asOf?: string };
}) {
  const data = await loadArticle(decodeURIComponent(params.slug), params.article);
  if (!data) notFound();
  const { system, article, n, bis, key } = data;
  const label = articleLabel(n, bis);
  const slug = resolveSystemSlug(system.eliSlug, system.name);
  const content = sanitizeDisplayText(article.content);
  const asOfRaw = searchParams?.asOf?.trim() ?? "";
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? new Date(`${asOfRaw}T12:00:00Z`) : undefined;
  const [recorded, versions, workVerification, surfaceState] = await Promise.all([
    latestVerification("unit", article.id),
    unitVersions(article.id),
    latestVerification("work", system.id),
    loadSearchSurface(asOf ? asOfRaw : undefined, { includeRepealed: true }),
  ]);
  // حالة المادة تتبع انتقال عملها بتاريخ السريان، كصفحة النظام.
  const byDate = workStatusAsOf(system.id, citationFlagsFromVerification(workVerification).statusLabel, surfaceState.surface);
  const verification = recorded ? { ...recorded, verifiedStatus: unitStatusAsOf(recorded.verifiedStatus, byDate) } : null;
  const view = presentArticle({ baseText: content, versions, verification, asOf });
  const eli = buildArticleEli(system.name, n, system.eliSlug).id;
  const citation = `${system.name}، المادة (${label}) — ${view.citationSuffix}`;

  const [prev, next] = await Promise.all([
    // السابقة والتالية بترتيب (الرقم، درجة «مكرر»)؛ الأرقام ≤ 0 ليست مواد.
    prisma.legalArticle.findFirst({ where: { AND: [{ OR: [{ legalSystemId: system.id }, { lawName: system.name }] }, { articleNumber: { gt: 0 } }, { OR: [{ articleNumber: { lt: n } }, { articleNumber: n, articleBis: { lt: bis } }] }] }, orderBy: [{ articleNumber: "desc" }, { articleBis: "desc" }], select: { articleNumber: true, articleBis: true } }).catch(() => null),
    prisma.legalArticle.findFirst({ where: { AND: [{ OR: [{ legalSystemId: system.id }, { lawName: system.name }] }, { OR: [{ articleNumber: { gt: n } }, { articleNumber: n, articleBis: { gt: bis } }] }] }, orderBy: [{ articleNumber: "asc" }, { articleBis: "asc" }], select: { articleNumber: true, articleBis: true } }).catch(() => null),
  ]);

  const effective = resolveEffectiveText({ articleId: article.id, baseText: content, versions, verification, asOf });
  const BASE = getSiteUrl();
  const ld = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: `${system.name} — المادة ${label}`,
    legislationJurisdiction: "SA",
    inLanguage: "ar",
    isPartOf: { "@type": "Legislation", name: system.name, url: `${BASE}/legal/${encodeURIComponent(slug)}` },
    // JSON-LD يحمل النص المعروض نفسه (الساري في التاريخ المطلوب، أو سطر الإلغاء).
    text: effective.text,
    url: `${BASE}/legal/${encodeURIComponent(slug)}/${key}`,
  };

  return (
    <PublicLegalShell breadcrumb={<><Crumb href={`/legal/${encodeURIComponent(slug)}`} label={system.name} /><Crumb label={`المادة ${label}`} /></>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <article>
        <p className="text-sm font-semibold text-[#A9793F]">{system.name}</p>
        <h1 className="mt-2 text-3xl font-bold">المادة {articleLabel(n, bis, true)}</h1>
        {article.title && article.title !== String(n) && article.title !== label ? <p className="mt-2 text-lg text-ink">{article.title}</p> : null}

        <AsOfForm asOf={asOfRaw} />
        <ArticlePresentation view={view} versions={versions} baseText={content} />

        <div className="mt-4 rounded-lg border border-[#C69763]/40 bg-[#FBFAF6] p-4 text-sm leading-7 text-[var(--navy)]">
          <p><b>الاستناد الرسمي:</b> {citation}</p>
          <p className="mt-1 font-mono text-xs" dir="ltr"><b>ELI:</b> {eli}</p>
          <p className="mt-2 text-xs text-muted">النصّ النظامي هو المصدر الأصلي؛ يُرجى التحقّق من مصدره الرسمي عند الاعتماد.</p>
        </div>

        <nav className="mt-6 flex items-center justify-between text-sm">
          {prev ? (
            <Link href={`/legal/${encodeURIComponent(slug)}/${articleKey(prev.articleNumber, prev.articleBis)}`} className="rounded-md border border-[#C69763]/40 px-4 py-2 font-semibold hover:bg-[#C69763]/10">← المادة {articleLabel(prev.articleNumber, prev.articleBis, true)}</Link>
          ) : <span />}
          <Link href={`/legal/${encodeURIComponent(slug)}`} className="rounded-md px-4 py-2 text-[var(--navy)] hover:underline">كل مواد النظام</Link>
          {next ? (
            <Link href={`/legal/${encodeURIComponent(slug)}/${articleKey(next.articleNumber, next.articleBis)}`} className="rounded-md border border-[#C69763]/40 px-4 py-2 font-semibold hover:bg-[#C69763]/10">المادة {articleLabel(next.articleNumber, next.articleBis, true)} →</Link>
          ) : <span />}
        </nav>
      </article>
    </PublicLegalShell>
  );
}
