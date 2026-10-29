/**
 * HKM-062 — حالة عنقود OpenSearch المشتركة بين المزوّد الهجين وإشارة النواة.
 *
 * العلة: العنقود موقوف من المزوّد (Bonsai يرد 403 «Cluster has been disabled» منذ 22/10)، والمزوّد يرجع [] عند
 * !res.ok بصمت، فسجل الإنتاج يكتب `provider=opensearch outcome=ok` في كل بحث ويدفع رحلة شبكة كل مرة.
 *
 * القاعدة: الرفض الدائم (401/403: عنقود موقوف أو اعتماد مرفوض) يفتح قاطعًا مدة OPENSEARCH_BREAKER_MS
 * (الافتراض 10 دقائق): لا نداء شبكة فيها، ويُسجَّل السبب مرة عند الفتح بمستوى error (يظهر في أخطاء Vercel).
 * الأخطاء العابرة (5xx، المهلة) لا تفتحه، فلا يُسقط عنقود سليم بسبب عطل لحظي. النتائج لا تتغير: كان الرفض
 * يرجع [] أصلًا. دالة صرفة بحالة في الذاكرة (لكل نسخة دالة)، بلا قاعدة.
 */

/** حالات HTTP التي تعني رفضًا دائمًا لا عطلًا لحظيًا. */
const PERSISTENT_FAILURES = new Set([401, 403]);
const DEFAULT_BREAKER_MS = 10 * 60 * 1000;

let blockedUntil = 0;
let blockedReason: string | null = null;

export function openSearchBreakerMs(): number {
  const n = Number(process.env.OPENSEARCH_BREAKER_MS);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_BREAKER_MS;
}

/** وسم الحالة في السجل: http_403. */
export function httpOutcome(status: number): string {
  return `http_${Math.trunc(status)}`;
}

/** يسجّل فشل HTTP؛ يفتح القاطع للرفض الدائم وحده. يعيد true إن فُتح الآن (لا إن كان مفتوحًا). */
export function noteOpenSearchFailure(status: number, source: string, now = Date.now()): boolean {
  if (!PERSISTENT_FAILURES.has(status)) {
    console.warn(`[search] opensearch ${source} outcome=${httpOutcome(status)} (transient, breaker stays closed)`);
    return false;
  }
  const wasOpen = now < blockedUntil;
  const ms = openSearchBreakerMs();
  blockedUntil = now + ms;
  blockedReason = httpOutcome(status);
  if (!wasOpen) console.error(`[search] opensearch ${source} outcome=${blockedReason}; cluster rejected requests, skipping it for ${Math.round(ms / 1000)}s`);
  return !wasOpen;
}

/** سبب الإيقاف إن كان القاطع مفتوحًا (http_403)، وإلا null. */
export function openSearchBlocked(now = Date.now()): string | null {
  return now < blockedUntil ? blockedReason : null;
}

/** للاختبار: يغلق القاطع. */
export function resetOpenSearchBreaker(): void {
  blockedUntil = 0;
  blockedReason = null;
}
