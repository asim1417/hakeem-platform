// hijri_date_calc — أداة حتميّة (لا نموذج). حساب المدد عبر رقم اليوم اليوليانيّ (JDN) دقيقٌ تمامًا.
// تحويل هجريّ↔ميلاديّ بالخوارزمية الجدوليّة المدنيّة.
// [تنبيه دقّة قانونيّة]: تقويم أم القرى الرسميّ قد يخالف الجدوليّة بيومٍ أو يومين؛ لحساب مدّةٍ مُلزِمة
// احقن جدول أم القرى عبر setUmmAlQuraTable(). أمّا addDays فدقيقٌ مطلقًا لأنه على JDN لا على التقويم.

export interface HDate { year: number; month: number; day: number; }

export function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
export function jdnToGregorian(jdn: number): HDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + dd - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

const ISLAMIC_EPOCH = 1948440;
export function hijriToJDN(y: number, m: number, d: number): number {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354
    + Math.floor((3 + 11 * y) / 30) + ISLAMIC_EPOCH - 1;
}
export function jdnToHijri(jdn: number): HDate {
  let l = jdn - ISLAMIC_EPOCH + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

type UmmAlQura = { hijriToJDN?: (d: HDate) => number; jdnToHijri?: (j: number) => HDate };
let UAQ: UmmAlQura = {};
export function setUmmAlQuraTable(t: UmmAlQura): void { UAQ = t; }

export const hijriToJDNResolved = (d: HDate) =>
  (UAQ.hijriToJDN ?? ((x: HDate) => hijriToJDN(x.year, x.month, x.day)))(d);
export const jdnToHijriResolved = (j: number) => (UAQ.jdnToHijri ?? jdnToHijri)(j);

export const hijriToGregorian = (d: HDate): HDate => jdnToGregorian(hijriToJDNResolved(d));
export const gregorianToHijri = (d: HDate): HDate =>
  jdnToHijriResolved(gregorianToJDN(d.year, d.month, d.day));

export function addDaysHijri(d: HDate, days: number): HDate {
  return jdnToHijriResolved(hijriToJDNResolved(d) + days);
}
export function daysBetweenHijri(a: HDate, b: HDate): number {
  return hijriToJDNResolved(b) - hijriToJDNResolved(a);
}

export interface DeadlineResult {
  start: HDate; periodDays: number; due: HDate; dueGregorian: HDate; jdnDue: number;
}
export function computeDeadline(notifyHijri: HDate, periodDays: number): DeadlineResult {
  const jdnDue = hijriToJDNResolved(notifyHijri) + periodDays;
  return {
    start: notifyHijri, periodDays,
    due: jdnToHijriResolved(jdnDue),
    dueGregorian: jdnToGregorian(jdnDue),
    jdnDue,
  };
}
