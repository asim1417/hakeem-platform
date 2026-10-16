/**
 * ruling-excerpts — ما يقرؤه حكيم من الحكم: استعلام كلمات كاملة، ومقتطف من الأسباب أو المنطوق.
 *
 * المشكلة السابقة: المقتطف كان أول ٤٠٠ حرف من الحكم، أي الديباجة («الحمد لله… فلدى الدائرة…»)،
 * فلا يرى النموذج علّة الحكم ولا منطوقه. هنا:
 *   • يُقطَّع الحكم بالقواعد (lib/rulings/research/segment.ts) إلى أجزائه.
 *   • يُختار موضع المطابقة الأنسب بالأولوية: الأسباب ← المنطوق ← الإجابة ← الدعوى ← الديباجة.
 *   • يُرفق مقتطف المنطوق دائمًا، وخريطة الأجزاء بإزاحاتها لمن أراد جزءًا بعينه.
 * دوال نقية بلا قاعدة؛ الحجب (redactPII) يتولاه المستدعي قبل الإرجاع.
 */
import { segmentRuling, type SegmentType } from "@/lib/rulings/research/segment";
import { normalizeArabic } from "./bm25-tokenizer";
import { normalizeArabicText } from "./arabic-morphology";

const STOP = new Set([
  "في", "من", "على", "علي", "عن", "الى", "إلى", "او", "أو", "ثم", "قد", "كل", "بعد", "قبل", "عند", "هذا", "هذه",
  "ذلك", "تلك", "التي", "الذي", "مع", "بين", "هل", "ما", "ماهو", "ماهي", "حكم", "يجوز", "متى", "كيف",
]);
const PREFIXES = ["وال", "بال", "فال", "كال", "لل", "و", "ف", "ب", "ل"];

/** صيغ اللفظ الواحد بالتطبيعين (العمود قد يُبنى بأيٍّ منهما) مع السوابق الشائعة. */
export function tokenVariants(token: string): string[] {
  const out = new Set<string>();
  for (const base of [normalizeArabic(token), normalizeArabicText(token)]) {
    const t = base.replace(/[^\p{L}\p{N}]/gu, "");
    if (t.length < 2) continue;
    const stem = t.startsWith("ال") && t.length > 4 ? t.slice(2) : t;
    out.add(t);
    out.add(stem);
    out.add(`ال${stem}`);
    for (const p of PREFIXES) out.add(p.endsWith("ال") || p === "لل" ? `${p}${stem}` : `${p}${t}`);
  }
  return [...out].filter((v) => v.length >= 2);
}

/** ألفاظ الاستعلام الدالّة (بلا كلمات وقف)، كما كُتبت. */
export function queryTokens(query: string): string[] {
  return (query ?? "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 2 && !STOP.has(normalizeArabicText(w)));
}

/**
 * tsquery بإعداد simple: كل لفظ = (صيغه بـ OR)، والألفاظ بـ AND. كلمات كاملة فقط،
 * فلا تطابق «نجش» داخل «سونجشانج»، وتطابق «الغبن» كلمة «بالغبن».
 */
export function buildRulingTsQuery(query: string): string | null {
  const groups = queryTokens(query).slice(0, 8).map((t) => tokenVariants(t));
  const parts = groups.filter((g) => g.length).map((g) => `(${g.join(" | ")})`);
  return parts.length ? parts.join(" & ") : null;
}

// ── مطابقة على النص الأصلي بخريطة إزاحات ──

/** تطبيع حرفًا بحرف مع خريطة إلى موضع النص الأصلي (يُحذف التشكيل والتطويل). */
export function matchKey(raw: string): { key: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (/[ً-ٰٟـ]/.test(c)) continue;
    const k = /[أإآٱ]/.test(c) ? "ا" : c === "ى" ? "ي" : c === "ة" ? "ه" : c === "ؤ" ? "و" : c === "ئ" ? "ي" : c;
    out.push(k);
    map.push(i);
  }
  map.push(raw.length);
  return { key: out.join(""), map };
}

const keyOf = (s: string) => matchKey(s).key;

/** مواضع (في النص الأصلي) كل مطابقة كلمة كاملة لأيٍّ من صيغ ألفاظ الاستعلام. */
export function findMatches(raw: string, query: string): number[] {
  const { key, map } = matchKey(raw);
  const forms = new Set<string>();
  for (const t of queryTokens(query)) for (const v of tokenVariants(t)) forms.add(keyOf(v));
  const positions: number[] = [];
  for (const f of forms) {
    if (f.length < 2) continue;
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "gu");
    for (const m of key.matchAll(re)) positions.push(map[m.index ?? 0]);
  }
  return [...new Set(positions)].sort((a, b) => a - b);
}

const PRIORITY: SegmentType[] = ["reasons", "disposition", "defense", "claims", "evidence", "appeal", "header", "other"];

/** نافذة نصية حول موضع، مقصوصة على حدود الكلمات. */
function windowAt(raw: string, at: number, size: number): string {
  let s = Math.max(0, at - Math.floor(size / 3));
  let e = Math.min(raw.length, s + size);
  while (s > 0 && !/\s/.test(raw[s - 1])) s--;
  while (e < raw.length && !/\s/.test(raw[e])) e++;
  return (s > 0 ? "…" : "") + raw.slice(s, e).replace(/\s+/g, " ").trim() + (e < raw.length ? "…" : "");
}

/** نافذة تبدأ من موضع بعينه (بداية جزء) وتمتد إلى الأمام. */
function windowFrom(raw: string, at: number, size: number): string {
  let e = Math.min(raw.length, at + size);
  while (e < raw.length && !/\s/.test(raw[e])) e++;
  return raw.slice(at, e).replace(/\s+/g, " ").trim() + (e < raw.length ? "…" : "");
}

/** مقتطف يبدأ من موضع بعينه في النص الأصلي (مثل بداية جزء طابق بالمعنى). */
export function excerptFrom(raw: string, at: number, size = 320): string {
  return windowFrom(raw ?? "", Math.max(0, Math.min(at, (raw ?? "").length)), size);
}

export interface RulingPart {
  type: SegmentType;
  start: number;
  end: number;
}

export interface RulingExcerpts {
  /** مقتطف حول المطابقة الأنسب (الأسباب أولًا)، أو بداية الأسباب/المنطوق إن لم توجد مطابقة. */
  snippet: string;
  /** الجزء الذي أُخذ منه المقتطف. */
  matchedIn: SegmentType | null;
  /** بداية المنطوق — نتيجة الحكم. */
  disposition: string | null;
  /** خريطة أجزاء الحكم بإزاحاتها في النص الأصلي. */
  parts: RulingPart[];
}

export function buildRulingExcerpts(raw: string, query: string, size = 320): RulingExcerpts {
  const text = raw ?? "";
  const seg = segmentRuling(text);
  const parts: RulingPart[] = seg.segments.map((s) => ({ type: s.type, start: s.start, end: s.end }));
  const partAt = (pos: number) => parts.find((p) => pos >= p.start && pos < p.end)?.type ?? null;
  const disp = parts.find((p) => p.type === "disposition");
  const disposition = disp ? windowFrom(text, disp.start, Math.min(size, disp.end - disp.start)) : null;

  const matches = query ? findMatches(text, query) : [];
  let best: { pos: number; type: SegmentType | null } | null = null;
  for (const pos of matches) {
    const type = partAt(pos);
    const rank = type ? PRIORITY.indexOf(type) : PRIORITY.length;
    if (!best || rank < (best.type ? PRIORITY.indexOf(best.type) : PRIORITY.length)) best = { pos, type };
  }
  if (best) return { snippet: windowAt(text, best.pos, size), matchedIn: best.type, disposition, parts };

  // بلا مطابقة لفظية (مثل نتيجة دلالية): بداية الأسباب، ثم المنطوق، ولا تُعرض الديباجة.
  const fallback = parts.find((p) => p.type === "reasons") ?? disp ?? parts.find((p) => p.type !== "header");
  if (fallback) return { snippet: windowFrom(text, fallback.start, size), matchedIn: fallback.type, disposition, parts };
  return { snippet: windowFrom(text, 0, size), matchedIn: null, disposition, parts };
}
