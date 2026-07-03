// مصنّف الوثائق التشغيلي — نقل reference_classify.py إلى TypeScript كما هو،
// مع طبقة استخراج كيانات حتمية (regex) بلا أي توليد — «لا hallucination».

import { legalDocumentReference, thesaurusCategories } from "./reference";
import type {
  AnalyzedDocument,
  EntityKind,
  ExtractedEntity,
  IssuerDetection,
  LegalDocumentReference,
  MatchSource,
  QualityAssessment,
  TextSegment,
  TypeClassification
} from "./types";

// ── التطبيع ──

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰

/** يحوّل الأرقام العربية-الهندية إلى ASCII حرفاً بحرف (يحافظ على طول النص — لازم للتظليل) */
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= ARABIC_INDIC_ZERO && cp <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + (cp - ARABIC_INDIC_ZERO));
    } else if (cp >= EXTENDED_ARABIC_INDIC_ZERO && cp <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + (cp - EXTENDED_ARABIC_INDIC_ZERO));
    } else {
      out += ch;
    }
  }
  return out;
}

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

/** التطبيع الكامل للمطابقة — مكافئ _norm() في النسخة المرجعية، مع تطبيع الأرقام أيضاً */
export function normalizeForMatch(text: string): string {
  const nfkc = (text ?? "").normalize("NFKC");
  let out = "";
  for (const ch of nfkc) {
    const cp = ch.codePointAt(0) ?? 0;
    // حذف التشكيل والتطويل والألف الخنجرية
    if ((cp >= 0x064b && cp <= 0x0652) || cp === 0x0640 || cp === 0x0670) continue;
    out += LETTER_VARIANTS[ch] ?? ch;
  }
  return normalizeDigits(out).replace(/\s+/g, " ").trim().toLowerCase();
}

function firstHit(haystack: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    if (haystack.includes(normalizeForMatch(keyword))) return keyword;
  }
  return null;
}

// ── التصنيف: العنوان أولاً (أدقّ)، ثم المتن بكلمات محدّدة، ثم كلمات العنوان في المتن ──

export function classifyType(
  title: string,
  body: string,
  ref: LegalDocumentReference = legalDocumentReference
): TypeClassification {
  const normalizedTitle = normalizeForMatch(title);
  for (const docType of ref.doc_types) {
    const keyword = firstHit(normalizedTitle, docType.classify.title_keywords);
    if (keyword) return { code: docType.code, name: docType.name, matchedOn: "title", keyword };
  }
  const normalizedBody = normalizeForMatch(body);
  const fallbacks: Array<{ source: MatchSource; pick: (dt: (typeof ref.doc_types)[number]) => string[] }> = [
    { source: "body", pick: (dt) => dt.classify.body_keywords },
    { source: "body-title", pick: (dt) => dt.classify.title_keywords }
  ];
  for (const { source, pick } of fallbacks) {
    for (const docType of ref.doc_types) {
      const keyword = firstHit(normalizedBody, pick(docType));
      if (keyword) return { code: docType.code, name: docType.name, matchedOn: source, keyword };
    }
  }
  return { code: "UNK", name: "غير مصنّف", matchedOn: null, keyword: null };
}

/** كشف الجهة المُصدِرة من الترويسة — الأعلى مطابقةً، بوزن إضافي لنمط الترويسة */
export function detectIssuer(
  headerText: string,
  ref: LegalDocumentReference = legalDocumentReference
): IssuerDetection {
  const normalized = normalizeForMatch(headerText);
  let best: { score: number; code: string; name: string } | null = null;
  for (const issuer of ref.issuers) {
    let score = issuer.match_keywords.filter((kw) => normalized.includes(normalizeForMatch(kw))).length;
    score += issuer.header_pattern.filter((p) => normalized.includes(normalizeForMatch(p))).length * 0.5;
    if (score > 0 && (best === null || score > best.score)) {
      best = { score, code: issuer.code, name: issuer.name };
    }
  }
  return best ? { code: best.code, name: best.name } : { code: "UNK", name: "غير محدّد" };
}

// ── السنة الهجرية والرمز الهرمي ──

export function extractHijriYear(text: string): string {
  const normalized = normalizeForMatch(text);
  // أولاً: سنة داخل تاريخ صريح 14XX/MM/DD (الأدقّ)
  const dated = normalized.match(/(?<!\d)(14\d{2})\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{1,2}/);
  if (dated) return dated[1];
  // وإلا: سنة مستقلة غير مضمَّنة في رقم أطول
  const bare = normalized.match(/(?<!\d)14\d{2}(?!\d)/);
  return bare ? bare[0] : "0000";
}

/** الرمز الهرمي الأرشيفي: {TYPE}.{ISSUER}.{YEAR}.{SEQ} — يحلّ محلّ المعرّف المسطّح DOC-001 */
export function makeCode(typeCode: string, issuerCode: string, hijriYear: string, seq: number): string {
  return `${typeCode}.${issuerCode}.${hijriYear}.${String(seq).padStart(3, "0")}`;
}

// ── استخراج الكيانات (حتمي بالكامل) ──

interface EntityMatch {
  kind: EntityKind;
  start: number;
  end: number;
  value: string;
}

const DATE_RE = /(?<!\d)1[34]\d{2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{1,2}\s*(?:هـ|ه)?/g;
const AMOUNT_RE = /(?<!\d)\d{1,3}(?:[,٬]\d{3})+(?!\d)|(?<!\d)\d+(?=\s*(?:ريال|ر\.س))/g;
const DEED_RE = /(?:رقم\s+الصك|صك\s+رقم|رقم\s+الوثيق[ةه]|رقم\s+الوكال[ةه])\s*[:：]?\s*(\d{3,})/g;
const LAW_ARTICLE_RE = /الماد[ةه]\s*\(?\s*\d+\s*\)?\s*من\s+نظام(?:\s+[ء-ي]+){1,4}/g;
const LAW_BARE_RE = /نظام\s+ال[ء-ي]+(?:\s+ال[ء-ي]+){0,2}/g;
const PARTY_RE =
  /(?:المقام[ةه]|المقدم[ةه]|المرفوع[ةه])\s+من\s+(.{3,60}?)\s+(?:ضدّ?|تجاه)\s+(.{3,60}?)(?=\s*[،,.:؛\n]|\s+في\s|$)/g;

function collectMatches(regex: RegExp, kind: EntityKind, text: string, groups = false): EntityMatch[] {
  const matches: EntityMatch[] = [];
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (groups) {
      let cursor = match.index;
      for (let g = 1; g < match.length; g += 1) {
        const value = match[g];
        if (!value) continue;
        const start = text.indexOf(value, cursor);
        if (start === -1) continue;
        matches.push({ kind, start, end: start + value.length, value });
        cursor = start + value.length;
      }
    } else {
      matches.push({ kind, start: match.index, end: match.index + match[0].length, value: match[0] });
    }
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return matches;
}

/** يستخرج كيانات النص مع مواقعها — على نسخة مُطبَّعة الأرقام فقط (نفس الطول) */
function extractEntityMatches(originalText: string): EntityMatch[] {
  const matchText = normalizeDigits(originalText);
  // الأولوية عند التداخل: تاريخ ← صك ← مبلغ ← نظام ← طرف
  const ordered: EntityMatch[] = [
    ...collectMatches(DATE_RE, "date", matchText),
    ...collectMatches(DEED_RE, "deed", matchText, true),
    ...collectMatches(AMOUNT_RE, "amount", matchText),
    ...collectMatches(LAW_ARTICLE_RE, "law", matchText),
    ...collectMatches(LAW_BARE_RE, "law", matchText),
    ...collectMatches(PARTY_RE, "party", matchText, true)
  ];
  const accepted: EntityMatch[] = [];
  for (const candidate of ordered) {
    const overlaps = accepted.some((a) => candidate.start < a.end && candidate.end > a.start);
    if (!overlaps) accepted.push(candidate);
  }
  accepted.sort((a, b) => a.start - b.start);
  // القيمة المعروضة تُؤخذ من النص الأصلي (بأرقامه كما وردت)
  return accepted.map((m) => ({ ...m, value: originalText.slice(m.start, m.end) }));
}

export function extractEntities(text: string): ExtractedEntity[] {
  const seen = new Set<string>();
  const entities: ExtractedEntity[] = [];
  for (const match of extractEntityMatches(text)) {
    const key = `${match.kind}:${normalizeForMatch(match.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({ kind: match.kind, value: match.value.trim() });
  }
  return entities;
}

/** يقسم فقرة إلى مقاطع نص عادي وكيانات مُظلَّلة — لعرض القارئ */
export function segmentParagraph(paragraph: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of extractEntityMatches(paragraph)) {
    if (match.start > cursor) segments.push({ text: paragraph.slice(cursor, match.start), kind: null });
    segments.push({ text: paragraph.slice(match.start, match.end), kind: match.kind });
    cursor = match.end;
  }
  if (cursor < paragraph.length) segments.push({ text: paragraph.slice(cursor), kind: null });
  return segments;
}

// ── المكنز: تصنيف موضوعي ──

export function detectTopics(text: string): string[] {
  const normalized = normalizeForMatch(text);
  return thesaurusCategories()
    .filter(({ terms }) => terms.some((term) => normalized.includes(normalizeForMatch(term))))
    .map(({ category }) => category);
}

// ── مؤشر الجودة (إرشادي — ليس قياس OCR فعلياً) ──

export function assessQuality(text: string): QualityAssessment {
  const trimmed = text.trim();
  const chars = Array.from(trimmed);
  const letterLike = chars.filter((c) => /[\p{L}\p{N}]/u.test(c));
  const arabic = chars.filter((c) => /[؀-ۿ]/u.test(c));
  const arabicRatio = letterLike.length > 0 ? arabic.length / letterLike.length : 0;
  const replacementCount = chars.filter((c) => c === "�" || c === "□").length;

  let score = 100;
  if (arabicRatio < 0.85) score -= Math.min(60, Math.round((0.85 - arabicRatio) * 160));
  score -= Math.min(40, replacementCount * 8);
  if (trimmed.length < 120) score -= 15;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const tinyWords = words.filter((w) => Array.from(w).length === 1).length;
  if (words.length > 0 && tinyWords / words.length > 0.15) score -= 20;
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 85 ? "high" : score >= 65 ? "medium" : "review";
  const label =
    grade === "high"
      ? "ممتازة — لا تحتاج إعادة استخراج"
      : grade === "medium"
        ? "متوسطة — يُستحسن التدقيق"
        : "منخفضة — تحتاج مراجعة";
  return { score, grade, label };
}

// ── التحليل الكامل لوثيقة ──

const HEADER_ZONE_CHARS = 400;

export interface DocumentInput {
  title: string;
  rawText: string;
  verified?: boolean;
}

export function analyzeDocument(input: DocumentInput, seq: number): AnalyzedDocument {
  const rawText = input.rawText.trim();
  const headerZone = rawText.slice(0, HEADER_ZONE_CHARS);
  const type = classifyType(input.title, rawText);
  const issuer = detectIssuer(headerZone);
  const hijriYear = extractHijriYear(headerZone) !== "0000" ? extractHijriYear(headerZone) : extractHijriYear(rawText);
  const entities = extractEntities(rawText);
  const firstDate = entities.find((e) => e.kind === "date");
  return {
    code: makeCode(type.code, issuer.code, hijriYear, seq),
    title: input.title.trim(),
    rawText,
    type,
    issuer,
    hijriYear,
    hijriDate: firstDate ? firstDate.value : null,
    entities,
    topics: detectTopics(rawText),
    quality: assessQuality(rawText),
    paragraphs: rawText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map(segmentParagraph),
    verified: input.verified ?? false
  };
}

/** يحلّل مجموعة وثائق مع تسلسل داخل (النوع×الجهة×السنة) كما يقضي المرجع */
export function analyzeDocuments(inputs: DocumentInput[]): AnalyzedDocument[] {
  const counters = new Map<string, number>();
  return inputs.map((input) => {
    const type = classifyType(input.title, input.rawText);
    const issuer = detectIssuer(input.rawText.slice(0, HEADER_ZONE_CHARS));
    const year = extractHijriYear(input.rawText);
    const key = `${type.code}.${issuer.code}.${year}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    return analyzeDocument(input, seq);
  });
}

/** التسلسل التالي لوثيقة جديدة ضمن مجموعة قائمة */
export function nextSequence(existing: AnalyzedDocument[], typeCode: string, issuerCode: string, year: string): number {
  return (
    existing.filter((d) => d.type.code === typeCode && d.issuer.code === issuerCode && d.hijriYear === year).length + 1
  );
}
