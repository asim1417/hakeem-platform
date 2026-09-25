/**
 * spelling — رصد الأخطاء الإملائية في نصوص الأحكام (قياس فقط، لا تصحيح).
 *
 * المرجع الإملائي هو lex.raw: صيغ الكلمات كما وردت في المصادر النظيفة (المواد والمكنز)،
 * لا كلمات الأحكام نفسها. الأنواع المرصودة:
 *   • hamzaInitial  همزة القطع/الوصل في أول الكلمة: «ان» ← «أن|إن»، «الى» ← «إلى».
 *   • hamzaMedial   الهمزة المتوسطة/المتطرفة: «مسئولية» ← «مسؤولية»، «الاستيناف» ← «الاستئناف».
 *   • yaAlif        ى/ي: «علي» ← «على».
 *   • taHa          ة/ه: «المحكمه» ← «المحكمة».
 *   • alefFariqaMissing  واو الجماعة بلا ألف فارقة: «قامو» ← «قاموا».
 *   • alefFariqaExtra    ألف زائدة بعد واو أصلية: «يرجوا» ← «يرجو».
 *   • confusable    حرف بدل نظيره في الرسم (يختلف في النقط): «الدغوى» ← «الدعوى».
 * ملاحظة: «مسئولية» رسم قديم شائع في المحررات السعودية؛ يُعدّ اختلاف رسم لا خطأً قاطعًا.
 */
import { type Lexicon, PREFIXES, isKnown, keyForm, knownWeight } from "./lexicon";

export type SpellingKind =
  | "hamzaInitial"
  | "hamzaMedial"
  | "yaAlif"
  | "taHa"
  | "alefFariqaMissing"
  | "alefFariqaExtra"
  | "confusable";

export const SPELLING_KINDS: SpellingKind[] = [
  "hamzaInitial", "hamzaMedial", "yaAlif", "taHa", "alefFariqaMissing", "alefFariqaExtra", "confusable",
];

export interface SpellingFinding {
  word: string;
  suggestions: string[];
  kind: SpellingKind;
}

const HAMZA_LETTERS = new Set(["ا", "أ", "إ", "آ", "ٱ", "ؤ", "و", "ئ", "ي", "ء"]);

/** مفتاح كراسي الهمزة: يوحّد ؤ/ئ/ء (مع توحيد keyForm للألف والياء والتاء) — يلتقط «مسئولية/مسؤولية». */
function seatKey(w: string): string {
  return keyForm(w.replace(/[ؤئ]/g, "ء"));
}

// فهارس صيغ raw النظيفة بالمفتاحين (تُبنى مرة لكل حجم معجم).
type Index = { size: number; byKey: Map<string, string[]>; bySeat: Map<string, string[]>; keyTotal: Map<string, number> };
const indexCache = new WeakMap<Lexicon, Index>();
function rawIndex(lex: Lexicon): Index {
  const c = indexCache.get(lex);
  if (c && c.size === lex.raw.size) return c;
  const push = (m: Map<string, string[]>, k: string, r: string) => {
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  };
  const idx: Index = { size: lex.raw.size, byKey: new Map(), bySeat: new Map(), keyTotal: new Map() };
  for (const [r, n] of lex.raw) {
    const k = keyForm(r);
    push(idx.byKey, k, r);
    push(idx.bySeat, seatKey(r), r);
    idx.keyTotal.set(k, (idx.keyTotal.get(k) ?? 0) + n);
  }
  indexCache.set(lex, idx);
  return idx;
}

/**
 * الصيغة «مقبولة إملائيًّا» إذا وردت في المرجع النظيف بحصّة ≥ ٥٪ من كل صيغ مفتاحها.
 * المرجع نفسه فيه أخطاء نادرة («الى» في ١١ مادة مقابل آلاف «إلى»)، فالأقلية لا تُعدّ صحيحة.
 */
const MIN_SHARE = 0.05;
function accepted(lex: Lexicon, idx: Index, w: string): boolean {
  const n = lex.raw.get(w) ?? 0;
  if (!n) return false;
  const total = idx.keyTotal.get(keyForm(w)) ?? n;
  return n / total >= MIN_SHARE;
}

// كلمات صحيحة بصيغتين لا يُحكم بينهما بلا سياق («علي» علمًا، و«على» حرفًا).
const AMBIGUOUS = new Set(["علي"]);

/** يصنّف الفرق بين صيغتين لهما المفتاح نفسه (الطول واحد لأن keyForm تبديل حرف بحرف). */
function classifyDiff(a: string, b: string): SpellingKind | null {
  const ca = Array.from(a);
  const cb = Array.from(b);
  if (ca.length !== cb.length) return null;
  for (let i = 0; i < ca.length; i++) {
    if (ca[i] === cb[i]) continue;
    const pair = new Set([ca[i], cb[i]]);
    if (pair.has("ى") && pair.has("ي")) return "yaAlif";
    if (pair.has("ة") && pair.has("ه")) return "taHa";
    if (HAMZA_LETTERS.has(ca[i]) && HAMZA_LETTERS.has(cb[i])) return i === 0 ? "hamzaInitial" : "hamzaMedial";
  }
  return null;
}

/** هل تختلف الصيغتان فقط بتبادل ؤ↔ئ (مع فروق keyForm الأخرى)، دون «ء» مفردة؟ */
function onlySeatSwap(a: string, b: string): boolean {
  const ca = Array.from(a);
  const cb = Array.from(b);
  if (ca.length !== cb.length) return false;
  let swap = false;
  for (let i = 0; i < ca.length; i++) {
    if (ca[i] === cb[i]) continue;
    if ((ca[i] === "ؤ" && cb[i] === "ئ") || (ca[i] === "ئ" && cb[i] === "ؤ")) swap = true;
    else if (keyForm(ca[i]) !== keyForm(cb[i])) return false;
  }
  return swap;
}

/** صيغ البحث بعد نزع سابقة؛ addedAl = أُعيدت «ال» للسوابق المنتهية بها («بالمحكمه» ← «المحكمه»). */
function stems(w: string): Array<{ prefix: string; lookup: string; addedAl: boolean }> {
  const out = [{ prefix: "", lookup: w, addedAl: false }];
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 2) {
      const rest = w.slice(p.length);
      out.push({ prefix: p, lookup: rest, addedAl: false });
      if (/(ال|لل)$/.test(p)) out.push({ prefix: p, lookup: "ال" + rest, addedAl: true });
    }
  }
  return out;
}

/**
 * اختلاف رسم (همزة، ى/ي، ة/ه) لكلمة معروفة بمفتاحها: صيغتها غائبة عن المرجع النظيف
 * وصيغة أخرى بالمفتاح نفسه حاضرة فيه.
 */
export function spellingVariant(lex: Lexicon, w: string): SpellingFinding | null {
  if (w.length < 2 || AMBIGUOUS.has(w)) return null;
  const idx = rawIndex(lex);
  for (const { prefix, lookup, addedAl } of stems(w)) {
    if (accepted(lex, idx, lookup)) return null; // الصيغة نفسها صحيحة
    // مفتاح الكرسي يُقبل منه تبادل ؤ/ئ فقط («مسئولية/مسؤولية»)، لا ما يُدخل «ء» مفردة («إجرائي/إجراءي»).
    const seatOnly = (idx.bySeat.get(seatKey(lookup)) ?? []).filter((v) => onlySeatSwap(lookup, v));
    const variants = [...(idx.byKey.get(keyForm(lookup)) ?? []), ...seatOnly];
    if (!variants?.length) continue;
    const kinds = variants
      .filter((v) => v !== lookup && accepted(lex, idx, v))
      .map((v) => ({ v, k: classifyDiff(lookup, v) }))
      .filter((x) => x.k);
    if (!kinds.length) continue;
    const kind = kinds[0].k as SpellingKind;
    const suggestions = kinds.filter((x) => x.k === kind).map((x) => prefix + (addedAl ? x.v.slice(2) : x.v));
    return { word: w, suggestions: [...new Set(suggestions)], kind };
  }
  return null;
}

/** الألف الفارقة: ناقصة بعد واو الجماعة، أو زائدة بعد واو أصلية في المضارع. */
export function alefFariqa(lex: Lexicon, w: string): SpellingFinding | null {
  const idx = rawIndex(lex);
  if (w.length < 4 || accepted(lex, idx, w)) return null;
  if (w.endsWith("و") && accepted(lex, idx, w + "ا")) {
    return { word: w, suggestions: [w + "ا"], kind: "alefFariqaMissing" };
  }
  if (/^[يتن].*وا$/.test(w) && accepted(lex, idx, w.slice(0, -1))) {
    return { word: w, suggestions: [w.slice(0, -1)], kind: "alefFariqaExtra" };
  }
  return null;
}

// مجموعات الحروف المتشابهة رسمًا (تختلف في النقط فقط). ة/ه وى/ي يرصدهما spellingVariant.
const CONFUSABLE_GROUPS = ["بتثني", "جحخ", "دذ", "رز", "سش", "صض", "طظ", "عغ", "فق"];
const GROUP_OF = new Map<string, string>();
for (const g of CONFUSABLE_GROUPS) for (const ch of g) GROUP_OF.set(ch, g);

/**
 * حرف بدل نظيره رسمًا في كلمة مجهولة (≥ ٤ أحرف): إبدال حرف واحد داخل مجموعته يعطي كلمة
 * معروفة بوزن ≥ minWeight. قد تكون الكلمة علمًا غير معروف؛ لذا تُعدّ «مرشّحة» لا خطأً قاطعًا.
 */
export function confusable(lex: Lexicon, w: string, minWeight = 5): SpellingFinding | null {
  if (w.length < 4 || isKnown(lex, w)) return null;
  const chars = Array.from(w);
  let best: { s: string; weight: number } | null = null;
  for (let i = 0; i < chars.length; i++) {
    const g = GROUP_OF.get(chars[i]);
    if (!g) continue;
    for (const alt of g) {
      if (alt === chars[i]) continue;
      const cand = chars.slice(0, i).join("") + alt + chars.slice(i + 1).join("");
      const weight = knownWeight(lex, cand);
      if (weight >= minWeight && (!best || weight > best.weight)) best = { s: cand, weight };
    }
  }
  return best ? { word: w, suggestions: [best.s], kind: "confusable" } : null;
}
