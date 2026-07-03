// أنواع وحدة فحص الوثائق — مطابقة لبنية المرجع التشغيلي
// data/legal-document-reference.json (مشتق من «الدليل المرجعي الشامل للمستندات القانونية السعودية»)

export interface ReferenceMeta {
  title: string;
  version: string;
  source: string;
  note: string;
  usage: string;
}

export interface CodingSchemeField {
  TYPE: string;
  ISSUER: string;
  YEAR: string;
  SEQ: string;
}

export interface CodingScheme {
  format: string;
  description: string;
  fields: CodingSchemeField;
  examples: Array<{ code: string; meaning: string }>;
}

export interface Issuer {
  code: string;
  name: string;
  authority: string;
  platform: string;
  header_pattern: string[];
  match_keywords: string[];
}

export interface DocTypeClassify {
  title_keywords: string[];
  body_keywords: string[];
}

export interface DocType {
  code: string;
  name: string;
  function: string;
  lifecycle_stage: string;
  key_fields: string[];
  structure: string[];
  subtypes: string[];
  classify: DocTypeClassify;
  typical_issuers: string[];
}

export interface LifecycleStage {
  stage: number;
  name: string;
  event: string;
  outputs: string[];
}

export interface Verification {
  steps: string[];
  storage_recommendation: string;
}

/** المكنز: فئة → مصطلحاتها. المفتاح "_note" نصّ توثيقي وليس فئة. */
export type Thesaurus = Record<string, string[] | string>;

export interface LegalDocumentReference {
  _meta: ReferenceMeta;
  coding_scheme: CodingScheme;
  issuers: Issuer[];
  doc_types: DocType[];
  lifecycle: LifecycleStage[];
  thesaurus: Thesaurus;
  verification: Verification;
}

// ── مخرجات التصنيف والتحليل ──

export type MatchSource = "title" | "body" | "body-title";

export interface TypeClassification {
  code: string;
  name: string;
  matchedOn: MatchSource | null;
  keyword: string | null;
}

export interface IssuerDetection {
  code: string;
  name: string;
}

export type EntityKind = "party" | "amount" | "date" | "law" | "deed";

export interface ExtractedEntity {
  kind: EntityKind;
  value: string;
}

export type QualityGrade = "high" | "medium" | "review";

export interface QualityAssessment {
  score: number; // 0–100 — مؤشر إرشادي (heuristic)، ليس قياس OCR فعلياً
  grade: QualityGrade;
  label: string;
}

/** مقطع نصّي داخل فقرة — إمّا نص عادي أو كيان مُظلَّل */
export interface TextSegment {
  text: string;
  kind: EntityKind | null;
}

export interface AnalyzedDocument {
  /** الرمز الهرمي الأرشيفي: {TYPE}.{ISSUER}.{YEAR}.{SEQ} */
  code: string;
  title: string;
  rawText: string;
  type: TypeClassification;
  issuer: IssuerDetection;
  hijriYear: string;
  hijriDate: string | null;
  entities: ExtractedEntity[];
  topics: string[];
  quality: QualityAssessment;
  paragraphs: TextSegment[][];
  verified: boolean;
}
