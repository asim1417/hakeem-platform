// حساب التناسب للترقية/التخفيض — HKM-BILLING-UX-001 (§8). نقيّ، بالهللات/النقاط الصحيحة.
// الترقية فورية بفرق متناسب للأيام المتبقية؛ التخفيض في الدورة التالية (لا استرداد فوري).

export interface ProrationInput {
  fromTotalHalalas: number; // السعر الحالي (شامل الضريبة)
  toTotalHalalas: number; // السعر الجديد (شامل الضريبة)
  daysRemaining: number;
  daysInPeriod: number;
}

export interface ProrationResult {
  amountDueHalalas: number; // ما يُدفع الآن (>= 0)
  fraction: number; // نسبة المدة المتبقية
  isUpgrade: boolean;
}

/** فرق السعر المتناسب مع الأيام المتبقية (يُدفع عند الترقية فقط). */
export function prorateUpgrade(input: ProrationInput): ProrationResult {
  const daysInPeriod = Math.max(1, Math.floor(input.daysInPeriod));
  const daysRemaining = Math.min(daysInPeriod, Math.max(0, Math.floor(input.daysRemaining)));
  const fraction = daysRemaining / daysInPeriod;
  const diff = input.toTotalHalalas - input.fromTotalHalalas;
  const isUpgrade = diff > 0;
  // الترقية فقط تُحصّل فرقًا؛ التخفيض لا يُسترد (يُطبّق الدورة التالية).
  const amountDueHalalas = isUpgrade ? Math.round(diff * fraction) : 0;
  return { amountDueHalalas: Math.max(0, amountDueHalalas), fraction, isUpgrade };
}

/** فرق النقاط المتناسب عند الترقية (يُمنح فورًا). */
export function proratePoints(
  fromPoints: number,
  toPoints: number,
  daysRemaining: number,
  daysInPeriod: number
): number {
  const dip = Math.max(1, Math.floor(daysInPeriod));
  const dr = Math.min(dip, Math.max(0, Math.floor(daysRemaining)));
  const diff = toPoints - fromPoints;
  if (diff <= 0) return 0;
  return Math.round(diff * (dr / dip));
}

/** عدد الأيام المتبقية بين تاريخين (>= 0). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
