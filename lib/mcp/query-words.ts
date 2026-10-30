/**
 * ألفاظ سؤال البحث ذات المعنى (HKM-044، ونُقلت من tools/semantic.ts في HKM-062 لتبقى صرفة بلا قاعدة).
 * يستعملها hakeem_search (الدمج والتكملة) وhakeem_semantic_search (تغطية الألفاظ) وhakeem_research.
 */
import { normalizeAr } from "./tools/word-match";

export const QUERY_STOP = new Set(
  [
    "ما", "ماذا", "هل", "كيف", "متي", "كم", "اين", "لماذا", "من", "في", "على", "علي", "الى", "الي", "عن", "او", "و", "ثم", "ان",
    "اذا", "لو", "التي", "الذي", "هذا", "هذه", "ذلك", "تلك", "هو", "هي", "مع", "بين", "عند", "كل", "اي", "لا", "لم", "لن", "قد",
    "بعد", "قبل", "حتي", "غير", "عليه", "فيه", "له", "به", "نظام", "النظام", "الماده", "ماده", "حكم", "يجب", "يحق",
  ].map(normalizeAr),
);

/**
 * HKM-062: ألفاظ الحوار الخليجي الدارج التي لا ترد في لغة الأنظمة بمعنى آخر. وجود واحدة منها (أو عبارة طلب دارجة)
 * يجعل السؤال «دارجًا»، فتُفعَّل له مداخل الجسر الملتبسة والصور الصرفية الكاملة (query-plan.ts)؛ والسؤال الفصيح
 * يبقى بألفاظه كما كان (مراجعة الجودة على #984). لا يدخلها لفظ فصيح بمعنى آخر: «يطلع» (يطّلع على المستندات)،
 * «ودي» (حل ودي)، «ابي» (والدي)، «تقدر» (تقدّر المحكمة).
 */
export const DIALECT_WORDS = new Set(
  [
    "وش", "ايش", "إيش", "شو", "شنو", "شلون", "ليش", "وين", "مين", "منو", "لمين", "اللي", "اللى", "ابغى", "ابغا", "أبغى", "عطني",
    "اعطني", "أعطني", "ابحثلي", "اقدر", "أقدر", "بس", "شي", "طلع", "طلعت", "اسوي", "أسوي", "نسوي", "يسوي", "تسوي", "سوا", "ايه",
    "هذي", "تكفى", "ياخي", "اخوي", "الحين", "توني", "عشان", "علشان", "مو", "مب", "وايد", "زين", "يبي", "تبي", "يبون", "تبون",
    "احنا", "عطتني", "عطاني",
  ].map(normalizeAr),
);

/**
 * HKM-062: ألفاظ الحوار والاستفهام (خليجية وفصيحة) التي لا تحمل موضوع السؤال. كانت تدخل ألفاظًا للسؤال
 * («ابحث»، «وش»، «أبغى»، «أقدر») فتنقص تغطية المادة الصحيحة وتأخذ مقعد الحصر اللفظي (أطول لفظين).
 * منها ما يرد في الفصيح أيضًا («صار»، «يعني»، «سوى»)، فهو حشو هنا وليس علامة على السؤال الدارج.
 */
export const COLLOQUIAL_STOP = new Set(
  [
    ...DIALECT_WORDS,
    ...[
      "ابحث", "لي", "اعرف", "أعرف", "يعني", "طيب", "مثلا", "كذا", "صار", "صارت", "يصير", "ذي", "سوى", "ماهو", "ماهي", "واحد", "وحده",
      "عندي", "عنده", "عندها", "مني", "منه", "ممكن", "لو", "سمحت", "فضلك", "سؤال", "استفسار", "حكيم", "يا", "تكون", "يكون", "فيها",
      "فيهم", "عليها", "عليهم", "لها", "لهم", "منها", "عنها", "بها", "بهم", "لكن",
    ].map(normalizeAr),
  ],
);

/**
 * HKM-062 (مراجعة الجودة): ألفاظ حشو في الدارج ولها معنى في الفصيح — «لازم» (العقد اللازم)، «أبي» (والدي)، «شيء»،
 * «تقدر» (تقدر المحكمة التعويض). تُحذف في السؤال الدارج وحده، وتبقى لفظًا إن ورد السؤال بلا علامة دارجة.
 */
export const SOFT_STOP = new Set(["لازم", "ابي", "أبي", "شيء", "شيئا", "يقدر", "تقدر", "نقدر", "يقدرون"].map(normalizeAr));

const phrases = (list: string[]) => list.map((p) => p.split(/\s+/).map(normalizeAr)).sort((a, b) => b.length - a.length);

/**
 * HKM-062: عبارات تسبق موضوع السؤال وتُحذف كلماتها متتاليةً أينما وردت. الفصيحة منها («ما حكم»، «من فضلك»، «ابحث عن»)
 * تُحذف ولا تجعل السؤال دارجًا (مراجعة الجودة الثانية على #984: «ما حكم عقد صوري» سؤال فصيح)؛ والدارجة تجعله دارجًا.
 */
export const FORMAL_OPENERS: string[][] = phrases([
  "ابحث لي عن", "ابحث عن", "ابحث لي", "اريد ان اعرف", "اريد اعرف", "اريد معرفة", "قل لي", "ممكن تقول لي", "ممكن تخبرني",
  "لو سمحت", "من فضلك", "عندي سؤال", "لدي سؤال", "ما هو حكم", "ما حكم", "ما الحكم في", "ما هي احكام",
]);

/** عبارات الطلب الدارجة: تُحذف وتجعل السؤال دارجًا. «هل تقدر» ليست منها (تقدّر المحكمة). */
export const DIALECT_REQUESTS: string[][] = phrases([
  "ابحثلي عن", "دور لي على", "دورلي على", "ابي اعرف", "ابغى اعرف", "ابغا اعرف", "ودي اعرف", "حاب اعرف", "ابي اسال", "ابغى اسال",
  "ودي اسال", "الله يعافيك", "يعطيك العافية", "وش حكم", "ايش حكم", "هل لازم", "هل يقدر", "هل اقدر", "هل نقدر", "هل يقدرون",
  "ما يقدر", "ما اقدر",
]);

/** للتوافق: كل العبارات المحذوفة (الأطول أولًا). */
export const REQUEST_PHRASES: string[][] = [...FORMAL_OPENERS, ...DIALECT_REQUESTS].sort((a, b) => b.length - a.length);

const WORD_SPLIT = /[^ء-يa-zA-Z0-9]+/;

/** فعل الإرادة أول السؤال: الدارج («أبغى/ودي/بغيت») طلب يجعله دارجًا، والفصيح («أريد») طلب لا يغيّره. «أبي» لا تُحذف (والدي). */
const LEADING_WANT_DIALECT = new Set(["ابغى", "ابغا", "ودي", "بغيت"].map(normalizeAr));
const LEADING_WANT_FORMAL = new Set(["اريد", "اود"].map(normalizeAr));

export interface RequestScan {
  /** مواضع الكلمات الباقية. */
  kept: number[];
  /** حُذفت عبارة طلب دارجة (علامة على السؤال الدارج). */
  dialect: boolean;
}

/** يحذف عبارات الطلب من كلمات مطبَّعة (الأطول أولًا)، ويقول هل كان فيها طلب دارج. المقارنة بعد التطبيع («على» = «علي»). */
export function scanRequestPhrases(words: string[]): RequestScan {
  const w = words.map((x) => normalizeAr(x));
  const kept: number[] = [];
  let dialect = false;
  for (let i = 0; i < w.length; ) {
    if (i === 0 && w.length > 1 && (LEADING_WANT_DIALECT.has(w[0]) || LEADING_WANT_FORMAL.has(w[0]))) {
      dialect ||= LEADING_WANT_DIALECT.has(w[0]);
      i++;
      continue;
    }
    const hit = REQUEST_PHRASES.find((p) => p.every((x, j) => w[i + j] === x));
    if (hit) {
      dialect ||= DIALECT_REQUESTS.includes(hit);
      i += hit.length;
      continue;
    }
    kept.push(i);
    i++;
  }
  return { kept, dialect };
}

/** يحذف عبارات الطلب من قائمة كلمات مطبَّعة (أطول عبارة أولًا). */
export function dropRequestPhrases(words: string[]): string[] {
  return scanRequestPhrases(words).kept.map((i) => words[i]);
}

/** لفظ من الحوار الدارج، ومعه واو العطف («ويعني»). */
export function isDialectWord(w: string): boolean {
  return DIALECT_WORDS.has(w) || (w.startsWith("و") && w.length > 2 && DIALECT_WORDS.has(w.slice(1)));
}

/** هل في الكلمات (مطبَّعة) عبارة طلب دارجة أو لفظ دارج؟ العبارة الفصيحة («ما حكم») ليست علامة. */
export function hasColloquialMarker(words: string[]): boolean {
  return scanRequestPhrases(words).dialect || words.some(isDialectWord);
}

/** أداة أو حشو، ومعه واو العطف («وهي»، «وعندي»، «وطلع»). «لازم» و«أبي» و«شيء» حشو في السؤال الدارج وحده. */
export function isStopWord(w: string, colloquial = true): boolean {
  const stop = (x: string) => QUERY_STOP.has(x) || COLLOQUIAL_STOP.has(x) || (colloquial && SOFT_STOP.has(x));
  if (stop(w)) return true;
  return w.startsWith("و") && w.length > 2 && stop(w.slice(1));
}

/**
 * ألفاظ السؤال ذات المعنى (بلا أدوات الاستفهام والحروف، ولا عبارات الطلب والحوار الدارجة — HKM-062).
 * `colloquial` يُمرَّر من خطة السؤال (query-plan) إن عُرف، وإلا يُحسب من السؤال نفسه.
 */
export function queryKeywords(q: string, opts: { colloquial?: boolean } = {}): string[] {
  const all = normalizeAr(q).split(WORD_SPLIT).filter(Boolean);
  const colloquial = opts.colloquial ?? hasColloquialMarker(all);
  const words = dropRequestPhrases(all).filter((w) => w.length >= 2 && !isStopWord(w, colloquial));
  return [...new Set(words)].slice(0, 12);
}
