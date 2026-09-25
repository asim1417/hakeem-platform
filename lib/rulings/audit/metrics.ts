/**
 * metrics — مؤشرات جودة نصّ الحكم (المرحلة أ-٣/أ-٤). دوال نقية بلا قاعدة بيانات.
 *
 * كل مؤشّر يُحسب على النصّ الأصلي كما هو مخزَّن في judicial_cases."judgmentText"،
 * ولا يُعدَّل النصّ الأصلي إطلاقًا؛ «التنظيف المحاكى» هنا للقياس والعرض فقط.
 */
import { createHash } from "node:crypto";
import {
  ARABIC_WORD_RE,
  HIDDEN_RE,
  type Lexicon,
  isKnown,
  keyForm,
  knownWeight,
  rawForm,
} from "./lexicon";

const PRESENTATION_RE = /[ﭐ-﷿ﹰ-ﻼ]/g;
const TATWEEL_RE = /ـ/g;
// رموز غريبة: □ وأشكال هندسية، � ، منطقة الاستخدام الخاص، ومحارف تحكّم (عدا الأسطر والجدولة).
const BAD_SYMBOL_RE = /[■-◿�-\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
// رقم لاتينيّ ملتصق بحرف عربيّ — نستثني «هـ/م» بعد الرقم (1443هـ، 2021م) فهي لواحق تاريخ مشروعة.
const LATIN_DIGIT_IN_WORD_RE = /[ء-ي][0-9]|[0-9](?![همـ])[ء-ي]/g;

export const GLUED_MIN_LEN = 10;
export const SHORT_TEXT_CHARS = 300;

export interface WordSpan {
  word: string; // raw form
  start: number;
  end: number;
}

/** كلمات عربية بمواضعها داخل rawForm(text). */
export function wordSpans(text: string): { norm: string; spans: WordSpan[] } {
  const norm = rawForm(text ?? "");
  const spans: WordSpan[] = [];
  for (const m of norm.matchAll(ARABIC_WORD_RE)) {
    spans.push({ word: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return { norm, spans };
}

function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

// ── فصل الكلمات الملتصقة: برمجة ديناميكية موزونة بالتكرار ──

export interface Segmentation {
  parts: string[];
  confidence: number;
}

/**
 * تقسيم كلمة غير معروفة إلى أقلّ عدد من الأجزاء المعروفة (٢–٤ أجزاء، كل جزء ≥ ٢ حرفًا)،
 * ثم بأعلى مجموع لوغاريتم أوزان. يرجع null إن تعذّر تقسيمها كلّها إلى كلمات معروفة.
 */
export function segmentWord(lex: Lexicon, word: string, maxParts = 4): Segmentation | null {
  const w = rawForm(word);
  const n = w.length;
  if (n < 4) return null;
  // best[i] = أفضل تقسيم للبادئة w[0..i)
  type Cell = { parts: number; score: number; prev: number } | null;
  const best: Cell[] = new Array(n + 1).fill(null);
  best[0] = { parts: 0, score: 0, prev: -1 };
  for (let i = 2; i <= n; i++) {
    for (let j = Math.max(0, i - 20); j <= i - 2; j++) {
      const from = best[j];
      if (!from || from.parts >= maxParts) continue;
      const piece = w.slice(j, i);
      const weight = knownWeight(lex, piece);
      if (weight <= 0) continue;
      const cand = { parts: from.parts + 1, score: from.score + Math.log(1 + weight), prev: j };
      const cur = best[i];
      if (!cur || cand.parts < cur.parts || (cand.parts === cur.parts && cand.score > cur.score)) best[i] = cand;
    }
  }
  const end = best[n];
  if (!end || end.parts < 2) return null;
  const parts: string[] = [];
  let i = n;
  while (i > 0) {
    const c = best[i]!;
    parts.unshift(w.slice(c.prev, i));
    i = c.prev;
  }
  // الثقة: تبدأ ١ وتنقص مع كثرة الأجزاء، والأجزاء القصيرة، والأجزاء النادرة.
  let confidence = 1 - 0.1 * (parts.length - 2);
  if (parts.some((p) => p.length === 2)) confidence -= 0.1;
  if (parts.some((p) => knownWeight(lex, p) < 3)) confidence -= 0.1;
  return { parts, confidence: Math.max(0, Math.round(confidence * 100) / 100) };
}

function reverse(s: string): string {
  return Array.from(s).reverse().join("");
}

// ── مؤشرات حكم واحد ──

export interface RulingMetrics {
  chars: number;
  words: number; // رموز مفصولة بالفراغ
  arabicWords: number;
  presentationForms: number;
  hiddenChars: number;
  tatweel: number;
  reversedWords: number;
  gluedWords: number;
  brokenPairs: number;
  ocrYaAlif: number; // خلط ى/ي في آخر الكلمة
  ocrTaHa: number; // خلط ة/ه في آخر الكلمة
  ocrLatinDigitInWord: number;
  ocrBadSymbols: number;
  knownWords: number;
  coverage: number; // knownWords / arabicWords
  isEmpty: boolean;
  isShort: boolean; // < 300 حرف
  normHash: string; // لرصد التكرار
  examples: {
    glued: Array<{ word: string; parts: string[]; confidence: number }>;
    broken: Array<{ a: string; b: string; merged: string }>;
    reversed: Array<{ word: string; fixed: string }>;
    ocr: string[];
  };
}

/** بصمة النصّ المطبَّع بقوة (حروف وأرقام فقط) لرصد التكرار التامّ. */
export function normalizedHash(text: string): string {
  const k = keyForm(text ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^ء-ي0-9]/g, "");
  return createHash("sha1").update(k).digest("hex");
}

function swapFinal(w: string, a: string, b: string): string | null {
  if (w.endsWith(a)) return w.slice(0, -1) + b;
  if (w.endsWith(b)) return w.slice(0, -1) + a;
  return null;
}

export function measureRuling(lex: Lexicon, text: string, maxExamples = 5): RulingMetrics {
  const original = text ?? "";
  const { norm, spans } = wordSpans(original);
  const m: RulingMetrics = {
    chars: original.length,
    words: original.trim() ? original.trim().split(/\s+/).length : 0,
    arabicWords: spans.length,
    presentationForms: count(original, PRESENTATION_RE),
    hiddenChars: count(original, HIDDEN_RE),
    tatweel: count(original, TATWEEL_RE),
    reversedWords: 0,
    gluedWords: 0,
    brokenPairs: 0,
    ocrYaAlif: 0,
    ocrTaHa: 0,
    ocrLatinDigitInWord: count(norm, LATIN_DIGIT_IN_WORD_RE),
    ocrBadSymbols: count(original, BAD_SYMBOL_RE),
    knownWords: 0,
    coverage: 1,
    isEmpty: original.trim().length === 0,
    isShort: original.trim().length < SHORT_TEXT_CHARS,
    normHash: normalizedHash(original),
    examples: { glued: [], broken: [], reversed: [], ocr: [] },
  };

  const known = spans.map((s) => isKnown(lex, s.word));
  for (let i = 0; i < spans.length; i++) {
    const w = spans[i].word;
    if (known[i]) {
      m.knownWords++;
      // خلط ى/ي وة/ه: الكلمة معروفة بصيغة key لكن صيغتها raw غائبة عن المصادر النظيفة
      // بينما الصيغة المبدَّلة حاضرة فيها.
      if (w.length >= 3 && !lex.raw.has(w)) {
        const ya = swapFinal(w, "ى", "ي");
        const ta = swapFinal(w, "ة", "ه");
        if (ya && lex.raw.has(ya)) {
          m.ocrYaAlif++;
          if (m.examples.ocr.length < maxExamples) m.examples.ocr.push(`${w}→${ya}`);
        } else if (ta && lex.raw.has(ta)) {
          m.ocrTaHa++;
          if (m.examples.ocr.length < maxExamples) m.examples.ocr.push(`${w}→${ta}`);
        }
      }
      continue;
    }
    // مقلوب: المجهول يصير معروفًا إذا قُلب.
    const rev = reverse(w);
    if (w.length >= 3 && rev !== w && isKnown(lex, rev)) {
      m.reversedWords++;
      if (m.examples.reversed.length < maxExamples) m.examples.reversed.push({ word: w, fixed: rev });
      continue;
    }
    // ملتصق: ≥ ١٠ أحرف ويُقسَم كلّه إلى كلمات معروفة.
    if (w.length >= GLUED_MIN_LEN) {
      const seg = segmentWord(lex, w);
      if (seg) {
        m.gluedWords++;
        if (m.examples.glued.length < maxExamples) m.examples.glued.push({ word: w, ...seg });
      }
    }
  }
  // مكسور: جزءان متجاوران (يفصلهما فراغ فقط) مجهولان، ودمجهما كلمة معروفة.
  for (let i = 0; i + 1 < spans.length; i++) {
    if (known[i] || known[i + 1]) continue;
    const gap = norm.slice(spans[i].end, spans[i + 1].start);
    if (!/^[ \t]+$/.test(gap)) continue;
    const merged = spans[i].word + spans[i + 1].word;
    if (merged.length >= 4 && isKnown(lex, merged)) {
      m.brokenPairs++;
      if (m.examples.broken.length < maxExamples) m.examples.broken.push({ a: spans[i].word, b: spans[i + 1].word, merged });
    }
  }
  m.coverage = m.arabicWords ? m.knownWords / m.arabicWords : 1;
  return m;
}

// ── درجة الجودة والفئات (أ-٤) ──

export type QualityTier = "sound" | "repairable" | "poor" | "damaged";

/**
 * درجة ٠–١٠٠. العيوب القابلة للإصلاح آليًّا بأمان (أشكال العرض، الرموز الخفية، التطويل)
 * خصمها محدود حتى يبقى النصّ «سليمًا» إن لم يكن فيه غيرها — لأن التطبيع وحده يكفيه.
 */
export function qualityScore(m: RulingMetrics): number {
  if (m.isEmpty) return 0;
  const per1k = (x: number) => (m.arabicWords ? (x * 1000) / m.arabicWords : 0);
  let s = 100;
  s -= Math.max(0, 0.98 - m.coverage) * 200; // التغطية المعجمية
  s -= Math.min(25, per1k(m.gluedWords) * 2);
  s -= Math.min(20, per1k(m.brokenPairs) * 2);
  s -= Math.min(40, (m.arabicWords ? m.reversedWords / m.arabicWords : 0) * 400);
  s -= Math.min(15, per1k(m.ocrYaAlif + m.ocrTaHa + m.ocrLatinDigitInWord));
  s -= Math.min(20, m.ocrBadSymbols * 5);
  s -= Math.min(5, m.presentationForms > 0 ? 2 + per1k(m.presentationForms) / 100 : 0);
  s -= Math.min(3, m.hiddenChars + m.tatweel > 0 ? 1 + per1k(m.hiddenChars + m.tatweel) / 100 : 0);
  if (m.isShort) s -= 40;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function qualityTier(score: number): QualityTier {
  if (score >= 90) return "sound";
  if (score >= 70) return "repairable";
  if (score >= 40) return "poor";
  return "damaged";
}

// ── تنظيف محاكى (للعرض قبل/بعد وللاستدعاء التقريبي فقط؛ لا يُكتب في القاعدة) ──

export interface SimulatedClean {
  text: string;
  edits: Array<{ step: "merge_broken" | "desegment"; before: string; after: string; confidence: number }>;
}

export function simulateClean(lex: Lexicon, text: string, minConfidence = 0.85): SimulatedClean {
  const base = rawForm(text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  const edits: SimulatedClean["edits"] = [];
  // دمج المكسور أولًا ثم فصل الملتصق — على مستوى الكلمات مع إبقاء الفواصل.
  const pieces = base.split(/([ء-ي]+)/); // الفهارس الفردية كلمات عربية
  for (let i = 1; i + 2 < pieces.length; i += 2) {
    const a = pieces[i];
    const b = pieces[i + 2];
    if (!a || !b || pieces[i + 1] !== " ") continue;
    if (isKnown(lex, a) || isKnown(lex, b)) continue;
    const merged = a + b;
    if (merged.length >= 4 && isKnown(lex, merged)) {
      edits.push({ step: "merge_broken", before: `${a} ${b}`, after: merged, confidence: 0.9 });
      pieces[i] = merged;
      pieces[i + 1] = "";
      pieces[i + 2] = "";
    }
  }
  for (let i = 1; i < pieces.length; i += 2) {
    const w = pieces[i];
    if (!w || w.length < GLUED_MIN_LEN || isKnown(lex, w)) continue;
    const seg = segmentWord(lex, w);
    if (seg && seg.confidence >= minConfidence) {
      const after = seg.parts.join(" ");
      edits.push({ step: "desegment", before: w, after, confidence: seg.confidence });
      pieces[i] = after;
    }
  }
  return { text: pieces.join(""), edits };
}

/** نسخة بحث محاكاة (نظير buildSearchText المقترح): key form + أرقام لاتينية. */
export function simulatedSearchText(clean: string): string {
  return keyForm(clean).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * هل يرد اللفظ كلمةً كاملة (مع السوابق المسموحة) في نصّ بحث مطبَّع؟
 * term يُطبَّع بـ keyForm؛ «ال» في أول اللفظ اختيارية حتى تطابق «الغبن» كلمة «بالغبن».
 */
export function containsWholeWord(searchText: string, term: string): boolean {
  const words = keyForm(term).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = words[0].startsWith("ال") && words[0].length > 3 ? words[0].slice(2) : words[0];
  const prefix = words[0].startsWith("ال") && words[0].length > 3
    ? "(?:وبال|وكال|ولل|وال|بال|فال|كال|لل|ال|ول|ل)"
    : "(?:وبال|وكال|ولل|وال|بال|فال|كال|لل|ال|و|ف|ب|ك|ل)?";
  const rest = words.slice(1).map(esc).join("\\s+");
  const re = new RegExp(`(?:^|[^\\u0621-\\u064A])${prefix}${esc(first)}${rest ? "\\s+" + rest : ""}(?![\\u0621-\\u064A])`);
  return re.test(searchText);
}
