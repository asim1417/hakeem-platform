// طبقة البحث والفهرسة لمحطة فحص الوثائق — منقولة من «واجهة تصفّح القضية v2»
// (الواجهة فقط — بيانات القضية الأصلية الخاصة حُذفت كلياً ولا يصل منها شيء إلى هنا).
// كل شيء حتمي: تطبيع، تجذيع خفيف (على نمط Lucene العربي)، BM25، ومطابقة بمواضع أصلية.

import { normalizeForMatch } from "./classifier";
import { thesaurusCategories } from "./reference";
import type { AnalyzedDocument } from "./types";

// ── تطبيع بخريطة مواضع (للتظليل على النص الأصلي) ──

const LETTER_VARIANTS: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي"
};

function normChar(ch: string): string {
  const c = ch.charCodeAt(0);
  if (c >= 0x064b && c <= 0x0652) return ""; // تشكيل
  if (c === 0x0640) return ""; // تطويل
  if (c === 0x0670) return ""; // ألف خنجرية
  // محارف صفرية العرض وعلامات الاتجاه — تظهر في نصّ PDF/OCR وتكسر شبك الكلمات وتقطيعها
  if (c === 0x200b || c === 0x200c || c === 0x200d) return ""; // ZWSP/ZWNJ/ZWJ
  if (c >= 0x200e && c <= 0x200f) return ""; // LRM/RLM
  if (c >= 0x202a && c <= 0x202e) return ""; // تضمين/تجاوز الاتجاه
  if (c >= 0x2066 && c <= 0x2069) return ""; // عزل الاتجاه
  if (c === 0xfeff) return ""; // BOM/ZWNBSP
  if (c >= 0x0660 && c <= 0x0669) return String.fromCharCode(48 + (c - 0x0660));
  if (c >= 0x06f0 && c <= 0x06f9) return String.fromCharCode(48 + (c - 0x06f0));
  return (LETTER_VARIANTS[ch] ?? ch).toLowerCase();
}

export interface NormWithMap {
  n: string;
  map: number[];
}

/** تطبيع يحفظ خريطة (موضع مُطبَّع ← موضع أصلي) */
export function buildNorm(source: string): NormWithMap {
  let n = "";
  const map: number[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const r = normChar(source[i]);
    if (r) {
      n += r;
      map.push(i);
    }
  }
  return { n, map };
}

export function normStr(source: string): string {
  let n = "";
  for (let i = 0; i < source.length; i += 1) n += normChar(source[i]);
  return n;
}

// ── تحليل الاستعلام: "عبارة دقيقة"، ‑استبعاد/ليس، أو/OR ──

export interface ParsedQuery {
  phrases: string[];
  terms: string[];
  nots: string[];
  orMode: boolean;
  empty: boolean;
}

export function parseQuery(q: string): ParsedQuery {
  const phrases: string[] = [];
  const terms: string[] = [];
  const nots: string[] = [];
  let orMode = false;
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q)) !== null) {
    if (m[1] != null) {
      phrases.push(normStr(m[1]));
      continue;
    }
    const w = m[2];
    if (w === "أو" || w === "او" || w.toUpperCase() === "OR") {
      orMode = true;
      continue;
    }
    if (w === "و" || w.toUpperCase() === "AND") continue;
    if (w === "ليس") continue;
    if (w.startsWith("-") && w.length > 1) {
      nots.push(normStr(w.slice(1)));
      continue;
    }
    terms.push(normStr(w));
  }
  return { phrases, terms, nots, orMode, empty: phrases.length + terms.length + nots.length === 0 };
}

// ── تجذيع خفيف (Lucene Arabic light stemmer) ──

const PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال", "و"];
const SUFFIXES = ["ها", "ات", "ان", "ون", "ين", "يه", "ه", "ي"];

export function lightStem(word: string): string {
  let w = word;
  if (!w) return w;
  for (const p of PREFIXES) {
    if (w.length - p.length >= 2 && w.startsWith(p)) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 2 && w.endsWith(s)) {
      w = w.slice(0, w.length - s.length);
      break;
    }
  }
  return w;
}

export function tokenize(normalizedText: string): string[] {
  return normalizedText.match(/[ء-ي]{2,}/g) ?? [];
}

// ── فهرس BM25 ──

export interface Bm25Index {
  df: Record<string, number>;
  tf: Array<Record<string, number>>;
  dl: number[];
  avgdl: number;
  N: number;
}

export function buildBm25Index(normalizedDocs: string[]): Bm25Index {
  const df: Record<string, number> = {};
  const tf: Array<Record<string, number>> = [];
  const dl: number[] = [];
  let total = 0;
  normalizedDocs.forEach((text, i) => {
    const tokens = tokenize(text);
    const freq: Record<string, number> = {};
    for (const t of tokens) {
      const s = lightStem(t);
      freq[s] = (freq[s] ?? 0) + 1;
    }
    tf[i] = freq;
    dl[i] = tokens.length;
    total += tokens.length;
    for (const k of Object.keys(freq)) df[k] = (df[k] ?? 0) + 1;
  });
  return { df, tf, dl, avgdl: total / (normalizedDocs.length || 1) || 1, N: normalizedDocs.length };
}

export function bm25Score(idx: Bm25Index, docIndex: number, queryStems: string[]): number {
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  const tf = idx.tf[docIndex] ?? {};
  for (const q of queryStems) {
    const f = tf[q] ?? 0;
    if (!f) continue;
    const dfq = idx.df[q] ?? 0;
    const idf = Math.log(1 + (idx.N - dfq + 0.5) / (dfq + 0.5));
    score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + b * (idx.dl[docIndex] / idx.avgdl)));
  }
  return score;
}

export function queryStems(P: ParsedQuery): string[] {
  return [...P.terms, ...P.phrases].map(lightStem).filter(Boolean);
}

// ── توسعة اشتقاقية: كلمة الاستعلام تطابق كل كلمات الوثائق التي تشاركها الجذع ──

export function buildStemFamilies(docs: AnalyzedDocument[]): Map<string, Set<string>> {
  const families = new Map<string, Set<string>>();
  for (const doc of docs) {
    for (const token of tokenize(normStr(`${doc.title} ${doc.rawText}`))) {
      const stem = lightStem(token);
      let set = families.get(stem);
      if (!set) {
        set = new Set<string>();
        families.set(stem, set);
      }
      set.add(token);
    }
  }
  return families;
}

// المعجم الصرفي (جذر→صيغ) — يُحمَّل اختيارياً من public/doc-lexicon.json.
// المفتاح: صيغة مُطبَّعة → كل الصيغ الصرفية المُطبَّعة لجذرها. يوسّع البحث صرفياً.
let morphLexicon: Map<string, string[]> | null = null;

/** يُبني خريطة (صيغة مُطبَّعة → صيغ جذرها المُطبَّعة) من خريطة الجذور الخام */
export function buildMorphLexicon(roots: Record<string, string[]>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const forms of Object.values(roots)) {
    if (!Array.isArray(forms) || forms.length < 2) continue;
    const normForms = Array.from(new Set(forms.map(normStr).filter((f) => f.length >= 2)));
    if (normForms.length < 2) continue;
    for (const f of normForms) {
      const existing = map.get(f);
      if (existing) {
        for (const nf of normForms) if (!existing.includes(nf)) existing.push(nf);
      } else {
        map.set(f, normForms);
      }
    }
  }
  return map;
}

/** يُفعّل التوسعة الصرفية بالمعجم (يُستدعى مرّة بعد جلب doc-lexicon.json) */
export function setMorphLexicon(map: Map<string, string[]> | null): void {
  morphLexicon = map;
}

export function hasMorphLexicon(): boolean {
  return morphLexicon !== null && morphLexicon.size > 0;
}

export function expandTerm(term: string, families: Map<string, Set<string>> | null): string[] {
  const out = new Set<string>([term]);
  // التوسعة (بالجذع أو صرفياً) مرتبطة بمفتاح «البحث بالجذر»: families != null يعني المفتاح مُفعّل.
  if (families) {
    const family = families.get(lightStem(term));
    if (family) for (const f of family) out.add(f);
    // توسعة صرفية بالمعجم: صيغ الجذر نفسه (مرغوب/رغائب لـ«رغبة»…)
    if (morphLexicon) {
      const forms = morphLexicon.get(term);
      if (forms) for (const f of forms) out.add(f);
    }
  }
  return Array.from(out);
}

export function matchDoc(P: ParsedQuery, normHay: string, families: Map<string, Set<string>> | null): boolean {
  for (const not of P.nots) if (not && normHay.includes(not)) return false;
  const fams: string[][] = [...P.phrases.map((p) => [p]), ...P.terms.map((t) => expandTerm(t, families))];
  if (fams.length === 0) return true;
  const famHit = (f: string[]) => f.some((x) => x && normHay.includes(x));
  if (P.orMode) return fams.some(famHit);
  return fams.every(famHit);
}

/** كل الأشكال المطلوب تظليلها لاستعلام ما */
export function highlightNeedles(P: ParsedQuery, families: Map<string, Set<string>> | null): string[] {
  return [...P.phrases, ...P.terms.flatMap((t) => expandTerm(t, families))].filter(Boolean);
}

/** مواضع المطابقات على النص الأصلي (مدموجة التداخل) */
export function findRanges(text: string, needles: string[]): Array<[number, number]> {
  if (!needles.length) return [];
  const { n, map } = buildNorm(text);
  const hits: Array<[number, number]> = [];
  for (const needle of needles) {
    if (!needle) continue;
    let idx = 0;
    while ((idx = n.indexOf(needle, idx)) >= 0) {
      hits.push([idx, idx + needle.length]);
      idx += needle.length;
    }
  }
  hits.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
    else merged.push([h[0], h[1]]);
  }
  const orig = (np: number) => (np < map.length ? map[np] : map.length ? map[map.length - 1] + 1 : 0);
  return merged.map(([a, b]) => [orig(a), orig(b - 1) + 1]);
}

export interface Occurrence {
  i: number;
  pre: string;
  hit: string;
  post: string;
}

/** مقتطفات كل المطابقات داخل وثيقة (لوحة «كل النتائج») */
export function occurrences(text: string, needles: string[]): Occurrence[] {
  return findRanges(text, needles).map((rg, i) => {
    const a = Math.max(0, rg[0] - 32);
    const b = Math.min(text.length, rg[1] + 40);
    return {
      i,
      pre: (a > 0 ? "…" : "") + text.slice(a, rg[0]),
      hit: text.slice(rg[0], rg[1]),
      post: text.slice(rg[1], b) + (b < text.length ? "…" : "")
    };
  });
}

// ── الكلمات غير الواضحة (تحتاج مراجعة بشرية) — كشف heuristic ──

export function suspectWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    if (raw.includes("�") || raw.includes("□")) {
      const nw = normStr(raw).replace(/[^ء-ي]/g, "");
      if (nw.length >= 2) out.add(nw);
      continue;
    }
    const nw = normStr(raw).replace(/[^ء-ي]/g, "");
    if (nw.length < 4) continue;
    // حرف مكرر ثلاثاً فأكثر (مثل «وكيلللتاعن») — نمط تشوّه OCR شائع
    if (/(.)\1\1/.test(nw)) out.add(nw);
  }
  return out;
}

// ── المصطلحات القانونية (من مكنز المرجع) ──

export interface TermConcept {
  term: string;
  category: string;
  count: number;
  docCount: number;
}

export interface TermStats {
  concepts: TermConcept[];
  /** جذع الكلمة ← اسم المصطلح (للتظليل داخل النص) */
  stemToTerm: Map<string, { term: string; category: string }>;
  /** لكل وثيقة: المصطلح ← عدد مرّاته */
  byDoc: Array<Record<string, number>>;
}

export function computeTermStats(docs: AnalyzedDocument[]): TermStats {
  const stemToTerm = new Map<string, { term: string; category: string }>();
  for (const { category, terms } of thesaurusCategories()) {
    for (const term of terms) {
      const stem = lightStem(normStr(term));
      if (stem.length >= 2 && !stemToTerm.has(stem)) stemToTerm.set(stem, { term, category });
    }
  }
  const counts = new Map<string, { category: string; count: number; docs: Set<number> }>();
  const byDoc: Array<Record<string, number>> = [];
  docs.forEach((doc, di) => {
    const perDoc: Record<string, number> = {};
    for (const token of tokenize(normStr(doc.rawText))) {
      const hit = stemToTerm.get(lightStem(token));
      if (!hit) continue;
      perDoc[hit.term] = (perDoc[hit.term] ?? 0) + 1;
      let c = counts.get(hit.term);
      if (!c) {
        c = { category: hit.category, count: 0, docs: new Set<number>() };
        counts.set(hit.term, c);
      }
      c.count += 1;
      c.docs.add(di);
    }
    byDoc.push(perDoc);
  });
  const concepts: TermConcept[] = Array.from(counts.entries())
    .map(([term, c]) => ({ term, category: c.category, count: c.count, docCount: c.docs.size }))
    .sort((a, b) => b.count - a.count);
  return { concepts, stemToTerm, byDoc };
}

// ── الكلمات الأكثر تكراراً (مجمّعة بالجذع، بلا أسماء الأطراف ولا كلمات الوصل) ──

const STOPWORDS = new Set(
  [
    "علي", "الي", "التي", "الذي", "ذلك", "هذا", "هذه", "فيه", "فيها", "منه", "منها", "عليه", "عليها",
    "بين", "بعد", "قبل", "حيث", "كان", "كانت", "يكون", "تكون", "وفق", "بناء", "لدي", "عند", "غير",
    "كما", "اذا", "إذا", "الا", "إلا", "ولا", "وما", "وهو", "وهي", "ان", "أن", "إن", "قد", "ثم", "او", "أو",
    "بما", "مما", "لما", "عن", "من", "في", "ما", "لا", "له", "لها", "به", "بها", "هو", "هي", "تم", "وقد"
  ].map(normStr)
);

export interface FreqGroup {
  word: string;
  count: number;
  docCount: number;
  forms: string[];
}

export function computeFrequencies(docs: AnalyzedDocument[], limit = 40): FreqGroup[] {
  const partyWords = new Set<string>();
  for (const doc of docs) {
    for (const e of doc.entities) {
      if (e.kind === "party") for (const w of tokenize(normStr(e.value))) partyWords.add(lightStem(w));
    }
  }
  const groups = new Map<string, { count: number; docs: Set<number>; forms: Map<string, number> }>();
  docs.forEach((doc, di) => {
    for (const token of tokenize(normStr(doc.rawText))) {
      if (token.length < 3 || STOPWORDS.has(token)) continue;
      const stem = lightStem(token);
      if (stem.length < 2 || partyWords.has(stem)) continue;
      let g = groups.get(stem);
      if (!g) {
        g = { count: 0, docs: new Set<number>(), forms: new Map<string, number>() };
        groups.set(stem, g);
      }
      g.count += 1;
      g.docs.add(di);
      g.forms.set(token, (g.forms.get(token) ?? 0) + 1);
    }
  });
  return Array.from(groups.values())
    .map((g) => {
      const forms = Array.from(g.forms.entries()).sort((a, b) => b[1] - a[1]);
      return { word: forms[0][0], count: g.count, docCount: g.docs.size, forms: forms.map(([f]) => f) };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── تحويل التاريخ هجري↔ميلادي (تقريبي تبويبي — كما في v2) ──

function gregToJD(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function jdToGreg(jd: number): [number, number, number] {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * mm + 2) / 5) + 1;
  const month = mm + 3 - 12 * Math.floor(mm / 10);
  const year = 100 * b + dd - 4800 + Math.floor(mm / 10);
  return [year, month, day];
}

// مبدأ التقويم الهجري (JDN لـ 1 محرّم 1هـ). الصحيح 1948439؛ كان خطأً 1948440-385=1948055
// فأزاح كل تحويلٍ ~سنةً كاملة (1426/3/20هـ → 2004 بدل 2005). مُعايَر: 1محرّم1426=2005-02-10.
const HIJRI_EPOCH_JD = 1948439;

function hijriToJD(y: number, m: number, d: number): number {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + HIJRI_EPOCH_JD;
}

function jdToHijri(jd: number): [number, number, number] {
  const y = Math.floor((30 * (jd - HIJRI_EPOCH_JD) + 10646) / 10631);
  let m = Math.min(12, Math.ceil((jd - (29 + hijriToJD(y, 1, 1) - 1)) / 29.5) + 1);
  if (m < 1) m = 1;
  const d = jd - hijriToJD(y, m, 1) + 1;
  return [y, m, d];
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** تحويل تقريبي لتاريخ بصيغة yyyy/mm/dd أو dd-mm-yyyy — يكشف هجري/ميلادي من السنة */
export function convertDateApprox(source: string): string {
  const s = normStr(source);
  let y = 0;
  let mo = 0;
  let d = 0;
  let m = s.match(/(\d{3,4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})/);
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else {
    m = s.match(/(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{3,4})/);
    if (!m) return "";
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  }
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  try {
    if (y < 1700) {
      const g = jdToGreg(hijriToJD(y, mo, d));
      return `م ${pad2(g[2])}-${pad2(g[1])}-${g[0]} (تقريبي)`;
    }
    const h = jdToHijri(gregToJD(y, mo, d));
    return `هـ ${pad2(h[2])}-${pad2(h[1])}-${h[0]} (تقريبي)`;
  } catch {
    return "";
  }
}

// ── أسطر الترويسة (boilerplate) ──

const BOILER_SNIPPETS = ["المملكه العربيه السعوديه", "وزاره العدل", "بسم الله الرحمن الرحيم"].map(normStr);

export function isBoilerplateLine(line: string): boolean {
  const n = normStr(line.trim());
  if (!n) return false;
  if (n.length > 120) return false;
  return BOILER_SNIPPETS.some((b) => n.includes(b));
}
