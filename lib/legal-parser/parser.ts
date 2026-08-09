/**
 * parser.ts — آلة حالات القراءة (رابعًا). تُقسّم الوثيقة إلى شجرة وحدات تُبلِّط النصّ
 * حرفيًّا: كل محرف ينتمي لوحدة واحدة، ومجموع textRaw بترتيب ordinal = الأصل تمامًا
 * (قاعدة عدم السقوط، رابعًا-٨). لا توليد ولا تعديل للنصّ.
 */
import { classifyLine, classifyDefinitionItem, isDefinitionsArticle, type LineAnchor } from "./anchors";
import { parseArabicNumber, arabicLetterOrdinal } from "./ordinals";
import { normalizeForIndex } from "./normalize";
import type { DocKind, DocUnitType, ParsedUnit, ParseResult, RecitalCitation } from "./types";

interface Line {
  start: number;
  text: string;
}

/** يقسّم النصّ إلى أسطر مع حفظ السطر الجديد (ليبقى المجموع = الأصل). */
function splitLines(text: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      out.push({ start, text: text.slice(start, i + 1) });
      start = i + 1;
    }
  }
  if (start < text.length) out.push({ start, text: text.slice(start) });
  return out;
}

const REAL_ANCHORS = new Set<DocUnitType>([
  "ARTICLE", "PART", "CHAPTER", "SECTION", "INSTRUMENT_CLAUSE", "RECITAL", "PARAGRAPH", "SUBPARAGRAPH",
]);

/** استخراج إحالة الاستناد من نصّ recital (نوع الوثيقة، رقمها، تاريخها الهجري). */
function extractRecital(text: string): RecitalCitation {
  const c: RecitalCitation = {};
  if (/المرسوم\s+الملكي|بالمرسوم/.test(text)) c.docType = "ROYAL_DECREE";
  else if (/قرار\s+مجلس\s+الوزراء/.test(text)) c.docType = "COUNCIL_DECISION";
  else if (/الأمر\s+الملكي/.test(text)) c.docType = "ROYAL_DECREE";
  const num = text.match(/رقم\s*\(?\s*((?:[مأ]\s*\/\s*)?[0-9٠-٩]+)\s*\)?/);
  if (num) c.number = num[1].replace(/\s+/g, "");
  const date = text.match(/(?:وتاريخ|بتاريخ)\s*([0-9٠-٩]{1,2}\s*\/\s*[0-9٠-٩]{1,2}\s*\/\s*[0-9٠-٩]{3,4}\s*(?:هـ|ه)?)/);
  if (date) c.hijriDate = date[1].replace(/\s+/g, "");
  return c;
}

export interface ParseOptions {
  /** نوع الوثيقة إن عُرف مسبقًا؛ وإلا يُستنتج. */
  kind?: DocKind;
}

/** يقرأ وثيقة نظامية إلى شجرة وحدات. */
export function parseDocument(raw: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const lines = splitLines(raw);

  // ── تمريرة ١: تحديد الحدود (boundaries) وأنواعها ──
  const boundaries: Array<{ lineIdx: number; anchor: LineAnchor }> = [];
  let definitionsMode = false;
  let articleBuf = ""; // لتفعيل نمط التعريفات من نصّ المادة الجاري
  let inArticle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text;
    const a = classifyLine(line);
    if (a && REAL_ANCHORS.has(a.type)) {
      definitionsMode = false;
      inArticle = a.type === "ARTICLE";
      articleBuf = inArticle ? line : "";
      if (inArticle && isDefinitionsArticle(articleBuf)) definitionsMode = true;
      boundaries.push({ lineIdx: i, anchor: a });
      continue;
    }
    // سطر استمرار
    if (inArticle) {
      articleBuf += line;
      if (!definitionsMode && isDefinitionsArticle(articleBuf)) definitionsMode = true;
    }
    if (definitionsMode) {
      const d = classifyDefinitionItem(line);
      if (d) boundaries.push({ lineIdx: i, anchor: d });
    }
  }

  // ── استنتاج نوع الوثيقة ──
  const hasArticle = boundaries.some((b) => b.anchor.type === "ARTICLE");
  const hasInstrument = boundaries.some((b) => b.anchor.type === "INSTRUMENT_CLAUSE" || b.anchor.type === "RECITAL");
  const kind: DocKind = opts.kind ?? (hasArticle ? "SYSTEM_TEXT" : hasInstrument ? "ROYAL_DECREE" : "SYSTEM_TEXT");

  // ── تمريرة ٢: بناء الوحدات المُبلِّطة ──
  const units: ParsedUnit[] = [];
  const firstBoundaryOffset = boundaries.length ? lines[boundaries[0].lineIdx].start : raw.length;

  // الوحدة الافتتاحية (تمهيد/افتتاحية): كل نصّ قبل أول مرساة — لا يُهمل أبدًا (رابعًا-٧).
  if (firstBoundaryOffset > 0) {
    const text = raw.slice(0, firstBoundaryOffset);
    if (text.trim()) {
      units.push({
        type: kind === "SYSTEM_TEXT" ? "SYSTEM_PREAMBLE" : "INSTRUMENT_OPENING",
        ordinal: 0, label: undefined, textRaw: text, textNormalized: normalizeForIndex(text),
        path: "doc/opening", charStart: 0, charEnd: firstBoundaryOffset, parentOrdinal: null,
      });
    } else if (text.length) {
      // فراغ بحت قبل أول مرساة: ألحقه بأول وحدة لاحقًا بدل إسقاطه (يُدمج أدناه).
    }
  }

  for (let k = 0; k < boundaries.length; k++) {
    const { lineIdx, anchor } = boundaries[k];
    const startOffset = lines[lineIdx].start;
    const endOffset = k + 1 < boundaries.length ? lines[boundaries[k + 1].lineIdx].start : raw.length;
    const textRaw = raw.slice(startOffset, endOffset);
    const parsed = anchor.numberExpr ? parseArabicNumber(anchor.numberExpr) : null;
    let number = parsed?.display;
    if (!number && anchor.type === "SUBPARAGRAPH" && anchor.numberExpr) {
      const lo = arabicLetterOrdinal(anchor.numberExpr);
      if (lo) number = String(lo);
    }

    units.push({
      type: anchor.type,
      ordinal: units.length,
      label: anchor.label,
      number,
      textRaw,
      textNormalized: normalizeForIndex(textRaw),
      path: "", // يُحسب أدناه
      charStart: startOffset,
      charEnd: endOffset,
      parentOrdinal: null, // يُحسب أدناه
      recital: anchor.type === "RECITAL" ? extractRecital(textRaw) : undefined,
    });
  }

  // إن بدأ النصّ بفراغ محض بلا وحدة افتتاحية، أدمجه في أول وحدة للحفاظ على التبليط.
  if (units.length && units[0].charStart > 0 && firstBoundaryOffset > 0) {
    const lead = raw.slice(0, units[0].charStart);
    if (!lead.trim()) {
      units[0] = { ...units[0], textRaw: lead + units[0].textRaw, charStart: 0, textNormalized: normalizeForIndex(lead + units[0].textRaw) };
    }
  }

  // إعادة ترقيم ordinal بعد أي دمج، وحساب الأب والمسار.
  units.forEach((u, i) => (u.ordinal = i));
  assignHierarchy(units);

  // ── قاعدة عدم السقوط + التحقق الختامي ──
  const reconstructed = units.map((u) => u.textRaw).join("");
  const reconstructionOk = reconstructed === raw;
  if (!reconstructionOk) warnings.push("إعادة التركيب لا تطابق الأصل — راجع التبليط.");
  for (const u of units) if (u.type === "UNCLASSIFIED") warnings.push(`وحدة غير مصنّفة عند ${u.charStart} — رفع للمراجعة.`);
  if (!units.length && raw.trim()) {
    units.push({
      type: "UNCLASSIFIED", ordinal: 0, textRaw: raw, textNormalized: normalizeForIndex(raw),
      path: "doc/unclassified:0", charStart: 0, charEnd: raw.length, parentOrdinal: null,
    });
    warnings.push("لم تُلتقط أيّ مرساة — الوثيقة كاملةً غير مصنّفة.");
    return { kind, units, warnings, reconstructionOk: units[0].textRaw === raw };
  }

  return { kind, units, warnings, reconstructionOk };
}

/** يحسب parentOrdinal والمسار لكل وحدة عبر سياق تسلسليّ. */
function assignHierarchy(units: ParsedUnit[]): void {
  let part: number | null = null;
  let chapter: number | null = null;
  let section: number | null = null;
  let article: number | null = null;
  let clause: number | null = null;
  let paragraph: number | null = null;
  let recitalSeq = 0;
  let defSeq = 0;

  const seg = (u: ParsedUnit): string => {
    const n = u.number ?? String(u.ordinal);
    switch (u.type) {
      case "PART": return `part:${n}`;
      case "CHAPTER": return `chapter:${n}`;
      case "SECTION": return `section:${n}`;
      case "ARTICLE": return `article:${n}`;
      case "INSTRUMENT_CLAUSE": return `clause:${n}`;
      case "PARAGRAPH": return `para:${n}`;
      case "SUBPARAGRAPH": return `sub:${n}`;
      case "RECITAL": return `recital:${recitalSeq++}`;
      case "DEFINITION_ITEM": return `def:${defSeq++}`;
      case "SYSTEM_PREAMBLE": return "preamble";
      case "INSTRUMENT_OPENING": return "opening";
      default: return `u:${u.ordinal}`;
    }
  };
  const pathOf = (u: ParsedUnit): string => {
    const parentPath = u.parentOrdinal != null ? units[u.parentOrdinal].path : "doc";
    return `${parentPath}/${seg(u)}`;
  };

  for (const u of units) {
    switch (u.type) {
      case "PART":
        u.parentOrdinal = null; part = u.ordinal; chapter = section = article = paragraph = null; clause = null; break;
      case "CHAPTER":
        u.parentOrdinal = part; chapter = u.ordinal; section = article = paragraph = null; break;
      case "SECTION":
        u.parentOrdinal = chapter ?? part; section = u.ordinal; article = paragraph = null; break;
      case "ARTICLE":
        u.parentOrdinal = section ?? chapter ?? part; article = u.ordinal; paragraph = null; clause = null; break;
      case "INSTRUMENT_CLAUSE":
        u.parentOrdinal = null; clause = u.ordinal; paragraph = null; break;
      case "RECITAL":
        u.parentOrdinal = null; break;
      case "PARAGRAPH":
        u.parentOrdinal = article ?? clause; paragraph = u.ordinal; break;
      case "SUBPARAGRAPH":
        u.parentOrdinal = paragraph ?? article ?? clause; break;
      case "DEFINITION_ITEM":
        u.parentOrdinal = article; break;
      default:
        u.parentOrdinal = null; break;
    }
    u.path = pathOf(u);
  }
}
