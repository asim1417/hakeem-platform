// حساب نافذة تحديد المعدّل (نقيّ، قابل للاختبار) — HKM-BILLING-UX-001 (§14).

/** بداية النافذة الثابتة الحالية (epoch بالثواني). */
export function rateLimitWindowStart(nowSec: number, windowSec: number): number {
  const w = Math.max(1, Math.floor(windowSec));
  return Math.floor(nowSec / w) * w;
}
