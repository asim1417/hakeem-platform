import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug, lawSlug } from "@/lib/modules/legal-core/eli";
import { PublicLegalShell, Crumb } from "@/components/public/PublicLegalShell";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { issuanceInstrument, latestVerification, latestVerifications, storedInstrumentKind } from "@/lib/modules/legal-core/verification-read";
import { citationFlagsFromVerification } from "@/lib/modules/legal-core/verified-status";
import { parseAsOfDate } from "@/lib/modules/legal-core/work-edition";
import { displayedSystem } from "@/lib/modules/legal-core/work-edition-read";
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

  const asOfRaw = searchParams?.asOf?.trim() ?? "";
  const asOfDate = parseAsOfDate(asOfRaw);
  const route = await displayedSystem(system.id, asOfDate);
  const shown = route.redirected
    ? (await prisma.legalSystem.findUnique({ where: { id: route.id } }).catch(() => null)) ?? system
    : system;
  const slug = resolveSystemSlug(system.eliSlug, system.name);
  const kind = resolveWorkKind(shown.name, await storedInstrumentKind(shown.id));
  const articles = await prisma.legalArticle
    .findMany({
      // حارس عرض (DATA-001): استبعاد المواد ذات الرقم ≤ 0 (مثل سجل «المادة ٠») من
      // القائمة والتنقل — دون تعديل أي بيانات في القاعدة.
      where: { AND: [{ OR: [{ legalSystemId: shown.id }, { lawName: shown.name }] }, { articleNumber: { gt: 0 } }] },
      select: { id: true, articleNumber: true, title: true },
      orderBy: { articleNumber: "asc" },
    })
    .catch(() => []);
  const [flags, workVerification, issuance] = await Promise.all([
    latestVerifications("unit", articles.map((a) => a.id)),
    latestVerification("work", system.id),
    issuanceInstrument(system.name),
  ]);
  const workFlags = citationFlagsFromVerification(workVerification);

  // LIVE-001: تعريف BASE من عنوان الموقع قبل استعماله في JSON-LD (كان غير معرّف فيتعطل).
  const BASE = getSiteUrl();
  const ld = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: shown.name,
    legislationJurisdiction: "SA",
    inLanguage: "ar",
    url: `${BASE}/legal/${encodeURIComponent(slug)}`,
    hasPart: articles.slice(0, 200).map((a) => ({ "@type": "Legislation", name: `المادة ${a.articleNumber}`, url: `${BASE}/legal/${encodeURIComponent(slug)}/${a.articleNumber}` })),
  };

  return (
    <PublicLegalShell breadcrumb={<Crumb label={system.name} />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header>
        <h1 className="text-3xl font-bold leading-snug md:text-4xl">{shown.name}</h1>
        {route.redirected ? (
          <p className="mt-2 text-sm text-muted">السجل المخزّن بهذا الاسم لا يُعرض. النص الظاهر عمل مستقل{route.instrument ? ` — ${route.instrument}` : ""}.</p>
        ) : null}
        {kind ? <p className="mt-2 text-sm font-semibold text-[#A9793F]">{kind}</p> : null}
        <AsOfForm asOf={asOfRaw} />
        <p className="mt-3 text-ink">
          {articles.length.toLocaleString("ar-SA")} مادة{system.domainTitle ? ` · ${system.domainTitle}` : ""}.
        </p>
        {route.status ? (
          <div role="note" className={`mt-4 rounded-xl border-2 p-4 ${route.status === "مستبدل" ? "border-red-600 bg-red-50 text-red-900" : route.status === "صادر لم يسرِ بعد" ? "border-amber-500 bg-amber-50 text-amber-950" : "border-[#C69763]/40 bg-ivory text-[var(--navy)]"}`}>
            <p className="text-base font-extrabold">{route.status}</p>
            {route.instrument ? <p className="mt-1 text-sm leading-7">{route.instrument}</p> : null}
          </div>
        ) : workVerification && workFlags.statusLabel !== "الحالة قيد التحقق من المصدر" ? (
          <div role="note" className={`mt-4 rounded-xl border-2 p-4 ${workFlags.repealed || workFlags.statusLabel === "مستبدل" ? "border-red-600 bg-red-50 text-red-900" : workFlags.statusLabel === "صادر لم يسرِ بعد" ? "border-amber-500 bg-amber-50 text-amber-950" : "border-[#C69763]/40 bg-ivory text-[var(--navy)]"}`}>
            <p className="text-base font-extrabold">{workFlags.statusLabel}</p>
            {workVerification.evidenceInstrument ? <p className="mt-1 text-sm leading-7">{workVerification.evidenceInstrument}</p> : null}
            {workVerification.evidenceQuote ? <p className="mt-2 text-sm leading-7">{workVerification.evidenceQuote}</p> : null}
            {workVerification.evidenceUrl ? (
              <a className="mt-2 inline-block text-sm underline" href={workVerification.evidenceUrl}>مصدر الأداة</a>
            ) : null}
          </div>
        ) : null}
      </header>

      {shown.preamble?.trim() ? (
        <section className="mt-6 rounded-xl border border-[#C69763]/25 bg-ivory p-5" aria-label="الديباجة">
          <h2 className="text-lg font-bold text-[var(--navy)]">الديباجة</h2>
          {shown.preambleRoyalDecree ? (
            <p className="mt-1 text-sm text-muted">{shown.preambleRoyalDecree}</p>
          ) : null}
          <p className="mt-3 whitespace-pre-line leading-8 text-[var(--navy)]">{shown.preamble}</p>
        </section>
      ) : null}

      {issuance ? (
        <section className="mt-6 rounded-xl border border-[#C69763]/25 bg-ivory p-5" aria-label="أداة الإصدار">
          <h2 className="text-lg font-bold text-[var(--navy)]">أداة الإصدار</h2>
          <p className="mt-1 text-sm text-muted">{issuance.instrumentKind} {issuance.instrumentNo} · {issuance.instrumentDateHijri}</p>
          <p className="mt-3 whitespace-pre-line leading-8 text-[var(--navy)]">{issuance.approvingClause}</p>
          <a className="mt-2 inline-block text-sm underline" href={issuance.sourceUrl}>نص الأداة في أم القرى</a>
        </section>
      ) : null}

      {articles.length ? (
        <ul className="mt-6 divide-y divide-black/5 rounded-xl border border-[#C69763]/25 bg-ivory">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/legal/${encodeURIComponent(slug)}/${a.articleNumber}${asOfRaw ? `?asOf=${asOfRaw}` : ""}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-[var(--parchment)]">
                <span className="mt-0.5 shrink-0 rounded bg-[var(--navy)] px-2 py-1 font-mono text-xs font-bold text-[#E8D6BC]">م {a.articleNumber.toLocaleString("ar-SA")}</span>
                {(() => {
                  const flag = route.status
                    ? { inForce: route.status === "ساري", repealed: false, statusLabel: route.status }
                    : citationFlagsFromVerification(flags.get(a.id) ?? null);
                  const unverified = flag.statusLabel.includes("قيد التحقق");
                  const retired = flag.repealed || flag.statusLabel === "مستبدل";
                  return (
                    <>
                      <span className={`leading-7 ${retired ? "text-slate-400" : "text-[var(--navy)]"}`}>{a.title}</span>
                      {retired ? (
                        <span className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-bold" style={{ background: "#fee2e2", color: "#b91c1c" }}>{flag.statusLabel}</span>
                      ) : unverified ? (
                        <span className="mt-0.5 shrink-0 text-xs text-muted">قيد التحقق</span>
                      ) : (
                        <span className="mt-0.5 shrink-0 text-xs text-muted">{flag.statusLabel}</span>
                      )}
                    </>
                  );
                })()}
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
