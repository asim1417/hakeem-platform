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

export interface LawTableLoaderOptions {
  fetch: (url: URL, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;
  /** مهلة الجلب؛ بعدها يُلغى ويمر الطلب بالسلوك السابق. */
  timeoutMs?: number;
  okTtlMs?: number;
  failTtlMs?: number;
  now?: () => number;
}

/**
 * محمّل جدول البوابة للوسيط (مراجعة الجودة م٢): مهلة للجلب، وجلب واحد جارٍ تتشاركه الطلبات المتزامنة،
 * وتخزين 10 دقائق عند النجاح و30 ثانية عند الفشل مع إبقاء آخر جدول صالح. لا يرمي أبدًا.
 */
export function createLawTableLoader(opts: LawTableLoaderOptions): (origin: string) => Promise<LawRouteTable | null> {
  const timeoutMs = opts.timeoutMs ?? 1500;
  const okTtl = opts.okTtlMs ?? 600_000;
  const failTtl = opts.failTtlMs ?? 30_000;
  const now = opts.now ?? Date.now;
  let cache: { at: number; ttl: number; table: LawRouteTable | null } | null = null;
  let inFlight: Promise<LawRouteTable | null> | null = null;

  async function fetchTable(origin: string): Promise<LawRouteTable | null> {
    const at = now();
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    try {
      const table = await Promise.race([
        (async () => {
          const res = await opts.fetch(new URL("/api/law-routes", origin), { headers: { accept: "application/json" }, signal: ctrl.signal });
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as { rows?: LawRouteRow[] };
          return buildLawRouteTable(body.rows ?? []);
        })(),
        timeout,
      ]);
      cache = { at, ttl: okTtl, table };
    } catch {
      cache = { at, ttl: failTtl, table: cache?.table ?? null };
    } finally {
      clearTimeout(timer);
    }
    return cache.table;
  }

  return (origin: string) => {
    if (cache && now() - cache.at < cache.ttl) return Promise.resolve(cache.table);
    inFlight ??= fetchTable(origin).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
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

// الصيغة الكنسية لمفتاح المادة؛ نسخة مطابقة لـ ARTICLE_KEY_RE في law-page-view (الوسيط لا يستورد وحدات الصفحة).
const ARTICLE_KEY_RE = /^([1-9]\d{0,4})(_bis([2-9]|[1-9]\d)?)?$/;
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
  // «103» أو «103_bis» أو «103_bis2» (HKM-028) بالصيغة الكنسية وحدها (نفس ARTICLE_KEY_RE في law-page-view)؛ النطاق يُفحص برقم الأصل.
  const artKey = artRaw === null ? null : ARTICLE_KEY_RE.exec(artRaw.trim());
  if (artRaw !== null && !artKey) return { kind: "not_found" };
  const art = artKey ? Number(artKey[1]) : null;
  const artSeg = artKey ? artKey[0] : null;
  let canonical: string | null = t.byCanonical.has(seg) ? seg : null;
  const exact = canonical !== null;
  if (!canonical) canonical = t.canonicalById.get(seg) ?? (t.byCanonical.has(lawSlug(seg)) ? lawSlug(seg) : null);
  if (!canonical) return { kind: "not_found" };
  if (art !== null && !inRanges(t.byCanonical.get(canonical) ?? "", art)) return { kind: "not_found" };
  if (exact) return { kind: "pass" };
  return { kind: "redirect", to: `/law/${encodeURIComponent(canonical)}${artSeg !== null ? `/art/${artSeg}` : ""}${search}` };
}

export const LAW_NOT_FOUND_HTML =
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>غير موجود — حكيم</title></head>' +
  '<body style="font-family:system-ui,Tahoma,sans-serif;background:#FBFAF6;color:#12211F;margin:0;padding:48px 16px;text-align:center">' +
  '<h1 style="font-size:22px;color:#0E3435">لم نجد نظامًا أو مادة بهذا الرابط</h1><p>ربما تغيّر الرابط أو كُتب خطأ.</p>' +
  '<p><a href="/legal" style="color:#0E3435;font-weight:600">ابحث في الأنظمة</a></p></body></html>';
