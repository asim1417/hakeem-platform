// ─────────────────────────────────────────────────────────────────────────────
// مصدر الحقيقة الوحيد للأرقام الماليّة/الحصص — لا رقم مبعثر خارج هذا الملفّ.
// الأرقام هنا قابلة للضبط عبر متغيّرات البيئة؛ القيم الافتراضية placeholder يضبطها المالك.
// ─────────────────────────────────────────────────────────────────────────────

const intEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const PRICING = {
  /** حصّة الاستخدام المجانيّة الممنوحة مرّة عند التسجيل — متغيّرة عبر FREE_QUOTA. */
  freeQuota: intEnv("FREE_QUOTA", 20),
  /** عتبة التنبيه قرب النفاد (يتبقّى ≤ هذا العدد) — متغيّرة عبر WARN_AT. */
  warnAt: intEnv("WARN_AT", 3),
} as const;

export type Pricing = typeof PRICING;
