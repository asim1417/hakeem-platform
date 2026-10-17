import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getLawPageData } from "@/lib/modules/legal-core/law-page-data";
import { resolveLawRoute } from "@/lib/modules/legal-core/law-route";
import { lawPath, parseAsOfParam } from "@/lib/modules/legal-core/law-page-view";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { LawDocument } from "@/components/law/LawDocument";

export const revalidate = 3600;

type Props = { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> };

function canonicalTarget(id: string, asof: string | null, sp: Props["searchParams"]): string {
  const qs = new URLSearchParams();
  if (asof) qs.set("asof", asof);
  if (typeof sp?.show === "string") qs.set("show", sp.show);
  const q = qs.toString();
  return `${lawPath(id)}${q ? `?${q}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const r = await resolveLawRoute(prismaSqlClient(prisma), params.id);
  // احتياط: الحالة الحقيقية (301/404) يحسمها الوسيط (law-route-gate.ts)، لأن app/loading.tsx الجذري يثبّت 200
  // قبل وصول notFound/permanentRedirect من هنا أو من الجسم. هنا يبقى التحويل في المتصفح إن تعذّر جدول الوسيط.
  if (!r) notFound();
  const asof = parseAsOfParam(searchParams);
  if (r.nonCanonical) permanentRedirect(canonicalTarget(r.canonicalId, asof, searchParams));
  return {
    title: `${r.name} — النص الكامل | حكيم`,
    description: `نص ${r.name} كاملًا بمقدمته وموادّه وحالة كل مادة، مع الإسناد الرسمي في منصّة حكيم.`,
    alternates: { canonical: `${getSiteUrl()}${lawPath(r.canonicalId)}` },
    // ع-١٥: النسخ التاريخية لا تُفهرس.
    robots: asof ? { index: false, follow: true } : undefined,
  };
}

// ع-١، ع-١٥: صفحة النظام الكاملة على المسار الدائم. المعرّف غير الكنسي (معرّف داخلي أو إملاء آخر) يُحوَّل دائمًا.
export default async function LawPage({ params, searchParams }: Props) {
  const db = prismaSqlClient(prisma);
  const r = await resolveLawRoute(db, params.id);
  if (!r) notFound();
  const asof = parseAsOfParam(searchParams);
  if (r.nonCanonical) permanentRedirect(canonicalTarget(r.canonicalId, asof, searchParams));
  const data = await getLawPageData(db, r.systemId, { asOf: asof ?? undefined });
  if (!data) notFound();
  return <LawDocument data={data} id={r.canonicalId} base={getSiteUrl()} asofRequested={asof} />;
}
