import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug, lawSlug } from "@/lib/modules/legal-core/eli";
import { PublicLegalShell, Crumb } from "@/components/public/PublicLegalShell";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { issuanceInstrument, latestVerification, latestVerifications, lawCard, storedInstrumentKind, unitVersionsFor } from "@/lib/modules/legal-core/verification-read";
import { citationFlagsFromVerification, presentArticle, UNVERIFIED_NOTICE } from "@/lib/modules/legal-core/verified-status";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";
import { loadSearchSurface } from "@/lib/modules/legal-core/search-surface";
import { LawCardPanel, LawTextBlocks } from "@/components/legal/LawCard";
import { resolveWorkKind } from "@/lib/modules/legal-core/work-kind";
import { AsOfForm } from "@/components/legal/ArticlePresentation";

export const revalidate = 3600;

// يحسم النظام من slug: eliSlug أولًا، ثم id، ثم مطابقة اشتقاق الاسم (احتياطي نادر).
async function resolveSystem(slug: string) {
  const raw = slug.trim();
  const norm = lawSlug(raw); // تطبيع الوارد (ة→ه، الهمزات→ا) ليطابق eliSlug المطبَّع
  const byEli = await prisma.legalSystem.findFirst({ where: { eliSlug: norm } }).catch(() => null);
  if (byEli) return byEli;
  const byId = await prisma.legalSystem.findUnique({ where: { id: raw } }).catch(() => null);
  if (byId) return byId;
  const all = await prisma.legalSystem.findMany({ select: { id: true, name: true, eliSlug: true, articleCount: true, sortOrder: true, domainTitle: true, preamble: true, preambleRoyalDecree: true, preambleEffectiveFrom: true } }).catch(() => []);
  return all.find((x) => resolveSystemSlug(x.eliSlug, x.name) === norm) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const system = await resolveSystem(decodeURIComponent(params.slug));
  if (!system) return { title: "نظام غير موجود — حكيم" };
  const canonical = `${getSiteUrl()}/legal/${encodeURIComponent(resolveSystemSlug(system.eliSlug, system.name))}`;
  return {
    title: `${system.name} — الأنظمة القانونية السعودية | حكيم`,
    description: `نصّ نظام ${system.name} وموادّه كاملة مع الإسناد الرسمي في منصّة حكيم.`,
    alternates: { canonical },
  };
}

export default async function LegalSystemPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { asOf?: string };
}) {
  const system = await resolveSystem(decodeURIComponent(params.slug));
  if (!system) notFound();

  const slug = resolveSystemSlug(system.eliSlug, system.name);
  const asOfRaw = searchParams?.asOf?.trim() ?? "";
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? new Date(`${asOfRaw}T12:00:00Z`) : undefined;
  const kind = resolveWorkKind(system.name, await storedInstrumentKind(system.id));
  const articles = await prisma.legalArticle
    .findMany({
      // حارس عرض (DATA-001): استبعاد المواد ذات الرقم ≤ 0 (مثل سجل «المادة ٠») من
      // القائمة والتنقل — دون تعديل أي بيانات في القاعدة.
      where: { AND: [{ OR: [{ legalSystemId: system.id }, { lawName: system.name }] }, { articleNumber: { gt: 0 } }] },
      select: { id: true, articleNumber: true, title: true, content: true },
      orderBy: { articleNumber: "asc" },
    })
    .catch(() => []);
  const [flags, versionsById, workVerification, issuance, card, surfaceState] = await Promise.all([
    latestVerifications("unit", articles.map((a) => a.id)),
    unitVersionsFor(articles.map((a) => a.id)),
    latestVerification("work", system.id),
    issuanceInstrument(system.name),
    lawCard(system.id),
    loadSearchSurface(asOfRaw && /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? asOfRaw : undefined),
  ]);
  const workFlags = citationFlagsFromVerification(workVerification);
  const statusTone =
    workFlags.statusLabel === UNVERIFIED_NOTICE
      ? "unverified"
      : workFlags.repealed || workFlags.statusLabel === "مستبدل" || workFlags.statusLabel.startsWith("سجل مخلوط")
        ? "retired"
        : workFlags.statusLabel === "صادر لم يسرِ بعد" || workFlags.statusLabel.startsWith("ملغى مع") || workFlags.statusLabel.startsWith("إلغاء جزئي")
          ? "pending"
          : "ok";

  // الأرشيف: النظام خارج وجه الساري اليوم يُعرض كاملًا بالرابط المباشر، مع الإحالة إلى النسخة السارية إن وُجدت.
  let archiveNotice: { label: string; href: string | null } | null = null;
  if (surfaceState.surface.hidden.has(system.id)) {
    const target = surfaceState.surface.redirect.get(system.id) ?? null;
    const targetSystem = target
      ? await prisma.legalSystem.findUnique({ where: { id: target }, select: { name: true, eliSlug: true } }).catch(() => null)
      : null;
    archiveNotice = {
      label: targetSystem
        ? `هذه النسخة ليست النسخة السارية اليوم، ولا تظهر في البحث. النسخة السارية: ${targetSystem.name}.`
        : "هذا النظام ليس ساريًا اليوم، ونصّه محفوظ في الأرشيف ولا يظهر في البحث.",
      href: targetSystem ? `/legal/${encodeURIComponent(resolveSystemSlug(targetSystem.eliSlug, targetSystem.name))}` : null,
    };
  }

  // كتل «نص النظام» قبل المواد: من بطاقة المصدر إن وُجدت، وإلا مما في القاعدة (العنوان، الديباجة، أداة الإصدار).
  const fallbackInstruments = [system.preambleRoyalDecree, issuance ? `${issuance.instrumentNo} · ${issuance.instrumentDateHijri}` : null].filter(
    (x): x is string => Boolean(x && x.trim())
  );

  // LIVE-001: تعريف BASE من عنوان الموقع قبل استعماله في JSON-LD (كان غير معرّف فيتعطل).
  const BASE = getSiteUrl();
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
        {kind ? <p className="mt-2 text-sm font-semibold text-[#A9793F]">{kind}</p> : null}
        <p className="mt-3 text-ink">
          {articles.length.toLocaleString("ar-SA")} مادة{system.domainTitle ? ` · ${system.domainTitle}` : ""}.
        </p>
      </header>

      <LawCardPanel
        name={system.name}
        card={card}
        statusLabel={workFlags.statusLabel}
        statusTone={statusTone}
        statusDetail={workVerification?.evidenceInstrument ?? null}
        fallbackInstruments={fallbackInstruments}
        archiveNotice={archiveNotice}
      />

      <section aria-label="نص النظام" className="mt-8">
        <h2 className="border-b-2 border-[#C69763]/50 pb-2 text-2xl font-extrabold text-[var(--navy)]">نص النظام</h2>
        <AsOfForm asOf={asOfRaw} />

        <div className="mt-6">
          {card?.textBlocks.length ? (
            <LawTextBlocks blocks={card.textBlocks} />
          ) : (
            <div className="space-y-4">
              <p className="text-center text-xl font-extrabold text-[var(--navy)]">{system.name}</p>
              {system.preamble?.trim() ? (
                <div className="rounded-lg border border-[#C69763]/20 bg-white/60 p-4">
                  {system.preambleRoyalDecree ? <p className="text-center font-bold text-[var(--navy)]">{system.preambleRoyalDecree}</p> : null}
                  <p className="mt-2 whitespace-pre-line leading-8 text-[var(--navy)]">{system.preamble}</p>
                </div>
              ) : null}
              {issuance ? (
                <div className="rounded-lg border border-[#C69763]/20 bg-white/60 p-4">
                  <p className="text-center font-bold text-[var(--navy)]">{issuance.instrumentNo} · {issuance.instrumentDateHijri}</p>
                  <p className="mt-2 whitespace-pre-line leading-8 text-[var(--navy)]">{issuance.approvingClause}</p>
                  <a className="mt-2 inline-block text-sm underline" href={issuance.sourceUrl}>نص الأداة في أم القرى</a>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {articles.length ? (
          <ol className="mt-8 space-y-6">
            {articles.map((a) => {
              const verification = flags.get(a.id) ?? null;
              const view = presentArticle({ baseText: sanitizeDisplayText(a.content), versions: versionsById.get(a.id) ?? [], verification, asOf });
              const flag = citationFlagsFromVerification(verification);
              const unverified = flag.statusLabel === UNVERIFIED_NOTICE;
              const retired = flag.repealed || flag.statusLabel === "مستبدل";
              const href = `/legal/${encodeURIComponent(slug)}/${a.articleNumber}${asOfRaw ? `?asOf=${asOfRaw}` : ""}`;
              return (
                <li key={a.id} id={`m${a.articleNumber}`} className="scroll-mt-24">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={href} className="text-lg font-extrabold text-[var(--navy)] hover:underline">
                      {a.title && a.title.trim() && a.title.trim() !== String(a.articleNumber) ? a.title : `المادة ${a.articleNumber.toLocaleString("ar-SA")}`}
                    </Link>
                    {retired ? (
                      <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: "#fee2e2", color: "#b91c1c" }}>{flag.statusLabel}</span>
                    ) : unverified ? (
                      <span className="text-xs text-muted">قيد التحقق</span>
                    ) : (
                      <span className="text-xs text-muted">{flag.statusLabel}</span>
                    )}
                  </div>
                  {view.pendingNotice ? (
                    <p role="note" className="mt-2 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm text-amber-950">{view.pendingNotice}</p>
                  ) : null}
                  <p className={`mt-2 whitespace-pre-wrap leading-9 ${view.faded ? "text-slate-400" : "text-[var(--navy)]"}`}>{view.text}</p>
                  {view.amendmentLine ? <p className="mt-1 text-xs text-muted">{view.amendmentLine}</p> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-[#C69763]/40 bg-ivory p-5 text-muted">لا توجد مواد منشورة لهذا النظام بعد.</p>
        )}
      </section>
    </PublicLegalShell>
  );
}
