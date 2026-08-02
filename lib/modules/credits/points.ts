// توحيد وحدة النقاط — HKM-BILLING-UX-001.
// «النقطة» واجهة عرض فوق محرك وحدات الاستخدام v2. 1 نقطة = 1000 milli-unit.
// كل الواجهات تعرض «نقاط»؛ كل التخزين/المحرك بالـ milli-units. كل المبالغ بالهللات (أعداد صحيحة).

/** عدد الـ milli-units لكل نقطة واحدة. قابل للضبط عبر البيئة دون تغيير الكود. */
export function milliPerPoint(): number {
  const raw = Number(process.env.POINTS_PER_MILLI);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1000;
}

/** نقاط → milli-units (تخزين داخلي). */
export function pointsToMilli(points: number): bigint {
  if (!Number.isFinite(points)) return 0n;
  return BigInt(Math.round(points * milliPerPoint()));
}

/** milli-units → نقاط (عرض دقيق، قد يكون كسريًا). */
export function milliToPoints(milli: bigint | number): number {
  const m = typeof milli === "bigint" ? Number(milli) : milli;
  if (!Number.isFinite(m)) return 0;
  return m / milliPerPoint();
}

/** milli-units → نقاط صحيحة نزولًا (لعرض «الاستخدامات المتبقية»). */
export function milliToWholePoints(milli: bigint | number): number {
  return Math.floor(milliToPoints(milli));
}

/** ريال → هللات (عدد صحيح). لا أرقام عشرية للأموال. */
export function sarToHalalas(sar: number): number {
  return Math.round(sar * 100);
}

/** هللات → ريال (للعرض فقط). */
export function halalasToSar(halalas: number): number {
  return halalas / 100;
}

export interface VatSplit {
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  vatRateBps: number;
}

/**
 * تقسيم مبلغ إجمالي شامل الضريبة إلى (صافٍ + ضريبة).
 * الأسعار تُعرض للمستهلك شاملة الضريبة (§9)، ونخزّن المكوّنات الثلاثة.
 * vatRateBps: نقاط أساس (1500 = 15%).
 */
export function splitVatInclusive(totalHalalas: number, vatRateBps: number): VatSplit {
  const total = Math.round(totalHalalas);
  const bps = Math.max(0, Math.round(vatRateBps));
  // subtotal = total / (1 + rate)؛ rate = bps/10000.
  const subtotal = Math.round((total * 10000) / (10000 + bps));
  const vat = total - subtotal;
  return { subtotalHalalas: subtotal, vatHalalas: vat, totalHalalas: total, vatRateBps: bps };
}

/**
 * بناء مبلغ إجمالي شامل الضريبة من صافٍ (للفواتير التي تبدأ من الصافي).
 */
export function addVatToSubtotal(subtotalHalalas: number, vatRateBps: number): VatSplit {
  const subtotal = Math.round(subtotalHalalas);
  const bps = Math.max(0, Math.round(vatRateBps));
  const vat = Math.round((subtotal * bps) / 10000);
  return { subtotalHalalas: subtotal, vatHalalas: vat, totalHalalas: subtotal + vat, vatRateBps: bps };
}

/** نسبة ضريبة القيمة المضافة الافتراضية بنقاط الأساس (قابلة للتهيئة). */
export function vatRateBps(): number {
  const raw = Number(process.env.VAT_RATE_BPS);
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 1500;
}
