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
 */
import { queryStemVariants } from "../modules/legal-core/arabic-morphology";
import { isCommonTerm } from "./common-terms";
import { BROKEN_PLURALS, EVERYDAY_ENTRIES, type EverydayEntry } from "./everyday-lexicon";
import { COLLOQUIAL_STOP, dropRequestPhrases, queryKeywords } from "./query-words";
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
}

/** كل صيغ المجموعة بلا تكرار، اللفظ أولًا. */
export function groupTerms(g: TermGroup, cap = 12): string[] {
  return [...new Set([g.term, ...g.forms, ...g.alts])].slice(0, cap);
}

/**
 * صيغ الحصر اللفظي لمجموعة في بحث غير محصور بنظام: ما ليس شائعًا منها (common-terms: أكثر من 50 مادة، فصفحته
 * مرفوضة يقينًا). صيغ اللفظ الصرفية تتبعه (إن شاع اللفظ لم تُحصر صوره)، وبدائل النظام المنسّقة تُحصر وحدها إن ندرت
 * («رصيد» شائع، و«مقابل وفاء» نادرة). فارغ = لا يُحصر.
 */
export function probeTerms(g: TermGroup, cap = 12, withAlts = true): string[] {
  const rareTerm = !isCommonTerm(g.term);
  const own = rareTerm ? [g.term, ...g.forms.filter((f) => !isCommonTerm(f))] : [];
  return [...new Set([...own, ...(withAlts ? g.alts.filter((a) => !isCommonTerm(a)) : [])])].slice(0, cap);
}

/**
 * HKM-062: المجموعات التي تُحصر (حصران على الأكثر؛ كل حصر مسح كامل للمدونة). في البحث المحصور بنظام كما كان: أطول
 * لفظين بكل صيغهما (الصفحة مقبولة مهما كثرت). وفي غيره: ما له صيغ غير شائعة، اللفظ النادر نفسه أولًا ثم الأطول؛
 * كان «أطول لفظين» يحصر «يعتبر» (210 مادة) و«تجاري» (721) ويترك «تستر» (22).
 */
export function pickProbes(groups: TermGroup[], scopedToLaw: boolean, max = 2, withAlts = true): Array<{ group: TermGroup; terms: string[] }> {
  if (scopedToLaw) return [...groups].sort((a, b) => b.term.length - a.term.length).slice(0, max).map((g) => ({ group: g, terms: groupTerms(g) }));
  return groups
    .map((g) => ({ group: g, terms: probeTerms(g, 12, withAlts), rare: !isCommonTerm(g.term) }))
    .filter((p) => p.terms.length > 0)
    .sort((a, b) => Number(b.rare) - Number(a.rare) || b.group.term.length - a.group.term.length)
    .slice(0, max)
    .map(({ group, terms }) => ({ group, terms }));
}

const normWord = (w: string) => normalizeAr(w).replace(/[^ء-يa-zA-Z0-9]/g, "");

type IndexedEntry = { words: string[]; entry: EverydayEntry };
let INDEX: { phrases: IndexedEntry[]; single: Map<string, EverydayEntry[]>; plural: Map<string, string[]> } | null = null;

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
  INDEX = { phrases, single, plural };
  return INDEX;
}

/** جمع التكسير للفظ (مع «ال» أو بدونها). */
function pluralForms(word: string): string[] {
  const { plural } = index();
  const bare = word.startsWith("ال") && word.length - 2 >= 2 ? word.slice(2) : word;
  return plural.get(word) ?? plural.get(bare) ?? [];
}

/** مداخل الكلمة المفردة: بصورتها، وإلا بإحدى صورها الصرفية («وتراجعت» ← تراجعت، «بصوري» ← صوري). */
function singleEntries(word: string): EverydayEntry[] {
  const { single } = index();
  const direct = single.get(word);
  if (direct) return direct;
  for (const v of queryStemVariants(word)) {
    const e = single.get(v);
    if (e) return e;
  }
  return [];
}

/**
 * يطابق مداخل الجسر في كلمات السؤال: العبارة (الأطول أولًا) ثم الكلمة. يعيد لكل موضع المدخل وطوله.
 * العبارة تحل محل كلماتها في النص الدلالي، ومداخل كلماتها المفردة تبقى للبدائل («تنشطب القضية»: شطب والدعوى معًا).
 */
function matchEntries(words: string[]): { spans: Array<{ at: number; len: number; entries: EverydayEntry[] }>; alts: Array<{ at: number; entries: EverydayEntry[] }> } {
  const { phrases } = index();
  const spans: Array<{ at: number; len: number; entries: EverydayEntry[] }> = [];
  const alts: Array<{ at: number; entries: EverydayEntry[] }> = [];
  for (let i = 0; i < words.length; i++) {
    const s = singleEntries(words[i]);
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
    const s = singleEntries(words[i]);
    if (s.length) spans.push({ at: i, len: 1, entries: s });
    i++;
  }
  return { spans, alts };
}

export function planQuery(query: string, opts: { bridge?: boolean } = {}): QueryPlan {
  const bridge = opts.bridge !== false;
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
  const keywords = queryKeywords(cleaned);

  const { spans: matches, alts: altMatches } = bridge ? matchEntries(cleanedNorm) : { spans: [], alts: [] };
  // البدائل لكل كلمة: مدخلها المفرد، ومدخل العبارة التي هي منها.
  const altsByWord = new Map<string, Set<string>>();
  for (const m of altMatches) {
    const w = cleanedNorm[m.at];
    const set = altsByWord.get(w) ?? new Set<string>();
    for (const e of m.entries) for (const a of e.alts) set.add(normalizeAr(a));
    altsByWord.set(w, set);
  }

  const groups: TermGroup[] = keywords.map((term) => {
    const forms = bridge ? [...new Set([...queryStemVariants(term), ...pluralForms(term), ...queryStemVariants(term).flatMap(pluralForms)])] : [];
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
  const plain = cleanedRaw.filter((_, i) => !COLLOQUIAL_STOP.has(cleanedNorm[i]));
  const added = [...new Set([...semAt.values()].map((m) => m.entries.find((e) => e.sem)!.sem!))];
  const semanticAppend = ([...plain, ...added].join(" ").trim() || cleaned || raw).replace(/\s+/g, " ");
  const bridged = groups.some((g) => g.alts.length > 0) || semanticText !== cleaned;
  return { cleaned: cleaned || raw, semanticText, semanticAppend, groups, bridged };
}

/** للاختبار: إعادة بناء الفهرس. */
export function _resetQueryPlanIndex(): void {
  INDEX = null;
}

