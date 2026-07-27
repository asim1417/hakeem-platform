import { parseDocumentStructure } from "../parse/structure";
import { normalizeForCompare } from "../normalize/arabic";
import type {
  ConnectorDiscoverOptions,
  ConnectorDiscoverResult,
  ConnectorFetchOptions,
  FetchResult,
  ParsedDocument,
  RasdSourceCode
} from "../types";
import type { SourceHealthResult } from "./contract";

/**
 * Unified connector surface for official legislative sources.
 * Engine must continue when one connector is degraded/unreachable.
 */
export interface LegislativeSourceConnector {
  readonly code: RasdSourceCode;
  readonly displayName: string;
  healthCheck(): Promise<SourceHealthResult>;
  discover(options?: ConnectorDiscoverOptions): Promise<ConnectorDiscoverResult>;
  fetchDocument(url: string, opts?: ConnectorFetchOptions): Promise<FetchResult>;
  /** Parse a raw snapshot body into structured legal document fields. */
  parse(snapshot: RawSourceSnapshot): Promise<ParsedLegalDocument>;
  /** Normalize parsed text/metadata for fingerprinting and matching. */
  normalize(document: ParsedLegalDocument): Promise<NormalizedLegalDocument>;
}

export interface SourceDocumentRef {
  url: string;
  sourceDocumentId?: string;
  title?: string;
}

export interface RawSourceSnapshot {
  sourceCode: RasdSourceCode;
  url: string;
  status: number;
  contentType?: string;
  bodyText: string;
  bodyBuffer?: Buffer;
  fetchedAt: string;
  headers?: Record<string, string>;
}

export interface ParsedLegalDocument extends ParsedDocument {
  sourceCode: RasdSourceCode;
  sourceUrl?: string;
}

export interface NormalizedLegalDocument extends ParsedLegalDocument {
  compareText: string;
}

/** @deprecated Prefer LegislativeSourceConnector — kept for gradual migration. */
export type RasdConnector = LegislativeSourceConnector;

export async function defaultParseSnapshot(
  snapshot: RawSourceSnapshot
): Promise<ParsedLegalDocument> {
  const parsed = parseDocumentStructure(snapshot.bodyText, snapshot.sourceCode);
  return {
    ...parsed,
    sourceCode: snapshot.sourceCode,
    sourceUrl: snapshot.url
  };
}

export async function defaultNormalizeDocument(
  document: ParsedLegalDocument
): Promise<NormalizedLegalDocument> {
  return {
    ...document,
    compareText: normalizeForCompare(document.normalizedText || document.rawText)
  };
}
