export type RasdSourceCode = "BOE" | "NCAR" | "UQN";

export type RasdRunType = "BASELINE" | "WEEKLY" | "MANUAL" | "RETRY" | "FULL_RESCAN";
export type RasdTriggerType = "SCHEDULER" | "CLI" | "ADMIN" | "SYSTEM";
export type RasdRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL" | "CANCELLED";

export type RasdChangeType =
  | "NEW_DOCUMENT"
  | "TEXT_AMENDED"
  | "ARTICLE_ADDED"
  | "ARTICLE_REPEALED"
  | "ARTICLE_RENUMBERED"
  | "STATUS_CHANGED"
  | "METADATA_CHANGED"
  | "STRUCTURE_CHANGED"
  | "REPEAL"
  | "CORRECTION"
  | "NO_CHANGE";

export type RasdSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RasdMatchStatus =
  | "EXACT_MATCH"
  | "PROBABLE_MATCH"
  | "AMBIGUOUS"
  | "NO_MATCH"
  | "REJECTED_MATCH"
  | "MANUALLY_CONFIRMED";

export type RasdMatchMethod = "EXACT_INSTRUMENT" | "TITLE_META" | "CONTENT" | "SEMANTIC_HINT" | "MANUAL" | "NONE";

export type RasdDocumentStatus =
  | "ACTIVE"
  | "AMENDED"
  | "REPEALED"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN"
  | "REQUIRES_REVIEW";

export type RasdConflictType =
  | "TEXT_CONFLICT"
  | "METADATA_CONFLICT"
  | "STATUS_CONFLICT"
  | "DATE_CONFLICT"
  | "SOURCE_GAP"
  | "HASH_MISMATCH";

export type RasdConflictStatus = "OPEN" | "RESOLVED" | "DEFERRED";

export type RasdReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "DEFERRED" | "ESCALATED";

export type RasdReviewDecision =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_RECHECK"
  | "DEFER"
  | "MERGE_WITH_EXISTING"
  | "MARK_AS_FALSE_POSITIVE"
  | "ESCALATE_LEGAL_REVIEW";

export type RasdProvisionType =
  | "PREAMBLE"
  | "BOOK"
  | "PART"
  | "CHAPTER"
  | "SECTION"
  | "ARTICLE"
  | "PARAGRAPH"
  | "CLAUSE"
  | "TABLE"
  | "APPENDIX"
  | "EFFECT"
  | "REPEAL";

export type RasdDocumentTypeCode =
  | "LAW"
  | "REGULATION"
  | "IMPLEMENTING_REGULATION"
  | "ROYAL_DECREE"
  | "CABINET_DECISION"
  | "MINISTERIAL_DECISION"
  | "CIRCULAR"
  | "RULES"
  | "GUIDE"
  | "OTHER";

export type RasdLegislativeEffectType =
  | "AMENDS"
  | "REPLACES"
  | "ADDS"
  | "REPEALS"
  | "SUPERSEDES"
  | "COMMENCES"
  | "PUBLISHES"
  | "POSTPONES"
  | "EXTENDS";

export interface HijriGregorianDate {
  raw: string;
  hijri?: string;
  gregorian?: string;
  date?: Date;
}

export interface InstrumentMetadata {
  type?: string;
  number?: string;
  normalizedNumber?: string;
  dateRaw?: string;
  dateHijri?: string;
  dateGregorian?: string;
}

export interface NormalizedMetadata {
  title?: string;
  normalizedTitle?: string;
  documentType?: RasdDocumentTypeCode | string;
  sourceCode?: RasdSourceCode;
  status?: RasdDocumentStatus | string;
  instrumentType?: string;
  instrumentNumber?: string;
  normalizedInstrumentNumber?: string;
  instrumentDate?: string;
  instrumentDateHijri?: string;
  instrumentDateGregorian?: string;
  issuingAuthority?: string;
  publicationDate?: string;
  publicationDateHijri?: string;
  publicationDateGregorian?: string;
  uqnIssue?: string;
  canonicalIdentityKey?: string;
}

export interface DiscoveredDocument {
  sourceCode: RasdSourceCode;
  url: string;
  title?: string;
  sourceDocumentId?: string;
  documentType?: RasdDocumentTypeCode | string;
  publicationDate?: string;
  instrumentNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedProvision {
  provisionType: RasdProvisionType;
  articleNumberRaw?: string;
  articleNumberNormalized?: string;
  paragraphNumber?: string;
  heading?: string;
  textRaw: string;
  textNormalized: string;
  textHash: string;
  sequence: number;
  parentSequence?: number;
  pageNumber?: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ParsedDocument {
  title?: string;
  sourceHint?: RasdSourceCode | string;
  rawText: string;
  normalizedText: string;
  rawHash: string;
  normalizedHash: string;
  structureHash: string;
  metadata: NormalizedMetadata;
  provisions: ParsedProvision[];
  confidence: number;
  effects?: LegislativeEffect[];
}

export interface HakeemArticleCandidate {
  articleNumber: number | string;
  content: string;
}

export interface HakeemLegalSystemCandidate {
  id: string;
  name: string;
  royalDecree?: string | null;
  effectiveFrom?: Date | string | null;
  articles?: HakeemArticleCandidate[];
  metadata?: Record<string, unknown>;
}

export interface MatchCandidate {
  id: string;
  name: string;
  status: RasdMatchStatus;
  method: RasdMatchMethod;
  score: number;
  titleScore: number;
  instrumentScore: number;
  dateScore: number;
  contentScore: number;
  reasons: string[];
}

export interface FieldDiff {
  field: string;
  oldValue?: string;
  newValue?: string;
  changeType: RasdChangeType;
}

export interface ProvisionDiff {
  articleNumber?: string;
  sequence?: number;
  changeType: RasdChangeType;
  oldText?: string;
  newText?: string;
  similarity: number;
}

export interface DiffResult {
  hasChanges: boolean;
  changeType: RasdChangeType;
  severity: RasdSeverity;
  metadataDiffs: FieldDiff[];
  structureDiffs: FieldDiff[];
  provisionDiffs: ProvisionDiff[];
  visualDiffHtml?: string;
}

export interface ChangeDetectionDraft {
  documentId?: string;
  sourceVersionId?: string;
  hakeemLegalSystemId?: string;
  changeType: RasdChangeType;
  severity: RasdSeverity;
  oldValue?: string;
  newValue?: string;
  diffJson?: DiffResult | Record<string, unknown>;
  diffHtml?: string;
  evidenceSnapshotId?: string;
  reviewStatus: RasdReviewStatus;
}

export interface LegislativeEffect {
  effectType: RasdLegislativeEffectType;
  targetRef?: string;
  articleRef?: string;
  rawSnippet: string;
}

export interface SourceConflictDraft {
  documentId?: string;
  fieldName: string;
  valuesBySource: Partial<Record<RasdSourceCode | string, string>>;
  conflictType: RasdConflictType;
  severity: RasdSeverity;
  status: RasdConflictStatus;
  evidence?: Record<string, unknown>;
}

export interface ConnectorDiscoverResult {
  sourceCode: RasdSourceCode;
  ok: boolean;
  documents: DiscoveredDocument[];
  pagesVisited: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyBuffer?: Buffer;
  etag?: string;
  lastModified?: string;
  error?: string;
}

export interface ConnectorDiscoverOptions {
  since?: Date;
  limit?: number;
  sitemapUrl?: string;
  indexUrl?: string;
  fixturePath?: string;
  /** Force fixture-only discovery even if RASD_FIXTURES_ONLY env is false. */
  fixturesOnly?: boolean;
}

export interface ConnectorFetchOptions {
  timeoutMs?: number;
  fixturePath?: string;
  headers?: Record<string, string>;
}
