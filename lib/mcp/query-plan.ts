/**
 * HKM-062 — فهم سؤال hakeem_search قبل البحث (دالة صرفة بلا قاعدة؛ تُختبر وحدها).
 *
 * من «ابحث لي عن حق العامل اذا فصلوه بدون سبب» يُبنى:
 *   • cleaned: السؤال بلا عبارة الطلب («ابحث لي عن»).
 *   • groups: لكل لفظ ذي معنى مجموعة صيغ تُطابَق OR: اللفظ، وصوره الصرفية من جهة السؤال (arabic-morphology:
 *     فصلوه ← فصل)، وجمع التكسير المنسّق (العقد ↔ العقود)، وبدائل النظام من جسر لغة الناس (فصل ← فسخ، إنهاء).
 *     تغطية المادة = نسبة المجموعات التي يرد منها شيء في نصها، فلا تُعاقب المادة لأنها تقول «فُسخ» والسائل قال «فصلوه».
 *   • semanticText: نص البحث الدلالي، بلا ألفاظ الحوار، وفيه لفظ النظام بدل اللفظ الدارج حيث يُعرف
 *     («كم مهلة الاستئناف» ← «مدة الاعتراض بطلب الاستئناف»)؛ نداء تضمين واحد كما كان.
 * والمكنز (legal_thesaurus_*) لا مرادفات فيه اليوم (صيغة واحدة لكل مفهوم)، فالجسر منسّق في everyday-lexicon.ts.
 *
 * السجل (مراجعة الجودة على #984): السؤال «دارج» إن حمل عبارة طلب أو لفظًا من الحوار الدارج أو صيغة دارجة من الجسر.
 * السؤال الفصيح الدقيق («عقد صوري»، «الدفع بعدم الاختصاص») لا تُطبَّق عليه المداخل الملتبسة ولا الصور الصرفية الكاملة،
 * ونص بحثه الدلالي هو السؤال نفسه ما لم يُضف الجسر لفظ نظام؛ فيبقى ترتيبه كما كان.
 */
import { queryStemVariants } from "../modules/legal-core/arabic-morphology";
import { BROKEN_PLURALS, EVERYDAY_ENTRIES, type EverydayEntry } from "./everyday-lexicon";
import { COLLOQUIAL_STOP, dropRequestPhrases, isDialectWord, isStopWord, queryKeywords, SOFT_STOP } from "./query-words";
import { normalizeAr } from "./tools/word-match";

export interface TermGroup {
  /** اللفظ كما استُخرج (مطبَّعًا). */
  term: string;
  /** صيغ اللفظ نفسه: صوره الصرفية وجمعه (لا تغيّر معناه). */
  forms: string[];
  /** بدائل النظام من الجسر (لفظ آخر بالمعنى نفسه). */
  alts: string[];
}

export interface QueryPlan {
  cleaned: string;
  /** نص البحث الدلالي: لفظ النظام مكان اللفظ الدارج. */
  semanticText: string;
  /** نص البحث الدلالي: السؤال بلا حشو، وألفاظ النظام ملحقة في آخره (لا مكان اللفظ الدارج). */
  semanticAppend: string;
  groups: TermGroup[];
  /** هل غيّر الجسر شيئًا (بدائل أو نص دلالي)؟ */
  bridged: boolean;
  /** سؤال بلغة الناس (عبارة طلب، أو لفظ دارج، أو صيغة دارجة من الجسر). */
  colloquial: boolean;
}

/** كل صيغ المجموعة بلا تكرار، اللفظ أولًا. */
export function groupTerms(g: TermGroup, cap = 12): string[] {
  return [...new Set([g.term, ...g.forms, ...g.alts])].slice(0, cap);
}


const normWord = (w: string) => normalizeAr(w).replace(/[^ء-يa-zA-Z0-9]/g, "");

type IndexedEntry = { words: string[]; entry: EverydayEntry };
let INDEX: { phrases: IndexedEntry[]; single: Map<string, EverydayEntry[]>; plural: Map<string, string[]>; known: Set<string> } | null = null;

function index() {
  if (INDEX) return INDEX;
  const phrases: IndexedEntry[] = [];
  const single = new Map<string, EverydayEntry[]>();
  for (const entry of EVERYDAY_ENTRIES) {
    for (const f of entry.forms) {
      const words = f.split(/\s+/).map(normWord).filter(Boolean);
      if (words.length > 1) phrases.push({ words, entry });
      else if (words.length === 1) single.set(words[0], [...(single.get(words[0]) ?? []), entry]);
    }
  }
  phrases.sort((a, b) => b.words.length - a.words.length);
  const plural = new Map<string, string[]>();
  for (const [sg, pl] of BROKEN_PLURALS) {
    const a = normalizeAr(sg);
    const b = normalizeAr(pl);
    plural.set(a, [...(plural.get(a) ?? []), b]);
    plural.set(b, [...(plural.get(b) ?? []), a]);
  }
  // صور معروفة: ما يجوز أن تنتهي إليه كلمة جُرِّدت ياؤها الأخيرة (حقوقي ← حقوق).
  const known = new Set<string>([...plural.keys(), ...single.keys()]);
  for (const e of EVERYDAY_ENTRIES) for (const a of e.alts) for (const w of a.split(/\s+/)) if (w) known.add(normWord(w));
  INDEX = { phrases, single, plural, known };
  return INDEX;
}

/** جمع التكسير للفظ (مع «ال» أو بدونها). */
function pluralForms(word: string): string[] {
  const { plural } = index();
  const bare = word.startsWith("ال") && word.length - 2 >= 2 ? word.slice(2) : word;
  return plural.get(word) ?? plural.get(bare) ?? [];
}

const isKnown = (s: string) => index().known.has(s);
/** صور اللفظ الصرفية: الكاملة في السؤال الدارج، وسابقة «ال» المركبة ومؤنث النسبة وحدهما في غيره. */
const stems = (word: string, full: boolean) => queryStemVariants(word, { full, known: isKnown }).filter((v) => !isStopWord(v));

/** واو العطف أو باء الجر المتصلة (ولام الجر قبل مصدر بالألف): للبحث في الجسر وحده، لا صورةً في التغطية. */
const cliticBase = (w: string): string[] => {
  const m = w.match(/^(?:[وب](.{4,})|ل(ا.{3,}))$/);
  return m ? [m[1] ?? m[2]] : [];
};

/** مداخل الكلمة المفردة: بصورتها، وإلا بإحدى صورها الصرفية («وتراجعت» ← تراجعت، «بصوري» ← صوري). */
function singleEntries(word: string, full: boolean): EverydayEntry[] {
  const { single } = index();
  const direct = single.get(word);
  if (direct) return direct;
  for (const v of full ? stems(word, true) : [...stems(word, false), ...cliticBase(word)]) {
    const e = single.get(v);
    if (e) return e;
  }
  return [];
}

/**
 * يطابق مداخل الجسر في كلمات السؤال: العبارة (الأطول أولًا) ثم الكلمة. يعيد لكل موضع المدخل وطوله.
 * العبارة تحل محل كلماتها في النص الدلالي، ومداخل كلماتها المفردة تبقى للبدائل («تنشطب القضية»: شطب والدعوى معًا).
 */
type Span = { at: number; len: number; entries: EverydayEntry[] };
function matchEntries(words: string[], full: boolean): { spans: Span[]; alts: Array<{ at: number; entries: EverydayEntry[] }> } {
  const { phrases } = index();
  const spans: Span[] = [];
  const alts: Array<{ at: number; entries: EverydayEntry[] }> = [];
  for (let i = 0; i < words.length; i++) {
    const s = singleEntries(words[i], full);
    if (s.length) alts.push({ at: i, entries: s });
  }
  for (let i = 0; i < words.length; ) {
    const ph = phrases.find((p) => p.words.every((w, j) => words[i + j] === w));
    if (ph) {
      spans.push({ at: i, len: ph.words.length, entries: [ph.entry] });
      for (let j = i; j < i + ph.words.length; j++) alts.push({ at: j, entries: [ph.entry] });
      i += ph.words.length;
      continue;
    }
    const s = singleEntries(words[i], full);
    if (s.length) spans.push({ at: i, len: 1, entries: s });
    i++;
  }
  return { spans, alts };
}

/** يُبقي من المطابقات ما يجوز في سجل السؤال: الملتبس في الدارج وحده. */
function forRegister<T extends { entries: EverydayEntry[] }>(ms: T[], colloquial: boolean): T[] {
  if (colloquial) return ms;
  return ms.map((m) => ({ ...m, entries: m.entries.filter((e) => !e.ambiguous) })).filter((m) => m.entries.length > 0);
}

export interface PlanOptions {
  /** الجسر والصور (false: الألفاظ النظيفة وحدها، للقياس). */
  bridge?: boolean;
  /** المداخل الملتبسة والصور الكاملة للسؤال الدارج وحده (false: لكل سؤال، للقياس). */
  registerGate?: boolean;
}

export function planQuery(query: string, opts: PlanOptions = {}): QueryPlan {
  const bridge = opts.bridge !== false;
  const gate = opts.registerGate !== false;
  const raw = String(query ?? "").trim();
  // الكلمات بصورتها الأصلية (للنص الدلالي) ومطبَّعة (للمطابقة)، بلا عبارات الطلب.
  const rawWords = raw.split(/\s+/).filter(Boolean);
  const normWords = rawWords.map(normWord);
  const keptIdx: number[] = [];
  {
    // dropRequestPhrases على المطبَّع، ثم استعادة المواضع الباقية.
    const kept = dropRequestPhrases(normWords);
    let k = 0;
    for (let i = 0; i < normWords.length && k < kept.length; i++) {
      if (normWords[i] === kept[k]) {
        keptIdx.push(i);
        k++;
      }
    }
  }
  const cleanedRaw = keptIdx.map((i) => rawWords[i]);
  const cleanedNorm = keptIdx.map((i) => normWords[i]);
  const cleaned = cleanedRaw.join(" ");

  // السجل: عبارة طلب حُذفت، أو لفظ دارج، أو صيغة دارجة من الجسر («فصلوه»، «فلوسي»).
  const all = bridge ? matchEntries(cleanedNorm, true) : { spans: [], alts: [] };
  const colloquial =
    !gate ||
    keptIdx.length !== normWords.length ||
    cleanedNorm.some(isDialectWord) ||
    all.spans.some((m) => m.entries.some((e) => e.dialect)) ||
    all.alts.some((m) => m.entries.some((e) => e.dialect));
  const { spans: rawSpans, alts: rawAlts } = bridge && !colloquial ? matchEntries(cleanedNorm, false) : all;
  const matches = forRegister(rawSpans, colloquial);
  const altMatches = forRegister(rawAlts, colloquial);
  const keywords = queryKeywords(cleaned, { colloquial: gate ? colloquial : true });

  // البدائل لكل كلمة: مدخلها المفرد، ومدخل العبارة التي هي منها.
  const altsByWord = new Map<string, Set<string>>();
  for (const m of altMatches) {
    const w = cleanedNorm[m.at];
    const set = altsByWord.get(w) ?? new Set<string>();
    for (const e of m.entries) for (const a of e.alts) set.add(normalizeAr(a));
    altsByWord.set(w, set);
  }

  const groups: TermGroup[] = keywords.map((term) => {
    const st = bridge ? stems(term, colloquial) : [];
    const forms = bridge ? [...new Set([...st, ...pluralForms(term), ...st.flatMap(pluralForms)])].filter((f) => !isStopWord(f)) : [];
    const alts = [...(altsByWord.get(term) ?? [])].filter((a) => a !== term && !forms.includes(a));
    return { term, forms: forms.filter((f) => f !== term), alts };
  });

  // النص الدلالي: بلا ألفاظ الحوار، وبديل النظام (sem) مكان اللفظ الدارج.
  const semParts: string[] = [];
  const semAt = new Map(matches.filter((m) => m.entries.some((e) => e.sem)).map((m) => [m.at, m] as const));
  for (let i = 0; i < cleanedRaw.length; ) {
    const m = semAt.get(i);
    if (m) {
      const sem = m.entries.find((e) => e.sem)!.sem!;
      // «رسائل الواتساب»: كلمتان من مدخل واحد لا يتكرر بديلهما.
      if (semParts[semParts.length - 1] !== sem) semParts.push(sem);
      i += m.len;
      continue;
    }
    if (!COLLOQUIAL_STOP.has(cleanedNorm[i])) semParts.push(cleanedRaw[i]);
    i++;
  }
  const semanticText = (semParts.join(" ").trim() || cleaned || raw).replace(/\s+/g, " ");
  const added = [...new Set([...semAt.values()].map((m) => m.entries.find((e) => e.sem)!.sem!))];
  // الدارج: بلا ألفاظ الحوار وألفاظ النظام ملحقة. الفصيح: السؤال نفسه (كما كان)، وألفاظ النظام ملحقة إن وُجدت.
  const plain = colloquial ? cleanedRaw.filter((_, i) => !COLLOQUIAL_STOP.has(cleanedNorm[i]) && !SOFT_STOP.has(cleanedNorm[i])) : [raw];
  const semanticAppend = ([...plain, ...added].join(" ").trim() || cleaned || raw).replace(/\s+/g, " ");
  const bridged = groups.some((g) => g.alts.length > 0) || semanticText !== cleaned;
  return { cleaned: cleaned || raw, semanticText, semanticAppend, groups, bridged, colloquial };
}

/**
 * ألفاظ الحصر اللفظي (مسح للمدونة لكل لفظ): أطول لفظين، بلفظ السائل وحده بلا صيغه ولا بدائله (مراجعة الجودة على #984:
 * «صوري» وحدها 8 مواد، وبصيغها وبدائلها 1,052 فتُرفض صفحة الحصر ويقع السؤال في وضع الدليل الضعيف). وفي السؤال الدارج
 * لا يُحصر لفظ له بديل في الجسر: ندرته ندرة لهجة لا تمييز («مهلة» ← رخص المياه)، إلا إن طُلب ذلك للقياس.
 */
export function probeTerms(plan: QueryPlan, opts: { probeBridged?: boolean; max?: number } = {}): string[] {
  const eligible = plan.groups.filter((g) => opts.probeBridged || !plan.colloquial || g.alts.length === 0);
  return [...eligible].sort((a, b) => b.term.length - a.term.length).slice(0, opts.max ?? 2).map((g) => g.term);
}

/** للاختبار: إعادة بناء الفهرس. */
export function _resetQueryPlanIndex(): void {
  INDEX = null;
}

