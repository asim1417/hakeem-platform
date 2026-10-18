/**
 * HKM-012 (الأمر ٠٨، المسار ٣) — حجب أسماء الأفراد والأرقام الشخصية في كل نص حكم يخرج من الموصل.
 *
 * الموصل لا يعرف دور المستخدم، فيُحجب للجميع بقرار المالك (18/10/2026) بالدالة القائمة maskPersonalData
 * (redactPII ثم الأسماء بعد صفة الطرف وسلاسل النسب). أسماء الشركات والجهات وأرقام المواد تبقى.
 *
 * القاعدة: الحجب قبل القص. القصّ من نص خام ثم الحجب يترك نصف اسم على حد المقتطف أو الشريحة (الصفة
 * خارجها والاسم داخلها) فلا يلتقطه الحجب. لذا كل مخرج يُقتطع من نص محجوب كاملًا:
 *   - المقتطف والمنطوق في البحث (maskedRulingExcerpts).
 *   - شرائح الجلب (maskedChunk): إزاحاتها (offset/next_offset/total_chars) في النص المحجوب.
 * الحجب قاعدي وقد يفوته اسم بلا صفة ولا نسب (انظر mask.ts).
 *
 * ولا يُعثر على حكم باسم فرد (قدر الإمكان قبل بناء الفهرس من النص المحجوب). القاعدة تطابق على search_norm
 * المبني من النص الخام، فيُعاد حساب المطابقة على النسخة المحجوبة بباني الإنتاج نفسه (maskedSearchNorm) وبالقواعد
 * نفسها: tsquery للبحث، وعبارة tsquery بكلمات كاملة للحصر، والاحتواء للتخريج. ما لا يطابق إلا داخل اسم محجوب لا يُعاد (السقوط مغلقًا: بلا شرط «قبل الحجب»).
 * واللفظ الذي يطابق داخل الأسماء غالبًا يُعدّ غير مطابق أصلًا (lib/mcp/name-taint.ts).
 */
import { maskPersonalData } from "@/lib/rulings/research/mask";
import { redactPII } from "@/lib/modules/legal-core/rulings-search";
import { buildRulingExcerpts, excerptFrom, queryTokens, tokenVariants } from "@/lib/modules/legal-core/ruling-excerpts";
import { digitVariants } from "@/lib/modules/legal-core/ruling-redacted-sql";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { segmentRuling } from "@/lib/rulings/research/segment";

export type MaskedPart = { type: string; start: number; end: number };

/**
 * يحجب الحكم جزءًا جزءًا بحدود أجزائه في النص الخام، ويعيد النص المحجوب وخريطة الأجزاء بإزاحاتها فيه.
 * هكذا تبقى الأجزاء كما يكشفها المقطِّع في الخام (الحجب لا يمحو مراسيها)، ولا تكشف الإزاحات طول ما حُجب،
 * ويُحجب كل جزء مرة واحدة. حدود الأجزاء عناوين («الأسباب:»، «منطوق الحكم:»)، فلا يمتد اسم عبرها عادةً.
 */
export function maskBySegments(raw: string | null | undefined): { masked: string; parts: MaskedPart[] } {
  const text = raw ?? "";
  const segs = [...segmentRuling(text).segments].sort((a, b) => a.start - b.start);
  const pieces: string[] = [];
  const parts: MaskedPart[] = [];
  let pos = 0;
  let len = 0;
  const push = (from: number, to: number, type?: string) => {
    if (to <= from) return;
    const m = maskPersonalData(text.slice(from, to));
    if (type) parts.push({ type, start: len, end: len + m.length });
    pieces.push(m);
    len += m.length;
  };
  for (const sg of segs) {
    const start = Math.max(pos, sg.start);
    const end = Math.max(start, Math.min(text.length, sg.end));
    push(pos, start); // فجوة قبل الجزء (إن وُجدت)
    push(start, end, sg.type);
    pos = end;
  }
  push(pos, text.length);
  return { masked: pieces.join(""), parts };
}

/** نص حكم للعرض في الموصل: أرقام شخصية وأسماء أفراد محجوبة. */
export function maskRulingText(text: string | null | undefined): string {
  return maskPersonalData(text);
}

/**
 * موضع مقتطف دلالي في النص المحجوب: المقتطف الأصلي (من searchRulingsDirect) مأخوذ من النص بعد redactPII،
 * فيُبحث عن بدايته فيه، ثم يُحجب ما قبله لمعرفة موضعه بعد حجب الأسماء. null إن لم يوجد.
 */
function maskedPositionOf(raw: string, originalSnippet: string | null | undefined): number | null {
  const core = (originalSnippet ?? "").replace(/^[\s…]+/, "").replace(/\s+/g, " ").slice(0, 40).trim();
  if (core.length < 12) return null;
  const redacted = redactPII(raw);
  const flat = redacted.replace(/\s+/g, " ");
  const at = flat.indexOf(core);
  if (at < 0) return null;
  // من موضع النص المسطّح إلى موضعه في النص الأصلي المحجوب أرقامه.
  let i = 0;
  let j = 0;
  while (j < at && i < redacted.length) {
    if (/\s/.test(redacted[i])) {
      while (i < redacted.length && /\s/.test(redacted[i])) i++;
      j++;
    } else {
      i++;
      j++;
    }
  }
  return maskBySegments(redacted.slice(0, i)).masked.length;
}

/**
 * مقتطف ومنطوق من النص المحجوب كاملًا.
 * للنتيجة الدلالية: المقتطف من الموضع المطابق نفسه (originalSnippet)، وإلا من بداية الجزء المطابق.
 */
export function maskedRulingExcerpts(
  raw: string | null | undefined,
  query: string,
  semantic?: { part?: string | null; originalSnippet?: string | null } | null,
): { snippet: string; disposition: string | null; parts: Array<{ type: string; start: number; end: number }>; masked: string } {
  const text = raw ?? "";
  const { masked, parts } = maskBySegments(text);
  const ex = buildRulingExcerpts(masked, semantic ? "" : query);
  let snippet = ex.snippet;
  if (semantic) {
    const pos = maskedPositionOf(text, semantic.originalSnippet);
    const part = semantic.part ? parts.find((p) => p.type === semantic.part) : undefined;
    if (pos !== null) snippet = excerptFrom(masked, pos);
    else if (part) snippet = excerptFrom(masked, part.start);
  }
  // المنطوق من جزئه في الحجب جزءًا جزءًا (لا من مقطِّع يعمل على النص المحجوب).
  const disp = parts.find((p) => p.type === "disposition");
  const disposition = disp ? excerptFrom(masked, disp.start, Math.min(320, disp.end - disp.start)) : ex.disposition;
  return { snippet, disposition, parts, masked };
}

/**
 * شريحة من نص محجوب سلفًا (hakeem_get_ruling). الإزاحات في النص المحجوب، والنهاية تُمدّ إلى أول مسافة
 * (حد ٤٠ حرفًا) فلا تُقطع كلمة أو «[اسم]». إزاحة عند النهاية أو بعدها = شريحة فارغة.
 */
export function sliceMasked(masked: string, offset: number, maxChars: number): { text: string; offset: number; nextOffset: number | null } {
  const start = Math.max(0, Math.min(Math.floor(offset) || 0, masked.length));
  let end = Math.min(masked.length, start + Math.max(1, Math.floor(maxChars) || 1));
  const ceil = Math.min(masked.length, end + 40);
  while (end < ceil && !/\s/.test(masked[end])) end++;
  return { text: masked.slice(start, end), offset: start, nextOffset: end < masked.length ? end : null };
}

/** شريحة من نص خام بعد حجبه كاملًا. */
export function maskedChunk(target: string, offset: number, maxChars: number) {
  const masked = maskPersonalData(target);
  return { ...sliceMasked(masked, offset, maxChars), total: masked.length };
}

// ── المطابقة على النسخة المحجوبة ──

/** حقول judicial_cases التي يبني منها باني الإنتاج search_norm (scripts/backfill-rulings-search-norm.ts). */
export type RulingIndexFields = {
  court?: string | null;
  judgmentTitle?: string | null;
  judgmentText?: string | null;
  appealText?: string | null;
  caseNo?: string | null;
  decisionNo?: string | null;
  cityName?: string | null;
};
/** سقف المتن والاستئناف في الباني. */
export const SEARCH_NORM_TEXT_CAP = 20_000;

const joinIndex = (f: RulingIndexFields, title: string, text: string, appeal: string) =>
  normalizeArabicText([f.court ?? "", title, text, appeal, f.caseNo ?? "", f.decisionNo ?? "", f.cityName ?? ""].filter(Boolean).join("\n"));

/** search_norm كما يبنيه باني الإنتاج من النص الخام (المحكمة والعنوان والمتن والاستئناف والرقمان والمدينة). */
export function productionSearchNorm(f: RulingIndexFields): string {
  return joinIndex(
    f,
    f.judgmentTitle ?? "",
    (f.judgmentText ?? "").slice(0, SEARCH_NORM_TEXT_CAP),
    (f.appealText ?? "").slice(0, SEARCH_NORM_TEXT_CAP),
  );
}

/**
 * النسخة المحجوبة: العنوان والاستئناف بعد maskPersonalData، والمتن بـ maskBySegments كما يُعرض في الموصل
 * (فلا يختلف ما يُفحص عمّا يُعرض)، والمتن والاستئناف بالسقف نفسه قبل الحجب.
 */
export function maskedSearchNorm(f: RulingIndexFields): string {
  return joinIndex(
    f,
    maskPersonalData(f.judgmentTitle),
    maskBySegments((f.judgmentText ?? "").slice(0, SEARCH_NORM_TEXT_CAP)).masked,
    maskPersonalData((f.appealText ?? "").slice(0, SEARCH_NORM_TEXT_CAP)),
  );
}

/** كلمات search_norm بترتيبها كما يقسمها to_tsvector('simple'): حروف وأرقام، بأحرف صغيرة. */
export function normWordList(norm: string): string[] {
  return norm.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
/** مجموعة كلمات search_norm. */
export function normWords(norm: string): Set<string> {
  return new Set(normWordList(norm));
}

/**
 * كلمات النسخة المحجوبة التي يطابقها البحث: search_norm بسقفه، والمتن المحجوب كاملًا إن جاوز السقف
 * (مسار أجزاء الأحكام ruling_segments يجد اللفظ في الأسباب بعد الحرف 20000).
 */
export function maskedMatchWords(f: RulingIndexFields): Set<string> {
  const words = normWords(maskedSearchNorm(f));
  const text = f.judgmentText ?? "";
  if (text.length > SEARCH_NORM_TEXT_CAP) for (const w of normWordList(normalizeArabicText(maskBySegments(text).masked))) words.add(w);
  return words;
}
/** النظير الخام: ما تطابقه القاعدة قبل الحجب. */
export function rawMatchWords(f: RulingIndexFields): Set<string> {
  const words = normWords(productionSearchNorm(f));
  const text = f.judgmentText ?? "";
  if (text.length > SEARCH_NORM_TEXT_CAP) for (const w of normWordList(normalizeArabicText(text))) words.add(w);
  return words;
}

const HAS_LETTER = /\p{L}/u;

/**
 * مجموعات صيغ البحث اللفظي كما يبنيها buildRulingTsQuery (كل لفظ بصيغه، والألفاظ بـ AND)، لكل لفظ فيه حرف
 * (لا الأرقام وحدها: لا يمسّها حجب الأسماء). text: نص الاستعلام بعد NFKC وsplitRulingQuery.
 */
export function checkedLexicalGroups(text: string): string[][] {
  return queryTokens(text.normalize("NFKC"))
    .slice(0, 8)
    .filter((t) => HAS_LETTER.test(t))
    .map((t) => tokenVariants(t).map((v) => v.toLowerCase()))
    .filter((g) => g.length > 0);
}

/** يرد اللفظ (بإحدى صيغه) كلمةً في search_norm. */
export const groupInWords = (words: Set<string>, group: string[]): boolean => group.some((v) => words.has(v));

/**
 * الحكم اللفظي يُعاد إن طابقت النسخةُ المحجوبة كلَّ الألفاظ كما تطابقها القاعدة (tsquery بـ AND).
 * وإلا فقد طابق بما في اسم محجوب.
 */
export function lexicalVisible(masked: Set<string>, groups: string[][]): boolean {
  return groups.every((g) => groupInWords(masked, g));
}

/**
 * النتيجة الدلالية لا تُطابَق لفظًا، فتُسقط إن ورد أحد ألفاظ الاستعلام في الخام ولم يرد بعد الحجب
 * (أي أن اللفظ في الحكم داخل اسم).
 */
export function semanticNameHit(raw: Set<string>, masked: Set<string>, groups: string[][]): boolean {
  return groups.some((g) => groupInWords(raw, g) && !groupInWords(masked, g));
}

// ── الحصر: عبارة بكلمات كاملة ──

/** عبارة الحصر: صيغ كل كلمة دالّة، والمسافة بين كل كلمتين في العبارة (tsquery «<N>»). */
export type PhraseQuery = { groups: string[][]; gaps: number[] };

/**
 * يبني عبارة الحصر من نص اللفظ (بعد NFKC): الكلمات الدالّة بصيغها (السوابق والتطبيعان)، والمسافة بينها كما في
 * النص (كلمة الوقف المحذوفة تبقى مسافة). null إن لم يبق فيه كلمة دالّة («؟؟»).
 */
export function enumeratePhrase(text: string): PhraseQuery | null {
  const words = text.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  const kept: Array<{ i: number; g: string[] }> = [];
  words.forEach((w, i) => {
    if (kept.length >= 8 || !queryTokens(w).length) return;
    const g = tokenVariants(w).map((v) => v.toLowerCase());
    if (g.length) kept.push({ i, g });
  });
  if (!kept.length) return null;
  return { groups: kept.map((k) => k.g), gaps: kept.slice(1).map((k, j) => k.i - kept[j].i) };
}

/** نص tsquery للعبارة: «(أ | ب) <1> (ج | د)». الصيغ حروف وأرقام فقط (queryTokens يحذف عوامل tsquery). */
export function phraseTsQuery(p: PhraseQuery): string {
  return p.groups.map((g, i) => `${i ? ` <${p.gaps[i - 1]}> ` : ""}(${g.join(" | ")})`).join("");
}

/** تطابق العبارة كلماتِ النص بترتيبها ومسافاتها (كمطابقة tsquery على مواضع tsvector). */
export function phraseInWords(words: string[], p: PhraseQuery): boolean {
  const sets = p.groups.map((g) => new Set(g));
  for (let i = 0; i < words.length; i++) {
    if (!sets[0].has(words[i])) continue;
    let pos = i;
    let ok = true;
    for (let k = 1; k < sets.length && ok; k++) {
      pos += p.gaps[k - 1];
      ok = pos < words.length && sets[k].has(words[pos]);
    }
    if (ok) return true;
  }
  return false;
}

export type EnumerateTerm = { text: string; numbers: string[]; sensitive: boolean; phrase: PhraseQuery | null };

/** في اللفظ حرف (فقد يكون اسمًا). */
export const termHasLetters = (t: EnumerateTerm): boolean => HAS_LETTER.test(t.text);

/**
 * يطابق لفظُ الحصر الحكمَ كما يطابقه SQL في enumerateRulings، على النسخة المحجوبة:
 * الأرقام في رقم القضية والقرار (LIKE)، والعبارة بكلمات كاملة في search_norm (tsquery)،
 * والحساس في العنوان والمتن المنقّحين أو الرقمين (ILIKE).
 */
export function enumerateTermVisible(
  term: EnumerateTerm,
  row: { maskedWords: () => string[]; maskedTitleText: () => string; caseNo?: string | null; decisionNo?: string | null },
): boolean {
  const caseNo = row.caseNo ?? "";
  const decisionNo = row.decisionNo ?? "";
  if (!term.numbers.every((n) => digitVariants(n).some((v) => caseNo.includes(v) || decisionNo.includes(v)))) return false;
  if (!term.text) return true;
  if (term.sensitive) {
    const body = row.maskedTitleText().toLowerCase();
    const nums = `${caseNo}\n${decisionNo}`.toLowerCase();
    return digitVariants(term.text).some((v) => body.includes(v.toLowerCase()) || nums.includes(v.toLowerCase()));
  }
  return term.phrase !== null && phraseInWords(row.maskedWords(), term.phrase);
}

/** التخريج (contains بلا حساسية حالة على العنوان أو نص المبدأ أو الموضوع): يطابق لفظٌ النسخةَ المحجوبة. */
export function containsVisible(tokens: string[], maskedFields: Array<string | null | undefined>): boolean {
  const low = maskedFields.map((f) => (f ?? "").toLowerCase());
  return tokens.some((t) => low.some((f) => f.includes(t.toLowerCase())));
}
