/**
 * HKM-063 — تواريخ بطاقة النظام المعروضة (الإصدار والنشر والنفاذ). نقي: بلا قاعدة ولا Prisma.
 *
 * ── الإصدار والنشر (law_card = نسخة بطاقة هيئة الخبراء) ─────────────────────────────
 *   تعرض الهيئة لكثير من الأنظمة القديمة تاريخًا نائبًا لا حقيقيًا، فيُعامل مجهولًا (null) في ثلاث صور:
 *   (أ) الإصدار والنشر كلاهما 1 محرم من السنة نفسها («yyyy/01/01»): كلاهما مجهول.
 *   (ب) النشر 1 محرم وهو أسبق من تاريخ الإصدار: بقية النائب بعد تصحيح تاريخ الإصدار في صف بطاقة لاحق
 *       (النشر لا يسبق الصدور). النشر وحده مجهول.
 *   (ج) النشر 1440/03/21 (تاريخ رفع الهيئة) لنظام صدر قبل 1440: النشر وحده مجهول.
 *   الإصدار المجهول يسقط إلى المصدر التالي القائم في law-page-data (وحدات المقدمة ← legal_system_issuance).
 *
 * ── النفاذ ────────────────────────────────────────────────────────────────────────
 *   1) legal_systems.preamble_effective_from إن وُجد، وكان تاريخًا ميلاديًا معقولًا، ولم يكن نائبًا.
 *      يكون نائبًا إذا ساوى تاريخ الإصدار الميلادي في بطاقة إصدارها الهجري 1 محرم، أو ساوى تاريخ نشر
 *      نائبًا بالصور أعلاه (نُسخ من البطاقة النائبة قبل تصحيحها).
 *   2) وإلا أول يوم صار فيه النظام وجه عمله في search_surface، إن كان ميلاديًا معقولًا (سنة ≥ 1900):
 *      search_surface للإضافة فقط، وفيه صفوف كُتب فيها تاريخ هجري في العمود الميلادي (1391-06-25 مثلًا).
 *   3) وإلا فارغ («غير متوفر»).
 */

export const BOE_UPLOAD_DATE_HIJRI = "1440/03/21";
/** أقل سنة ميلادية معقولة لتاريخ نفاذ نظام سعودي؛ ما دونها تاريخ هجري في عمود ميلادي. */
export const MIN_PLAUSIBLE_GREGORIAN_YEAR = 1900;

export type EffectiveDateSource = "legal_systems" | "search_surface";

export interface CardDates {
  issuedHijri: string | null;
  issuedGregorian: string | null;
  publishedHijri: string | null;
  publishedGregorian: string | null;
}

type HijriParts = [year: number, month: number, day: number];

/** «1443/5/26» أو «1443/05/26» (مع «هـ» اختيارية) → [سنة، شهر، يوم]؛ غيره null. */
export function hijriParts(h: string | null | undefined): HijriParts | null {
  const m = String(h ?? "").trim().replace(/\s*هـ$/, "").match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 1 محرم (yyyy/01/01 أو yyyy/1/1). */
export function isMuharramFirst(h: string | null | undefined): boolean {
  return /\/0?1\/0?1$/.test(String(h ?? "").trim().replace(/\s*هـ$/, ""));
}

const cmpHijri = (a: HijriParts, b: HijriParts): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** YYYY-MM-DD بسنة ≥ 1900. */
export function isPlausibleGregorian(d: string | null | undefined): boolean {
  const m = String(d ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return Boolean(m && Number(m[1]) >= MIN_PLAUSIBLE_GREGORIAN_YEAR);
}

/** أي تاريخي البطاقة نائب لا حقيقي (يُعامل مجهولًا). */
export function cardDatePlaceholders(card: CardDates | null | undefined): { issued: boolean; published: boolean } {
  if (!card) return { issued: false, published: false };
  const issued = hijriParts(card.issuedHijri);
  const published = hijriParts(card.publishedHijri);
  const pubMuharram = isMuharramFirst(card.publishedHijri);
  // (أ) الزوج النائب.
  const pair = Boolean(issued && published && pubMuharram && isMuharramFirst(card.issuedHijri) && issued[0] === published[0]);
  // (ب) نشر في 1 محرم أسبق من الإصدار.
  const pubBeforeIssued = Boolean(issued && published && pubMuharram && cmpHijri(published, issued) < 0);
  // (ج) تاريخ رفع الهيئة لنظام أقدم منه.
  const upload = Boolean(issued && published && cmpHijri(published, hijriParts(BOE_UPLOAD_DATE_HIJRI)!) === 0 && issued[0] < 1440);
  return { issued: pair, published: pair || pubBeforeIssued || upload };
}

/** هل تاريخ النفاذ المخزّن نسخة من تاريخ نائب في البطاقة؟ */
export function isPlaceholderEffectiveDate(stored: string | null | undefined, card: CardDates | null | undefined): boolean {
  if (!stored || !card) return false;
  if (isMuharramFirst(card.issuedHijri) && card.issuedGregorian === stored) return true;
  return cardDatePlaceholders(card).published && card.publishedGregorian === stored;
}

/** تاريخ النفاذ المعروض ومصدره (انظر رأس الملف). */
export function pickEffectiveDate(input: {
  stored: string | null | undefined;
  surfaceFrom: string | null | undefined;
  card: CardDates | null | undefined;
}): { gregorian: string | null; source: EffectiveDateSource | null } {
  const stored = input.stored ? String(input.stored).slice(0, 10) : null;
  if (stored && isPlausibleGregorian(stored) && !isPlaceholderEffectiveDate(stored, input.card)) return { gregorian: stored, source: "legal_systems" };
  const surface = input.surfaceFrom ? String(input.surfaceFrom).slice(0, 10) : null;
  if (surface && isPlausibleGregorian(surface)) return { gregorian: surface, source: "search_surface" };
  return { gregorian: null, source: null };
}
