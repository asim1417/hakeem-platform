// تحويل تاريخ هجري إلى ميلادي بتقويم أم القرى (ق-١١)، عبر Intl (islamic-umalqura في ICU).
// دالة نقية: تعيد التاريخ الميلادي، أو null إن لم يكن اليوم موجودًا في التقويم (شهر 13، أو يوم 30 في شهر من 29…).
// نطاق التحقق 1300–1500هـ؛ خارجه لا يُعتمد جدول أم القرى في ICU.

const UMM_AL_QURA = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

const DAY_MS = 86_400_000;
// أول محرم 1هـ تقريبًا (16 يوليو 622م)، وطول السنة الهجرية الوسطي 354.367 يومًا.
const EPOCH_MS = Date.UTC(622, 6, 16);

function partsOf(ms: number): { y: number; m: number; d: number } {
  const parts = UMM_AL_QURA.formatToParts(ms);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: read("year"), m: read("month"), d: read("day") };
}

export function parseHijri(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** «1446-09-01» ← «2025-03-01». غير الموجود في التقويم = null. */
export function hijriToGregorian(value: string): string | null {
  const h = parseHijri(value);
  if (!h) return null;
  if (h.y < 1300 || h.y > 1500 || h.m < 1 || h.m > 12 || h.d < 1 || h.d > 30) return null;
  const approx = EPOCH_MS + Math.round(((h.y - 1) * 354.367 + (h.m - 1) * 29.53 + (h.d - 1)) * DAY_MS);
  const start = Math.floor(approx / DAY_MS) * DAY_MS - 45 * DAY_MS;
  for (let i = 0; i <= 90; i += 1) {
    const ms = start + i * DAY_MS;
    const p = partsOf(ms);
    if (p.y === h.y && p.m === h.m && p.d === h.d) return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

/** التاريخ الميلادي «YYYY-MM-DD» إلى هجري أم القرى «YYYY-MM-DD»، أو null إن لم يكن تاريخًا صالحًا. */
export function gregorianToHijri(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const back = new Date(ms).toISOString().slice(0, 10);
  if (back !== value.trim()) return null;
  const p = partsOf(ms);
  if (!Number.isFinite(p.y)) return null;
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
