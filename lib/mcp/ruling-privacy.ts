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
 * ولا يُعثر على حكم باسم فرد: النتيجة اللفظية التي لا تطابق ألفاظُها إلا داخل اسم محجوب تُسقط
 * (lexicalMatchOnlyInNames للبحث، وenumerateMatchOnlyInNames للحصر)، والأعداد حينها من الصفحة وحدها.
 */
import { maskPersonalData } from "@/lib/rulings/research/mask";
import { redactPII, splitRulingQuery } from "@/lib/modules/legal-core/rulings-search";
import { buildRulingExcerpts, excerptFrom, findMatches, queryTokens } from "@/lib/modules/legal-core/ruling-excerpts";
import { digitVariants } from "@/lib/modules/legal-core/ruling-redacted-sql";
import { normalizeArabic } from "@/lib/modules/legal-core/bm25-tokenizer";
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

const hasAllTokens = (text: string, tokens: string[]): boolean =>
  tokens.every((t) => digitVariants(t).some((v) => findMatches(text, v).length > 0));

/**
 * البحث اللفظي يشترط كل ألفاظ الاستعلام كلماتٍ كاملة في العنوان والمتن. يكون الحكم مطابقًا بأسماء الأفراد
 * وحدها إن وردت ألفاظه كلها في النص قبل حجب الأسماء (بعد redactPII) ولم ترد كلها بعده.
 * إن لم ترد قبل الحجب أصلًا (طابق بصيغة أو حقل آخر) فلا يُحكم بشيء: الإسقاط لما محاه الحجب وحده.
 * maskedText: النص كما يخرج من الموصل (maskBySegments)، فالمقارنة على ما يراه المستخدم.
 */
export function lexicalMatchOnlyInNames(
  row: { title?: string | null; text?: string | null; maskedText?: string },
  query: string,
): boolean {
  const tokens = queryTokens(splitRulingQuery(query).text);
  if (!tokens.length) return false;
  const title = row.title ?? "";
  const text = row.text ?? "";
  if (!hasAllTokens(redactPII(`${title}\n${text}`), tokens)) return false;
  const after = `${maskPersonalData(title)}\n${row.maskedText ?? maskBySegments(text).masked}`;
  return !hasAllTokens(after, tokens);
}

export type EnumerateTerm = { text: string; numbers: string[]; sensitive: boolean };

/** يطابق اللفظُ الحكمَ كما يطابقه الحصر: الأرقام في رقم القضية والقرار، والنص في العنوان والمتن (مطبَّعًا، أو كما هو للحساس). */
function enumerateTermMatches(term: EnumerateTerm, body: string, caseNo: string, decisionNo: string): boolean {
  const inNumbers = (v: string) => caseNo.includes(v) || decisionNo.includes(v);
  if (!term.numbers.every((n) => digitVariants(n).some(inNumbers))) return false;
  if (!term.text) return true;
  if (term.sensitive) {
    const low = body.toLowerCase();
    return digitVariants(term.text).some((v) => low.includes(v.toLowerCase()) || inNumbers(v));
  }
  const needle = normalizeArabic(term.text);
  return needle.length > 0 && normalizeArabic(body).includes(needle);
}

/**
 * الحصر (أي لفظ، احتواءً): الحكم مطابق بالأسماء وحدها إن طابقه لفظ واحد على الأقل قبل حجب الأسماء
 * ولم يطابقه أي لفظ بعده. maskedTitle/maskedText كما تخرج من الموصل.
 */
export function enumerateMatchOnlyInNames(
  row: { title?: string | null; text?: string | null; maskedTitle: string; maskedText: string; caseNo?: string | null; decisionNo?: string | null },
  terms: EnumerateTerm[],
): boolean {
  const caseNo = row.caseNo ?? "";
  const decisionNo = row.decisionNo ?? "";
  const before = redactPII(`${row.title ?? ""} ${row.text ?? ""}`);
  if (!terms.some((t) => enumerateTermMatches(t, before, caseNo, decisionNo))) return false;
  const after = `${row.maskedTitle} ${row.maskedText}`;
  return !terms.some((t) => enumerateTermMatches(t, after, caseNo, decisionNo));
}

/**
 * التخريج (أي لفظ، احتواءً في العنوان أو نص المبدأ أو الموضوع): المبدأ مطابق بالأسماء وحدها إن ورد لفظ
 * قبل الحجب ولم يرد أي لفظ بعده.
 */
export function containsMatchOnlyInNames(before: Array<string | null | undefined>, after: Array<string | null | undefined>, tokens: string[]): boolean {
  const hit = (fields: Array<string | null | undefined>) => {
    const low = fields.map((f) => (f ?? "").toLowerCase());
    return tokens.some((t) => low.some((f) => f.includes(t.toLowerCase())));
  };
  return hit(before) && !hit(after);
}
