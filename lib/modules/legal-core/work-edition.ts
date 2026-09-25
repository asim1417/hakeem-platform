/**
 * توجيه السجل المخلوط إلى عملين مستقلين بحسب التاريخ.
 * السجل المخلوط لا يُعدَّل. الاختيار دالة خالصة تُختبر بلا قاعدة.
 */

export const MIXED_RECORD_STATUS = "سجل مخلوط — لا يُعرض";

export interface EditionWindow {
  editionSystemId: string;
  instrument: string | null;
  role: "old" | "new";
  validFrom: string;
  validTo: string | null;
}

export type EditionStatus = "ساري" | "مستبدل" | "صادر لم يسرِ بعد";

/** تاريخ العرض. السنة 19xx/20xx ميلادي. غير ذلك = اليوم. */
export function parseAsOfDate(raw: string | undefined | null, now = new Date()): Date {
  const v = (raw ?? "").trim();
  if (/^(19|20)\d{2}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00Z`);
  return now;
}

export function dayKey(asOf: Date): string {
  return asOf.toISOString().slice(0, 10);
}

/** النافذة التي تغطي التاريخ. عند التماس الحد يُقدَّم الأحدث بدءًا. */
export function pickEdition(editions: EditionWindow[], asOf: Date): EditionWindow | null {
  const day = dayKey(asOf);
  const open = editions.filter((e) => e.validFrom <= day && (e.validTo == null || day < e.validTo));
  if (!open.length) return null;
  return [...open].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

export function editionStatus(edition: EditionWindow, asOf: Date): EditionStatus {
  const day = dayKey(asOf);
  if (edition.role === "new" && day < edition.validFrom) return "صادر لم يسرِ بعد";
  if (edition.role === "old" && edition.validTo != null && day >= edition.validTo) return "مستبدل";
  return "ساري";
}
