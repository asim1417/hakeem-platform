import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { resolveLawRoute } from "@/lib/modules/legal-core/law-route";
import { lawPath } from "@/lib/modules/legal-core/law-page-view";

export const dynamic = "force-dynamic";

// HKM-023-B (ع-١٥): شجرة النظام في اللوحة كانت فهرسًا فقط؛ صارت صفحة النظام الكاملة العامة `/law/<معرّف>`
// (فيها الفهرس الجانبي والنص والحالات). الرابط القديم يُحوَّل دائمًا (الوسيط يعطي 301).
// لا نقطة 404 للنظام بلا مواد بعد اليوم: الصفحة الجديدة تعرض بطاقته ومقدمته و«لا مواد منشورة».
async function redirectToLaw(id: string): Promise<never> {
  const r = await resolveLawRoute(prismaSqlClient(prisma), id).catch(() => null);
  if (!r) notFound();
  permanentRedirect(lawPath(r.canonicalId));
}

// احتياط فقط: الوسيط (law-route-gate.ts) يحوّل 301 قبل الرسم؛ من هنا يصل التحويل بعد تثبيت 200 (app/loading.tsx).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return redirectToLaw(params.id);
}

export default async function LegalSystemTreeRedirect({ params }: { params: { id: string } }) {
  return redirectToLaw(params.id);
}
