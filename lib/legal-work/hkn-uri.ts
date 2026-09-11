/**
 * المعرّف الدائم في حكيم (HKN-URI)
 * مشتقّ من اصطلاح تسمية أكوما نتوسو، ومعدَّل للسياق السعودي: تقويم هجري وأدوات إصدار محلية.
 *
 *   العمل     hkm:/sa/act/marsoum/1428-10-26/م-85
 *   التعبير   hkm:/sa/act/marsoum/1428-10-26/م-85/ar@1446-07-07
 *   الوحدة    hkm:/sa/act/marsoum/1428-10-26/م-85/ar@1446-07-07/!main~art_74__para_2
 *
 * القاعدة الحاكمة: المعرّف لا يتغيّر أبدًا. التعديل يولّد تعبيرًا جديدًا ولا يمسّ معرّف العمل،
 * وeId يبقى ثابتًا ولو أُلغي نص المادة.
 */

export type DocType = 'act' | 'reg' | 'rules' | 'guide' | 'treaty' | 'circular';

export type Instrument =
  | 'marsoum'        // مرسوم ملكي
  | 'amr-malaki'     // أمر ملكي
  | 'qarar-wuzara'   // قرار مجلس الوزراء
  | 'qarar-wazari'   // قرار وزاري
  | 'qarar-majlis';  // قرار مجلس إدارة جهة

export interface WorkRef {
  country: string;      // sa
  docType: DocType;
  instrument: Instrument;
  hijriDate: string;    // 1428-10-26
  number: string;       // م-85 أو 474
}

export interface ExpressionRef extends WorkRef {
  lang: string;         // ar
  expressionDate: string; // تاريخ بدء نفاذ هذه النسخة، هجري
}

export interface UnitRef extends ExpressionRef {
  component: string;    // main
  eId: string;          // art_74__para_2
}

const HIJRI = /^\d{4}-\d{2}-\d{2}$/;
const SCHEME = 'hkm:';

export class UriError extends Error {}

/** م/85 و م / ٨٥ و «م85» كلها تصير م-85 */
export function normalizeInstrumentNumber(raw: string): string {
  const latin = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return latin
    .replace(/[\u200B-\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, '')
    .replace(/[\/\\.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** أضيق سنة وأوسعها يُقبلان هجريًّا. الغرض: منع تسرّب تاريخ ميلادي بصمت. */
const HIJRI_YEAR_MIN = 1300;
const HIJRI_YEAR_MAX = 1500;

function assertHijri(d: string, field: string): void {
  if (!HIJRI.test(d)) throw new UriError(`${field} يجب أن يكون تاريخًا هجريًّا بصيغة YYYY-MM-DD، ووصل: «${d}»`);
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  if (y < HIJRI_YEAR_MIN || y > HIJRI_YEAR_MAX) {
    throw new UriError(
      `${field}: السنة ${y} خارج النطاق الهجري (${HIJRI_YEAR_MIN}–${HIJRI_YEAR_MAX}). ` +
        `الأرجح أنه تاريخ ميلادي — حوِّله قبل بناء المعرّف.`,
    );
  }
  if (m < 1 || m > 12) throw new UriError(`شهر هجري غير صحيح في ${field}: ${m}`);
  if (day < 1 || day > 30) throw new UriError(`يوم هجري غير صحيح في ${field}: ${day}`);
}

export function buildWorkUri(w: WorkRef): string {
  assertHijri(w.hijriDate, 'تاريخ الأداة');
  const num = normalizeInstrumentNumber(w.number);
  if (!num) throw new UriError('رقم الأداة مفقود');
  return `${SCHEME}/${w.country}/${w.docType}/${w.instrument}/${w.hijriDate}/${num}`;
}

export function buildExpressionUri(workUri: string, lang: string, expressionDate: string): string {
  assertHijri(expressionDate, 'تاريخ التعبير');
  if (!workUri.startsWith(SCHEME)) throw new UriError('معرّف العمل غير صالح');
  if (workUri.includes('@')) throw new UriError('هذا معرّف تعبير لا معرّف عمل');
  return `${workUri}/${lang}@${expressionDate}`;
}

export function buildUnitUri(expressionUri: string, eId: string, component = 'main'): string {
  if (!expressionUri.includes('@')) throw new UriError('يلزم معرّف تعبير لا معرّف عمل');
  if (!/^[a-z][a-z0-9_]*$/.test(eId)) throw new UriError(`eId غير صالح: «${eId}»`);
  return `${expressionUri}/!${component}~${eId}`;
}

/** يقرأ أي معرّف من الثلاثة ويعيد مكوّناته ومستواه */
export function parseUri(uri: string): {
  level: 'work' | 'expression' | 'unit';
  ref: WorkRef | ExpressionRef | UnitRef;
} {
  if (!uri.startsWith(SCHEME)) throw new UriError('المعرّف لا يبدأ بـ hkm:');
  const path = uri.slice(SCHEME.length).replace(/^\//, '');
  const [country, docType, instrument, hijriDate, number, ...rest] = path.split('/');
  if (!country || !docType || !instrument || !hijriDate || !number) {
    throw new UriError('المعرّف ناقص المكوّنات');
  }
  assertHijri(hijriDate, 'تاريخ الأداة');
  const work: WorkRef = {
    country,
    docType: docType as DocType,
    instrument: instrument as Instrument,
    hijriDate,
    number,
  };
  if (rest.length === 0) return { level: 'work', ref: work };

  const [lang, expressionDate] = rest[0].split('@');
  if (!expressionDate) throw new UriError('جزء التعبير غير صالح');
  assertHijri(expressionDate, 'تاريخ التعبير');
  const expression: ExpressionRef = { ...work, lang, expressionDate };
  if (rest.length === 1) return { level: 'expression', ref: expression };

  const m = rest[1].match(/^!([^~]+)~(.+)$/);
  if (!m) throw new UriError('جزء الوحدة غير صالح');
  return { level: 'unit', ref: { ...expression, component: m[1], eId: m[2] } };
}

/** يجرّد المعرّف إلى مستوى العمل — تُبنى عليه المقارنة بين النسخ */
export function workUriOf(uri: string): string {
  const { ref } = parseUri(uri);
  return buildWorkUri(ref);
}

/* ————————————————— eId ————————————————— */

export const EID = {
  formula: () => 'formula',
  citation: (i: number) => `cit_${i}`,
  operativeClause: (i: number) => `clause_${i}`,
  preamble: () => 'preamble',
  chapter: (i: number) => `chp_${i}`,
  section: (i: number) => `sec_${i}`,
  schedule: (i: number) => `sched_${i}`,
  /** المادة: مستقرة ولو أُلغي نصها. والمُدرَجة بين مادتين تأخذ _bis لا رقمًا جديدًا */
  article: (n: number, bis = 0) => (bis > 0 ? `art_${n}_bis${bis > 1 ? bis : ''}` : `art_${n}`),
  /** التداخل بشرطتين سفليتين: art_74__para_2__item_a */
  child: (parent: string, child: string) => `${parent}__${child}`,
  paragraph: (i: number) => `para_${i}`,
  item: (letter: string) => `item_${letter}`,
  definition: (i: number) => `def_${i}`,
} as const;

/** مرساة مقروءة للعرض: «٧٤/٢» للفقرة الثانية من المادة الرابعة والسبعين */
export function humanAnchor(eId: string): string {
  const art = eId.match(/^art_(\d+)(?:_bis(\d*))?/);
  if (!art) return eId;
  const bis = art[2] !== undefined ? ` مكرر${art[2] ? ` ${art[2]}` : ''}` : '';
  const para = eId.match(/__para_(\d+)/);
  const item = eId.match(/__item_([^_]+)/);
  let out = art[1] + bis;
  if (para) out = `${para[1]}/${out}`;
  if (item) out = `${item[1]}/${out}`;
  return out.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
