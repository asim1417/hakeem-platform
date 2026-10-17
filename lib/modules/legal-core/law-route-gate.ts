/**
 * HKM-023-B (ع-١٥، بند الجودة م١) — بوابة مسارات /law في الوسيط: تحويل دائم حقيقي (301) و404 حقيقي.
 * السبب: app/loading.tsx الجذري يبث الصفحة داخل Suspense، فيُثبَّت 200 قبل وصول permanentRedirect/notFound
 * من الصفحة أو من generateMetadata. الوسيط يحسم قبل الرسم بجدول خفيف من /api/law-routes.
 * نقي وآمن للوسيط (Edge): لا Prisma ولا Node. عند تعذّر الجدول يمرّ الطلب (السلوك السابق) ولا ينكسر.
 */
import { lawSlug } from "./eli";

/** صف الجدول: [المعرّف الداخلي، المعرّف الكنسي، نطاقات أرقام المواد «1-100,102»]. */
export type LawRouteRow = [string, string, string];

export interface LawRouteTable {
  byCanonical: Map<string, string>; // كنسي → نطاقات
  canonicalById: Map<string, string>;
}

export function buildLawRouteTable(rows: LawRouteRow[]): LawRouteTable {
  const byCanonical = new Map<string, string>();
  const canonicalById = new Map<string, string>();
  for (const [id, canonical, ranges] of rows) {
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, ranges);
    canonicalById.set(id, canonical);
  }
  return { byCanonical, canonicalById };
}

/** يضغط أرقام المواد إلى نطاقات: [1,2,3,5] → «1-3,5». */
export function encodeRanges(nums: number[]): string {
  const s = [...new Set(nums.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? String(s[i]) : `${s[i]}-${s[j]}`);
    i = j + 1;
  }
  return out.join(",");
}

export function inRanges(ranges: string, n: number): boolean {
  for (const part of ranges.split(",")) {
    if (!part) continue;
    const [a, b] = part.split("-").map(Number);
    if (n >= a && n <= (Number.isFinite(b) ? b : a)) return true;
  }
  return false;
}

export type LawGateDecision = { kind: "pass" } | { kind: "redirect"; to: string } | { kind: "not_found" };

const LAW_RE = /^\/law\/([^/]+)(?:\/art\/([^/]+))?\/?$/;
const DASH_RE = /^\/dashboard\/legal-core\/systems\/([^/]+)\/?$/;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** القرار لمسار واحد. `search` يُحفظ في التحويل. */
export function decideLawRoute(pathname: string, search: string, t: LawRouteTable): LawGateDecision {
  const dash = pathname.match(DASH_RE);
  if (dash) {
    const id = safeDecode(dash[1]);
    const canonical = t.canonicalById.get(id) ?? (t.byCanonical.has(lawSlug(id)) ? lawSlug(id) : null);
    return canonical ? { kind: "redirect", to: `/law/${encodeURIComponent(canonical)}` } : { kind: "pass" };
  }
  const m = pathname.match(LAW_RE);
  if (!m) return { kind: "pass" };
  const seg = safeDecode(m[1]).trim();
  const artRaw = m[2] ? safeDecode(m[2]) : null;
  const art = artRaw === null ? null : Number(artRaw);
  if (artRaw !== null && (!Number.isInteger(art) || (art as number) <= 0)) return { kind: "not_found" };
  let canonical: string | null = t.byCanonical.has(seg) ? seg : null;
  const exact = canonical !== null;
  if (!canonical) canonical = t.canonicalById.get(seg) ?? (t.byCanonical.has(lawSlug(seg)) ? lawSlug(seg) : null);
  if (!canonical) return { kind: "not_found" };
  if (art !== null && !inRanges(t.byCanonical.get(canonical) ?? "", art)) return { kind: "not_found" };
  if (exact) return { kind: "pass" };
  return { kind: "redirect", to: `/law/${encodeURIComponent(canonical)}${art !== null ? `/art/${art}` : ""}${search}` };
}

export const LAW_NOT_FOUND_HTML =
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>غير موجود — حكيم</title></head>' +
  '<body style="font-family:system-ui,Tahoma,sans-serif;background:#FBFAF6;color:#12211F;margin:0;padding:48px 16px;text-align:center">' +
  '<h1 style="font-size:22px;color:#0E3435">لم نجد نظامًا أو مادة بهذا الرابط</h1><p>ربما تغيّر الرابط أو كُتب خطأ.</p>' +
  '<p><a href="/legal" style="color:#0E3435;font-weight:600">ابحث في الأنظمة</a></p></body></html>';
