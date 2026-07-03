// تحليل جودة النص المستخرَج وتصحيحه — مستوحى من فلسفة أداة القياس التي وصلت لنتائج
// عالية (الحقول issues: rev/frag/badsym/ar، والتصحيح corr). كله حتمي وبلا شبكة.

import { normStr } from "./search";

// ── نسبة العربية والرموز التالفة ──

export function arabicRatio(text: string): number {
  const chars = Array.from(text);
  const letters = chars.filter((c) => /[\p{L}\p{N}]/u.test(c));
  if (!letters.length) return 0;
  const arabic = letters.filter((c) => /[؀-ۿ]/u.test(c));
  return arabic.length / letters.length;
}

const BAD_SYMBOLS = /[�□▯]/g; // � □ ▯ وما شابه

export function countBadSymbols(text: string): number {
  return (text.match(BAD_SYMBOLS) ?? []).length;
}

// ── التجزئة (frag): كلمات مكسورة/مبعثرة أحرفاً ──

export function fragmentationRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const tiny = words.filter((w) => Array.from(w.replace(/[^\p{L}]/gu, "")).length === 1).length;
  return tiny / words.length;
}

// ── الأسطر المعكوسة الاتجاه (rev) وتصحيحها (corr) ──
// نمط تشوّه شائع في استخراج PDF/OCR للعربية: يظهر السطر معكوس ترتيب الأحرف/الكلمات.
// نكشفه بأدلّة قاطعة: ورود صيغ معكوسة لكلمات وظيفية شائعة جداً أكثر من صيغها الصحيحة.

const COMMON_WORDS = ["في", "من", "على", "إلى", "التي", "الذي", "أن", "إن", "قد", "عن", "هذا", "هذه", "بعد", "قبل"];
const REVERSED_MAP = COMMON_WORDS.map((w) => ({
  forward: normStr(w),
  reversed: Array.from(normStr(w)).reverse().join("")
})).filter((p) => p.forward !== p.reversed);

/** يقيس دليل «هذا السطر معكوس»: (مطابقات معكوسة) − (مطابقات صحيحة) */
function reversedEvidence(line: string): number {
  const tokens = normStr(line).split(/\s+/).filter(Boolean);
  const set = new Set(tokens);
  let fwd = 0;
  let rev = 0;
  for (const { forward, reversed } of REVERSED_MAP) {
    if (set.has(forward)) fwd += 1;
    if (set.has(reversed)) rev += 1;
  }
  return rev - fwd;
}

/** عدد الأسطر التي يغلب أنها معكوسة */
export function reversedLineCount(text: string): number {
  return text.split("\n").filter((l) => reversedEvidence(l) > 0).length;
}

/** يعكس أحرف السطر بالكامل — يُلغي انعكاس الاتجاه حرفاً وكلمةً معاً */
function reverseLineChars(line: string): string {
  const leading = line.match(/^\s*/)?.[0] ?? "";
  const trailing = line.match(/\s*$/)?.[0] ?? "";
  return leading + Array.from(line.trim()).reverse().join("") + trailing;
}

export interface CorrectionResult {
  text: string;
  /** أرقام الأسطر (0-based) التي صُحِّحت، مع أصلها */
  corrected: Array<{ line: number; original: string }>;
}

/** يصحّح الأسطر المعكوسة فقط (بدليل قاطع) ويترك الباقي كما هو */
export function fixReversedArabicLines(text: string): CorrectionResult {
  const lines = text.split("\n");
  const corrected: Array<{ line: number; original: string }> = [];
  const out = lines.map((line, i) => {
    if (reversedEvidence(line) > 0) {
      corrected.push({ line: i, original: line });
      return reverseLineChars(line);
    }
    return line;
  });
  return { text: out.join("\n"), corrected };
}

// ── تحليل شامل (issues) بنفس بنية الأداة المرجعية ──

export interface TextIssues {
  rev: number; // أسطر معكوسة
  frag: number; // نسبة التجزئة (%)
  badsym: number; // رموز تالفة
  ar: number; // نسبة العربية (0-1)
  unclear: number; // كلمات غير واضحة (رموز/تكرار)
  q: number; // درجة الجودة 0-100
}

export function analyzeTextIssues(text: string): TextIssues {
  const ar = arabicRatio(text);
  const badsym = countBadSymbols(text);
  const frag = fragmentationRatio(text);
  const rev = reversedLineCount(text);
  const words = text.split(/\s+/).filter(Boolean);
  const unclear = words.filter((w) => /(.)\1\1/.test(normStr(w)) || BAD_SYMBOLS.test(w)).length;

  let q = 100;
  if (ar < 0.85) q -= Math.min(55, Math.round((0.85 - ar) * 150));
  q -= Math.min(25, badsym * 5);
  q -= Math.min(25, Math.round(frag * 60));
  q -= Math.min(20, rev * 4);
  if (text.trim().length < 120) q -= 12;
  q = Math.max(0, Math.min(100, q));

  return { rev, frag: Math.round(frag * 100), badsym, ar: Math.round(ar * 100) / 100, unclear, q };
}
