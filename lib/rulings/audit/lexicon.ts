/**
 * lexicon — معجم مرجعيّ لقياس جودة نصوص الأحكام (المرحلة أ: قراءة فقط).
 *
 * المعجم يُبنى من: كلمات مواد الأنظمة (مصدر نظيف)، ومصطلحات المكنز، والكلمات الأعلى تكرارًا
 * في الأحكام نفسها (≥ ٢٠ ظهورًا في ≥ ٥ أحكام). يُخزَّن بصيغتين:
 *   • raw  : بعد NFKC وحذف التشكيل والتطويل فقط — لرصد خلط ى/ي وة/ه.
 *   • key  : تطبيع قويّ (توحيد الألف، ى←ي، ة←ه) — للمطابقة المعجمية.
 * دوال نقية بلا اتصال بقاعدة البيانات.
 */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
// الرموز الخفية المطلوب رصدها في المرحلة أ.
export const HIDDEN_RE = /[​-‏‪-‮⁦-⁩﻿­]/g;
export const ARABIC_WORD_RE = /[ء-ي]+/g;

/** صيغة «raw»: NFKC + حذف التشكيل والتطويل والرموز الخفية. تُبقي ى/ي وة/ه والهمزات. */
export function rawForm(word: string): string {
  return word.normalize("NFKC").replace(HIDDEN_RE, "").replace(DIACRITICS, "").replace(TATWEEL, "");
}

/** صيغة «key»: rawForm ثم توحيد أ/إ/آ/ٱ←ا، ى←ي، ة←ه، ؤ←و، ئ←ي. */
export function keyForm(word: string): string {
  return rawForm(word)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/** كلمات عربية بصيغة raw من نصّ (بعد NFKC حتى تتحوّل أشكال العرض إلى حروفها). */
export function arabicWords(text: string): string[] {
  const t = rawForm(text ?? "");
  return t.match(ARABIC_WORD_RE) ?? [];
}

// السوابق المطلوبة في الأمر (الأطول أولًا) + لواحق ضمائر شائعة لتقليل «المجهول» الزائف.
export const PREFIXES = ["وبال", "وكال", "ولل", "وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];
const SUFFIXES = ["هما", "كما", "تها", "تهم", "ها", "هم", "هن", "كم", "كن", "نا", "ه", "ي", "ك"];

export interface Lexicon {
  /** صيغ raw من المصادر النظيفة فقط (المواد والمكنز) — مرجع رصد خلط ى/ي وة/ه. */
  raw: Set<string>;
  key: Map<string, number>; // الكلمة المطبّعة ← وزن التكرار
}

export function emptyLexicon(): Lexicon {
  return { raw: new Set(), key: new Map() };
}

export function addWords(lex: Lexicon, words: Iterable<string>, weight = 1, clean = true): void {
  for (const w of words) {
    if (w.length < 2) continue;
    const r = rawForm(w);
    if (clean) lex.raw.add(r);
    const k = keyForm(r);
    lex.key.set(k, (lex.key.get(k) ?? 0) + weight);
  }
}

/** يضيف نصًّا كاملًا (مادة أو مصطلحًا) إلى المعجم. */
export function addText(lex: Lexicon, text: string, weight = 1): void {
  addWords(lex, arabicWords(text), weight);
}

/**
 * يضيف الكلمات المتكررة في الأحكام: ≥ minFreq ظهورًا في ≥ minDocs أحكام مختلفة.
 * docs: قائمة نصوص الأحكام. يرجع عدد الكلمات المضافة.
 */
export function addFrequentRulingWords(lex: Lexicon, docs: string[], minFreq = 20, minDocs = 5): number {
  const freq = new Map<string, number>();
  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set<string>();
    for (const w of arabicWords(d)) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      seen.add(w);
    }
    for (const w of seen) df.set(w, (df.get(w) ?? 0) + 1);
  }
  let added = 0;
  for (const [w, f] of freq) {
    if (f >= minFreq && (df.get(w) ?? 0) >= minDocs) {
      addWords(lex, [w], f, false); // ليست مصدرًا نظيفًا: قد تحمل أخطاء متكررة
      added++;
    }
  }
  return added;
}

/** هل الكلمة معروفة (بصيغة key)، مباشرةً أو بعد نزع سابقة و/أو لاحقة ضمير؟ */
export function isKnown(lex: Lexicon, word: string): boolean {
  const k = keyForm(word);
  if (k.length < 2) return true; // الحروف المفردة لا تُحسب مجهولة
  if (lex.key.has(k)) return true;
  for (const p of PREFIXES) {
    if (k.startsWith(p) && k.length - p.length >= 2) {
      const rest = k.slice(p.length);
      if (lex.key.has(rest) || stripSuffixKnown(lex, rest)) return true;
      // «بال/وال/لل…» + جذع: المعجم قد يحوي الصيغة المعرّفة فقط («العقد» لا «عقد»).
      if (/(ال|لل)$/.test(p) && lex.key.has("ال" + rest)) return true;
    }
  }
  return stripSuffixKnown(lex, k);
}

function stripSuffixKnown(lex: Lexicon, k: string): boolean {
  for (const s of SUFFIXES) {
    if (k.endsWith(s) && k.length - s.length >= 3 && lex.key.has(k.slice(0, -s.length))) return true;
  }
  return false;
}

/** وزن كلمة معروفة (للتقسيم الموزون): تكرار المعجم، أو ١ للمعروفة بالسوابق. */
export function knownWeight(lex: Lexicon, word: string): number {
  const k = keyForm(word);
  return lex.key.get(k) ?? (isKnown(lex, k) ? 1 : 0);
}
