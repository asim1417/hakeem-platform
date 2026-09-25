/** أنواع مكتبة القراءة — قيم unit_type مطابِقة لـ enum Prisma (DocUnitType). */
export type DocUnitType =
  | "INSTRUMENT_OPENING"
  | "RECITAL"
  | "INSTRUMENT_CLAUSE"
  | "INSTRUMENT_CLOSING"
  | "SIGNATURE"
  | "SYSTEM_PREAMBLE"
  | "PART"
  | "CHAPTER"
  | "SECTION"
  | "ARTICLE"
  | "PARAGRAPH"
  | "SUBPARAGRAPH"
  | "DEFINITION_ITEM"
  | "UNCLASSIFIED";

export type DocKind = "SYSTEM_TEXT" | "ROYAL_DECREE" | "COUNCIL_DECISION" | "AGENCY_DECISION" | "BYLAW";

export interface RecitalCitation {
  docType?: string;
  number?: string;
  hijriDate?: string;
}

export interface ParsedUnit {
  type: DocUnitType;
  ordinal: number; // ترتيب القراءة (0..n-1)
  label?: string;
  number?: string; // الرقم المعياري ("12"، "12.1")
  textRaw: string; // الحرفي — يبلّط الوثيقة
  textNormalized: string;
  path: string; // doc/part:1/chapter:2/article:12
  charStart: number;
  charEnd: number;
  parentOrdinal: number | null; // مرجع الأب بالترتيب (يُحلّ إلى parent_id عند التخزين)
  recital?: RecitalCitation; // للوحدات من نوع RECITAL
}

export interface ParseResult {
  kind: DocKind;
  units: ParsedUnit[];
  warnings: string[]; // وحدات unclassified / مقاطع رُفعت للمراجعة
  /** قاعدة عدم السقوط: concat(textRaw بترتيب ordinal) == النصّ الأصلي. */
  reconstructionOk: boolean;
}
