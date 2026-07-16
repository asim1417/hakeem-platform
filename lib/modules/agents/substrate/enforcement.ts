// ─────────────────────────────────────────────────────────────────────────────
// المرحلة ١.أ — النفاذ الزمنيّ (Enforcement). لا نبني عمودًا جديدًا: نرفع حقل `status`
// القائم («سارية/معدّلة/منسوخة/موقوفة») + `effectiveFrom` إلى **حالة نفاذ أولى-الدرجة**
// موحّدة عبر الوكيل، فتُقرأ في مرحلة التحقّق (٤) وتُعرض في لوحة الأساس (٦).
// نقيّة وقابلة للاختبار — لا تلمس القاعدة ولا الأمن ولا نواة الترتيب.
// ─────────────────────────────────────────────────────────────────────────────
import { articleStatusBadge } from "@/lib/modules/legal-core/article-status";

/** حالة النفاذ الموحّدة (نظير enforcement في الأمر التنفيذيّ). */
export type EnforcementState = "ساري" | "لاغٍ" | "معدّل" | "موقوف" | "غير_معروف";

export interface EnforcementInfo {
  state: EnforcementState;
  /** هل يُبنى عليه كنصٍّ قائم؟ (الساري والمعدّل نعم؛ اللاغي والموقوف لا). */
  inForce: boolean;
  effectiveDate: Date | null;
}

/**
 * يحوّل قيمة `status` الخام (+ effectiveFrom) إلى حالة نفاذ موحّدة.
 * يعيد استخدام مُطبِّع الشارة القائم (article-status) مصدرًا وحيدًا للحقيقة الوسمية.
 */
export function resolveEnforcement(
  status: string | null | undefined,
  effectiveFrom?: Date | string | null
): EnforcementInfo {
  const badge = articleStatusBadge(status);
  const effectiveDate = normalizeDate(effectiveFrom);
  if (!badge) return { state: "غير_معروف", inForce: true, effectiveDate };
  switch (badge.label) {
    case "سارية":
      return { state: "ساري", inForce: true, effectiveDate };
    case "معدّلة":
      return { state: "معدّل", inForce: true, effectiveDate };
    case "منسوخة":
      return { state: "لاغٍ", inForce: false, effectiveDate };
    case "موقوفة":
      return { state: "موقوف", inForce: false, effectiveDate };
    default:
      return { state: "غير_معروف", inForce: true, effectiveDate };
  }
}

/** هل المادة لاغية (منسوخة)؟ — للتحقّق «صفر لاغٍ يُقدَّم قانونًا قائمًا» (قبول HLS‑4.2). */
export function isRepealed(status: string | null | undefined): boolean {
  return resolveEnforcement(status).state === "لاغٍ";
}

/** هل المادة قابلة للبناء عليها كنصٍّ نافذ حاليًّا؟ (تستبعد اللاغي والموقوف.) */
export function isInForce(status: string | null | undefined): boolean {
  return resolveEnforcement(status).inForce;
}

/** شارة عرض موجزة لحالة النفاذ (للوحة الأساس) — أو null للساري/غير المعروف فلا يُشوَّش. */
export function enforcementBadge(status: string | null | undefined): { label: EnforcementState; warn: boolean } | null {
  const { state } = resolveEnforcement(status);
  if (state === "ساري" || state === "غير_معروف") return null;
  return { label: state, warn: state === "لاغٍ" || state === "موقوف" };
}

function normalizeDate(d?: Date | string | null): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
