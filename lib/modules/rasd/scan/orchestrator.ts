import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SOURCES, seedRasdRegistry } from "../db/seed-sources";
import {
  RASD_AUTO_FETCH_ENABLED,
  RASD_BASELINE_ENABLED,
  RASD_FIXTURES_ONLY,
  RASD_FULL_RESCAN_ALLOWED,
  envBool,
  requireRasdEnabled
} from "../flags";
import { fingerprintObject, sha256Hex } from "../hash";
import { normalizeForCompare } from "../normalize/arabic";
import { buildCanonicalIdentityKey } from "../normalize/identity";
import { detectSourceConflicts } from "../conflict/engine";
import { buildDiffResult } from "../diff/engine";
import { rankMatches } from "../match/engine";
import { parseDocumentStructure, PARSER_VERSION } from "../parse/structure";
import { saveSnapshotLocal } from "../snapshot/store";
import { getConnector, listConnectors } from "../connectors";
import { acquireRunLock, releaseRunLock } from "../runs/lock";
import { createRun, failRun, finishRun, getRun, startRun, updateRunCounts, type RasdMonitoringRun } from "../runs/manager";
import type {
  ChangeDetectionDraft,
  DiffResult,
  DiscoveredDocument,
  HakeemLegalSystemCandidate,
  MatchCandidate,
  ParsedDocument,
  ParsedProvision,
  RasdChangeType,
  RasdRunType,
  RasdSeverity,
  RasdSourceCode,
  SourceConflictDraft
} from "../types";

export interface RunScanInput {
  runType: RasdRunType;
  sources?: RasdSourceCode[];
  dryRun?: boolean;
  fixturesOnly?: boolean;
  limit?: number;
  resumeRunId?: string;
  actorId?: string;
}

export interface ScanSourceSummary {
  sourceCode: RasdSourceCode;
  ok: boolean;
  discovered: number;
  fetched: number;
  changed: number;
  unchanged: number;
  failed: number;
  error?: string;
}

export interface ScanResult {
  runId: string;
  runType: RasdRunType;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  dryRun: boolean;
  fixturesOnly: boolean;
  dbAvailable: boolean;
  counts: {
    pagesDiscovered: number;
    pagesFetched: number;
    documentsDiscovered: number;
    documentsNew: number;
    documentsChanged: number;
    documentsUnchanged: number;
    documentsFailed: number;
    conflictsFound: number;
  };
  sources: ScanSourceSummary[];
  changes: ChangeDetectionDraft[];
  conflicts: SourceConflictDraft[];
  failures: string[];
  urgentFlags: string[];
}

interface RasdSourceRecord {
  id: string;
  code: string;
  trustPriority?: number;
}

interface RasdDocumentRecord {
  id: string;
  currentSourceVersionId: string | null;
  matchedLegalSystemId: string | null;
  matchStatus: string;
}

interface RasdVersionRecord {
  id: string;
  documentId: string;
  sourceId: string;
  normalizedTextHash: string;
  structureHash: string;
  metadata: Prisma.JsonValue | null;
  provisions?: RasdProvisionRecord[];
}

interface RasdProvisionRecord {
  provisionType: string;
  articleNumberRaw: string | null;
  articleNumberNormalized: string | null;
  paragraphNumber: string | null;
  heading: string | null;
  textRaw: string;
  textNormalized: string;
  textHash: string;
  sequence: number;
  pageNumber: number | null;
  metadata: Prisma.JsonValue | null;
}

interface RasdDelegates {
  monitoringSource?: {
    findUnique(args: { where: { code: RasdSourceCode } }): Promise<RasdSourceRecord | null>;
    update(args: { where: { code: RasdSourceCode }; data: Record<string, unknown> }): Promise<unknown>;
  };
  sourceSnapshot?: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  monitoredLegalDocument?: {
    upsert(args: { where: { canonicalIdentityKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<RasdDocumentRecord>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<RasdDocumentRecord>;
    findMany(args: { include?: Record<string, unknown>; take?: number; orderBy?: Record<string, string> }): Promise<Array<RasdDocumentRecord & { versions?: RasdVersionRecord[] }>>;
  };
  monitoredDocumentVersion?: {
    findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<RasdVersionRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<RasdVersionRecord>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
  monitoredProvision?: {
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
  legalDocumentMatch?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  legalChangeDetection?: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }): Promise<Array<Record<string, unknown>>>;
  };
  sourceConflict?: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findMany(args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }): Promise<Array<Record<string, unknown>>>;
  };
}

interface MemoryDocument {
  id: string;
  identityKey: string;
  sourceCode: RasdSourceCode;
  parsed: ParsedDocument;
  discovered: DiscoveredDocument;
  versionId: string;
  matches: MatchCandidate[];
}

const memoryDocuments = new Map<string, MemoryDocument>();
const memoryChanges: ChangeDetectionDraft[] = [];
const memoryConflicts: SourceConflictDraft[] = [];

function delegates(): RasdDelegates {
  return prisma as unknown as RasdDelegates;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isFixturesOnly(input?: boolean): boolean {
  return Boolean(input || RASD_FIXTURES_ONLY || envBool("RASD_FIXTURES_ONLY", false));
}

function shouldUseDb(dryRun: boolean): boolean {
  // Dry-run may still write Rasd staging tables. It never applies changes to the legal library.
  return !envBool("RASD_MEMORY_ONLY", false) || !dryRun;
}

function requireScanFlags(input: RunScanInput): void {
  const fixturesOnly = isFixturesOnly(input.fixturesOnly);
  if (fixturesOnly) return;
  requireRasdEnabled();
  if (input.runType === "BASELINE" && !envBool("RASD_BASELINE_ENABLED", RASD_BASELINE_ENABLED)) {
    throw new Error("RASD baseline scan is disabled. Set RASD_BASELINE_ENABLED=true.");
  }
  if (input.runType === "FULL_RESCAN" && !envBool("RASD_FULL_RESCAN_ALLOWED", RASD_FULL_RESCAN_ALLOWED)) {
    throw new Error("RASD full rescan is disabled. Set RASD_FULL_RESCAN_ALLOWED=true.");
  }
  if (!input.dryRun && !envBool("RASD_AUTO_FETCH_ENABLED", RASD_AUTO_FETCH_ENABLED)) {
    throw new Error("RASD live fetch is disabled. Set RASD_AUTO_FETCH_ENABLED=true or use dryRun/fixtures.");
  }
}

function selectedSources(sources?: RasdSourceCode[]): RasdSourceCode[] {
  if (sources?.length) return [...new Set(sources)];
  return listConnectors().map((connector) => connector.code);
}

function asDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function inferDocumentType(parsed: ParsedDocument, discovered: DiscoveredDocument): string {
  const explicit = parsed.metadata.documentType ?? discovered.documentType;
  if (explicit) return String(explicit);
  const title = parsed.title ?? discovered.title ?? "";
  if (/لائحة/u.test(title)) return "REGULATION";
  if (/قرار/u.test(title)) return "MINISTERIAL_DECISION";
  if (/مرسوم/u.test(title)) return "ROYAL_DECREE";
  if (/قواعد/u.test(title)) return "RULES";
  return /نظام/u.test(title) ? "LAW" : "OTHER";
}

function identityKeyFor(parsed: ParsedDocument, discovered: DiscoveredDocument): string {
  const title = parsed.title ?? discovered.title ?? discovered.sourceDocumentId ?? discovered.url;
  return buildCanonicalIdentityKey({
    documentType: inferDocumentType(parsed, discovered),
    title,
    instrumentType: parsed.metadata.instrumentType,
    instrumentNumber: parsed.metadata.normalizedInstrumentNumber ?? parsed.metadata.instrumentNumber,
    instrumentDate: parsed.metadata.instrumentDateGregorian ?? parsed.metadata.instrumentDateHijri ?? parsed.metadata.instrumentDate,
    authority: parsed.metadata.issuingAuthority,
    uqnIssue: parsed.metadata.uqnIssue,
    publicationDate: parsed.metadata.publicationDateGregorian ?? parsed.metadata.publicationDateHijri ?? parsed.metadata.publicationDate,
    textPartialHash: parsed.normalizedHash.slice(0, 16)
  });
}

function sourceFallback(code: RasdSourceCode): RasdSourceRecord {
  const source = DEFAULT_SOURCES.find((item) => item.code === code);
  return { id: code.toLowerCase(), code, trustPriority: source?.trustPriority };
}

async function getSourceRecord(code: RasdSourceCode, dbAvailable: boolean): Promise<RasdSourceRecord> {
  if (!dbAvailable) return sourceFallback(code);
  const delegate = delegates().monitoringSource;
  if (!delegate) return sourceFallback(code);
  const source = await delegate.findUnique({ where: { code } });
  return source ?? sourceFallback(code);
}

async function findCandidates(dbAvailable: boolean): Promise<HakeemLegalSystemCandidate[]> {
  if (!dbAvailable) return [];
  try {
    const systems = await prisma.legalSystem.findMany({
      take: 500,
      include: {
        articles: {
          take: 8,
          orderBy: { articleNumber: "asc" },
          select: { articleNumber: true, content: true }
        }
      }
    });
    return systems.map((system) => ({
      id: system.id,
      name: system.name,
      articles: system.articles.map((article) => ({
        articleNumber: article.articleNumber,
        content: article.content
      })),
      metadata: {
        classification: system.classification,
        code: system.code,
        eliSlug: system.eliSlug
      }
    }));
  } catch {
    return [];
  }
}

function parsedFromVersion(version: RasdVersionRecord): ParsedDocument {
  const provisions: ParsedProvision[] = (version.provisions ?? []).map((item) => ({
    provisionType: item.provisionType as ParsedProvision["provisionType"],
    articleNumberRaw: item.articleNumberRaw ?? undefined,
    articleNumberNormalized: item.articleNumberNormalized ?? undefined,
    paragraphNumber: item.paragraphNumber ?? undefined,
    heading: item.heading ?? undefined,
    textRaw: item.textRaw,
    textNormalized: item.textNormalized,
    textHash: item.textHash,
    sequence: item.sequence,
    pageNumber: item.pageNumber ?? undefined,
    confidence: 0.8,
    metadata: typeof item.metadata === "object" && item.metadata ? (item.metadata as Record<string, unknown>) : undefined
  }));
  const metadata = typeof version.metadata === "object" && version.metadata ? version.metadata : {};
  return {
    rawText: provisions.map((item) => item.textRaw).join("\n\n"),
    normalizedText: provisions.map((item) => item.textNormalized).join("\n\n"),
    rawHash: version.normalizedTextHash,
    normalizedHash: version.normalizedTextHash,
    structureHash: version.structureHash,
    metadata: metadata as ParsedDocument["metadata"],
    provisions,
    confidence: 0.8
  };
}

function changeFromDiff(input: {
  documentId: string;
  sourceVersionId?: string;
  hakeemLegalSystemId?: string;
  diff: DiffResult;
  snapshotId?: string;
}): ChangeDetectionDraft | null {
  if (!input.diff.hasChanges) return null;
  const oldValue = input.diff.provisionDiffs.find((diff) => diff.oldText)?.oldText;
  const newValue = input.diff.provisionDiffs.find((diff) => diff.newText)?.newText;
  return {
    documentId: input.documentId,
    sourceVersionId: input.sourceVersionId,
    hakeemLegalSystemId: input.hakeemLegalSystemId,
    changeType: input.diff.changeType,
    severity: input.diff.severity,
    oldValue,
    newValue,
    diffJson: input.diff,
    diffHtml: input.diff.visualDiffHtml,
    evidenceSnapshotId: input.snapshotId,
    reviewStatus: "PENDING"
  };
}

function newDocumentChange(documentId: string, versionId: string, parsed: ParsedDocument, snapshotId?: string): ChangeDetectionDraft {
  return {
    documentId,
    sourceVersionId: versionId,
    changeType: "NEW_DOCUMENT",
    severity: "HIGH",
    newValue: parsed.rawText.slice(0, 8000),
    diffJson: { reason: "No existing source version or Hakeem match was found." },
    evidenceSnapshotId: snapshotId,
    reviewStatus: "PENDING"
  };
}

async function saveSnapshotRecord(input: {
  dbAvailable: boolean;
  runId: string;
  source: RasdSourceRecord;
  sourceCode: RasdSourceCode;
  discovered: DiscoveredDocument;
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
  contentType?: string;
}): Promise<{ snapshotId?: string; contentHash: string; storagePath: string }> {
  const local = await saveSnapshotLocal({
    runId: input.runId,
    sourceCode: input.sourceCode,
    url: input.discovered.url,
    body: input.body,
    contentType: input.contentType
  });
  if (!input.dbAvailable || !delegates().sourceSnapshot) {
    return { contentHash: local.contentHash, storagePath: local.path };
  }
  try {
    const snapshot = await delegates().sourceSnapshot?.create({
      data: {
        sourceId: input.source.id,
        runId: input.runId,
        sourceUrl: input.discovered.url,
        canonicalUrl: input.discovered.url,
        httpStatus: input.status,
        contentType: input.contentType,
        etag: input.headers.etag,
        lastModified: input.headers["last-modified"],
        rawStoragePath: local.path,
        rawText: typeof input.body === "string" ? input.body.slice(0, 2_000_000) : undefined,
        contentHash: local.contentHash,
        parserVersion: PARSER_VERSION,
        parseStatus: "PENDING",
        metadata: input.discovered.metadata
      }
    });
    return { snapshotId: snapshot?.id, contentHash: local.contentHash, storagePath: local.path };
  } catch {
    return { contentHash: local.contentHash, storagePath: local.path };
  }
}

async function persistChange(change: ChangeDetectionDraft, dbAvailable: boolean): Promise<void> {
  memoryChanges.push(change);
  if (!dbAvailable || !delegates().legalChangeDetection) return;
  try {
    await delegates().legalChangeDetection?.create({
      data: {
        documentId: change.documentId,
        sourceVersionId: change.sourceVersionId,
        hakeemLegalSystemId: change.hakeemLegalSystemId,
        changeType: change.changeType,
        severity: change.severity,
        oldValue: change.oldValue,
        newValue: change.newValue,
        diffJson: change.diffJson,
        diffHtml: change.diffHtml,
        evidenceSnapshotId: change.evidenceSnapshotId,
        reviewStatus: change.reviewStatus
      }
    });
  } catch {
    // Keep the in-memory draft so reports/tests still have deterministic output.
  }
}

async function stageDocument(input: {
  dbAvailable: boolean;
  source: RasdSourceRecord;
  sourceCode: RasdSourceCode;
  discovered: DiscoveredDocument;
  parsed: ParsedDocument;
  snapshotId?: string;
  candidates: HakeemLegalSystemCandidate[];
}): Promise<{ documentId: string; versionId: string; changed: boolean; matches: MatchCandidate[]; change?: ChangeDetectionDraft }> {
  const identityKey = identityKeyFor(input.parsed, input.discovered);
  const matches = rankMatches(input.parsed, input.candidates).slice(0, 5);
  const bestMatch = matches[0];
  const documentType = inferDocumentType(input.parsed, input.discovered);
  const normalizedTitle = normalizeForCompare(input.parsed.title ?? input.discovered.title ?? input.discovered.url);
  const versionHash = sha256Hex(`${input.parsed.normalizedHash}:${input.parsed.structureHash}:${fingerprintObject(input.parsed.metadata)}`);

  const rasd = delegates();
  if (!input.dbAvailable || !rasd.monitoredLegalDocument || !rasd.monitoredDocumentVersion) {
    const previous = memoryDocuments.get(identityKey);
    const documentId = previous?.id ?? newId("memdoc");
    const versionId = newId("memver");
    const change = previous
      ? changeFromDiff({ documentId, sourceVersionId: versionId, diff: buildDiffResult(previous.parsed, input.parsed) })
      : newDocumentChange(documentId, versionId, input.parsed, input.snapshotId);
    memoryDocuments.set(identityKey, {
      id: documentId,
      identityKey,
      sourceCode: input.sourceCode,
      parsed: input.parsed,
      discovered: input.discovered,
      versionId,
      matches
    });
    if (change) await persistChange(change, false);
    return { documentId, versionId, changed: Boolean(change), matches, change: change ?? undefined };
  }

  const documentDelegate = rasd.monitoredLegalDocument;
  const versionDelegate = rasd.monitoredDocumentVersion;
  const document = await documentDelegate.upsert({
    where: { canonicalIdentityKey: identityKey },
    create: {
      normalizedTitle,
      documentType,
      issuingAuthority: input.parsed.metadata.issuingAuthority,
      approvalInstrumentType: input.parsed.metadata.instrumentType,
      approvalInstrumentNumber: input.parsed.metadata.normalizedInstrumentNumber ?? input.parsed.metadata.instrumentNumber,
      approvalDateHijri: input.parsed.metadata.instrumentDateHijri,
      approvalDateGregorian: asDate(input.parsed.metadata.instrumentDateGregorian),
      publicationDateHijri: input.parsed.metadata.publicationDateHijri,
      publicationDateGregorian: asDate(input.parsed.metadata.publicationDateGregorian),
      ummAlQuraIssueNumber: input.parsed.metadata.uqnIssue,
      status: input.parsed.metadata.status ?? "REQUIRES_REVIEW",
      canonicalIdentityKey: identityKey,
      matchedLegalSystemId: bestMatch && bestMatch.status !== "NO_MATCH" ? bestMatch.id : undefined,
      matchStatus: bestMatch?.status ?? "NO_MATCH"
    },
    update: {
      normalizedTitle,
      documentType,
      status: input.parsed.metadata.status ?? "REQUIRES_REVIEW",
      matchedLegalSystemId: bestMatch && bestMatch.status !== "NO_MATCH" ? bestMatch.id : undefined,
      matchStatus: bestMatch?.status ?? "NO_MATCH"
    }
  });

  for (const match of matches) {
    await rasd.legalDocumentMatch?.create({
      data: {
        monitoredDocumentId: document.id,
        legalSystemId: match.status === "NO_MATCH" ? undefined : match.id,
        matchMethod: match.method,
        matchScore: match.score,
        titleScore: match.titleScore,
        instrumentScore: match.instrumentScore,
        dateScore: match.dateScore,
        contentScore: match.contentScore,
        status: match.status,
        reviewNotes: match.reasons.join("; ")
      }
    }).catch(() => undefined);
  }

  const previous = await versionDelegate.findFirst({
    where: { documentId: document.id, sourceId: input.source.id, isCurrentAtSource: true },
    include: { provisions: { orderBy: { sequence: "asc" } } },
    orderBy: { detectedAt: "desc" }
  });

  if (previous?.normalizedTextHash === input.parsed.normalizedHash && previous.structureHash === input.parsed.structureHash) {
    return { documentId: document.id, versionId: previous.id, changed: false, matches };
  }

  await versionDelegate.updateMany({
    where: { documentId: document.id, sourceId: input.source.id, isCurrentAtSource: true },
    data: { isCurrentAtSource: false, validTo: new Date() }
  });

  const version = await versionDelegate.create({
    data: {
      documentId: document.id,
      sourceId: input.source.id,
      snapshotId: input.snapshotId,
      sourceDocumentId: input.discovered.sourceDocumentId,
      sourceTitle: input.parsed.title ?? input.discovered.title ?? input.discovered.url,
      sourceUrl: input.discovered.url,
      versionHash,
      normalizedTextHash: input.parsed.normalizedHash,
      structureHash: input.parsed.structureHash,
      metadataHash: fingerprintObject(input.parsed.metadata),
      fullNormalizedText: input.parsed.normalizedText,
      isOfficialPublicationCopy: input.sourceCode === "UQN",
      parserVersion: PARSER_VERSION,
      parseConfidence: input.parsed.confidence,
      metadata: input.parsed.metadata
    }
  });

  await rasd.monitoredProvision?.createMany({
    data: input.parsed.provisions.map((provision) => ({
      documentVersionId: version.id,
      provisionType: provision.provisionType,
      articleNumberRaw: provision.articleNumberRaw,
      articleNumberNormalized: provision.articleNumberNormalized,
      paragraphNumber: provision.paragraphNumber,
      heading: provision.heading,
      textRaw: provision.textRaw,
      textNormalized: provision.textNormalized,
      textHash: provision.textHash,
      sequence: provision.sequence,
      pageNumber: provision.pageNumber,
      metadata: provision.metadata
    }))
  }).catch(() => undefined);

  await documentDelegate.update({
    where: { id: document.id },
    data: { currentSourceVersionId: version.id }
  }).catch(() => document);

  let change: ChangeDetectionDraft | null = null;
  if (previous) {
    change = changeFromDiff({
      documentId: document.id,
      sourceVersionId: version.id,
      hakeemLegalSystemId: bestMatch && bestMatch.status !== "NO_MATCH" ? bestMatch.id : undefined,
      diff: buildDiffResult(parsedFromVersion(previous), input.parsed),
      snapshotId: input.snapshotId
    });
  } else if (!bestMatch || bestMatch.status === "NO_MATCH") {
    change = newDocumentChange(document.id, version.id, input.parsed, input.snapshotId);
  }

  if (change) await persistChange(change, input.dbAvailable);
  return { documentId: document.id, versionId: version.id, changed: Boolean(change), matches, change: change ?? undefined };
}

async function persistConflicts(conflicts: SourceConflictDraft[], dbAvailable: boolean): Promise<void> {
  for (const conflict of conflicts) {
    memoryConflicts.push(conflict);
    if (!dbAvailable || !delegates().sourceConflict || !conflict.documentId) continue;
    await delegates().sourceConflict?.create({
      data: {
        documentId: conflict.documentId,
        fieldName: conflict.fieldName,
        boeValue: conflict.valuesBySource.BOE,
        ncarValue: conflict.valuesBySource.NCAR,
        uqnValue: conflict.valuesBySource.UQN,
        conflictType: conflict.conflictType,
        severity: conflict.severity,
        status: conflict.status,
        evidence: conflict.evidence
      }
    }).catch(() => undefined);
  }
}

function detectRunConflicts(documents: MemoryDocument[]): SourceConflictDraft[] {
  const byIdentity = new Map<string, MemoryDocument[]>();
  for (const document of documents) {
    const group = byIdentity.get(document.identityKey) ?? [];
    group.push(document);
    byIdentity.set(document.identityKey, group);
  }

  const conflicts: SourceConflictDraft[] = [];
  for (const group of byIdentity.values()) {
    if (new Set(group.map((item) => item.sourceCode)).size < 2) continue;
    const versionsBySource: Record<string, { field: string; value: string }[]> = {};
    for (const item of group) {
      versionsBySource[item.sourceCode] = [
        { field: "title", value: item.parsed.title ?? item.discovered.title ?? "" },
        { field: "normalized_text_hash", value: item.parsed.normalizedHash },
        { field: "status", value: String(item.parsed.metadata.status ?? "UNKNOWN") }
      ];
    }
    conflicts.push(
      ...detectSourceConflicts(versionsBySource).map((conflict) => ({
        ...conflict,
        documentId: group[0]?.id,
        evidence: { ...conflict.evidence, identityKey: group[0]?.identityKey }
      }))
    );
  }
  return conflicts;
}

function urgentFlags(result: Omit<ScanResult, "urgentFlags">): string[] {
  const flags: string[] = [];
  if (result.sources.length > 0 && result.sources.every((source) => !source.ok)) flags.push("ALL_SOURCES_FAILED");
  if (result.changes.some((change) => change.changeType === "REPEAL" || change.changeType === "ARTICLE_REPEALED")) flags.push("REPEALED");
  if (result.conflicts.some((conflict) => conflict.severity === "CRITICAL")) flags.push("CRITICAL_CONFLICT");
  return flags;
}

function checkpointOf(run: RasdMonitoringRun | null): { sourceIndex?: number; documentIndexBySource?: Record<string, number> } {
  if (!run?.checkpoint || typeof run.checkpoint !== "object") return {};
  return run.checkpoint as { sourceIndex?: number; documentIndexBySource?: Record<string, number> };
}

async function updateCheckpoint(runId: string, checkpoint: Record<string, unknown>, dbAvailable: boolean): Promise<void> {
  if (!dbAvailable) return;
  const delegate = (prisma as unknown as { monitoringRun?: { update(args: { where: { id: string }; data: { checkpoint: Record<string, unknown> } }): Promise<unknown> } }).monitoringRun;
  await delegate?.update({ where: { id: runId }, data: { checkpoint } }).catch(() => undefined);
}

export function getRasdMemoryStaging() {
  return {
    documents: [...memoryDocuments.values()],
    changes: [...memoryChanges],
    conflicts: [...memoryConflicts]
  };
}

export async function runScan(input: RunScanInput): Promise<ScanResult> {
  const dryRun = input.dryRun ?? true;
  const fixturesOnly = isFixturesOnly(input.fixturesOnly);
  requireScanFlags({ ...input, dryRun, fixturesOnly });

  const sourceCodes = selectedSources(input.sources);
  const run = input.resumeRunId
    ? (await getRun(input.resumeRunId)) ?? (await createRun({ runType: input.runType, triggerType: "CLI", dryRun, metadata: { resumed: true } }))
    : await createRun({ runType: input.runType, triggerType: input.actorId ? "ADMIN" : "CLI", dryRun, metadata: { fixturesOnly, actorId: input.actorId ?? null } });
  await startRun(run.id);

  const lockKey = `rasd:${input.runType.toLowerCase()}`;
  const locked = await acquireRunLock(lockKey, run.id, 1000 * 60 * 45);
  if (!locked) {
    await failRun(run.id, "Rasd scan lock is already held by another run.");
    throw new Error("يوجد تشغيل رصد آخر قيد التنفيذ.");
  }

  let dbAvailable = shouldUseDb(dryRun);
  const counts: ScanResult["counts"] = {
    pagesDiscovered: 0,
    pagesFetched: 0,
    documentsDiscovered: 0,
    documentsNew: 0,
    documentsChanged: 0,
    documentsUnchanged: 0,
    documentsFailed: 0,
    conflictsFound: 0
  };
  const summaries: ScanSourceSummary[] = [];
  const failures: string[] = [];
  const runDocuments: MemoryDocument[] = [];
  const checkpoint = checkpointOf(run);

  try {
    if (dbAvailable) {
      await seedRasdRegistry().catch(() => {
        dbAvailable = false;
      });
    }
    const candidates = await findCandidates(dbAvailable);

    for (let sourceIndex = checkpoint.sourceIndex ?? 0; sourceIndex < sourceCodes.length; sourceIndex += 1) {
      const sourceCode = sourceCodes[sourceIndex];
      const connector = getConnector(sourceCode);
      const source = await getSourceRecord(sourceCode, dbAvailable);
      const summary: ScanSourceSummary = { sourceCode, ok: true, discovered: 0, fetched: 0, changed: 0, unchanged: 0, failed: 0 };
      summaries.push(summary);

      try {
        const discover = await connector.discover({ limit: input.limit ?? (fixturesOnly ? 25 : 100) });
        summary.ok = discover.ok;
        summary.discovered = discover.documents.length;
        summary.error = discover.error;
        counts.pagesDiscovered += discover.pagesVisited;
        counts.documentsDiscovered += discover.documents.length;
        if (!discover.ok) {
          failures.push(`${sourceCode}: ${discover.error ?? "discover failed"}`);
          summary.failed += 1;
          continue;
        }

        const startDocumentIndex = checkpoint.documentIndexBySource?.[sourceCode] ?? 0;
        for (let index = startDocumentIndex; index < discover.documents.length; index += 1) {
          const discovered = discover.documents[index];
          await updateCheckpoint(run.id, { sourceIndex, documentIndexBySource: { [sourceCode]: index } }, dbAvailable);
          try {
            const fetched = await connector.fetchDocument(discovered.url, { timeoutMs: fixturesOnly ? 5_000 : 20_000 });
            if (!fetched.ok) {
              summary.failed += 1;
              counts.documentsFailed += 1;
              failures.push(`${sourceCode}: fetch failed ${discovered.url}: ${fetched.error ?? fetched.status}`);
              continue;
            }

            summary.fetched += 1;
            counts.pagesFetched += 1;
            const contentType = fetched.headers["content-type"];
            const body = fetched.bodyText || fetched.bodyBuffer || "";
            const snapshot = await saveSnapshotRecord({
              dbAvailable,
              runId: run.id,
              source,
              sourceCode,
              discovered,
              status: fetched.status,
              headers: fetched.headers,
              body,
              contentType
            });
            const parsed = parseDocumentStructure(typeof body === "string" ? body : body.toString("utf8"), sourceCode);
            const staged = await stageDocument({ dbAvailable, source, sourceCode, discovered, parsed, snapshotId: snapshot.snapshotId, candidates });
            const identityKey = identityKeyFor(parsed, discovered);
            runDocuments.push({
              id: staged.documentId,
              identityKey,
              sourceCode,
              parsed,
              discovered,
              versionId: staged.versionId,
              matches: staged.matches
            });
            if (staged.changed) {
              summary.changed += 1;
              counts.documentsChanged += 1;
              if (staged.change?.changeType === "NEW_DOCUMENT") counts.documentsNew += 1;
            } else {
              summary.unchanged += 1;
              counts.documentsUnchanged += 1;
            }
          } catch (error) {
            summary.failed += 1;
            counts.documentsFailed += 1;
            failures.push(`${sourceCode}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (dbAvailable) {
          await delegates().monitoringSource?.update({
            where: { code: sourceCode },
            data: summary.failed > 0 ? { lastFailedScanAt: new Date(), healthStatus: "DEGRADED" } : { lastSuccessfulScanAt: new Date(), healthStatus: "OK" }
          }).catch(() => undefined);
        }
      } catch (error) {
        summary.ok = false;
        summary.error = error instanceof Error ? error.message : String(error);
        summary.failed += 1;
        failures.push(`${sourceCode}: ${summary.error}`);
      }
      await updateRunCounts(run.id, counts);
    }

    const conflicts = detectRunConflicts(runDocuments);
    counts.conflictsFound = conflicts.length;
    await persistConflicts(conflicts, dbAvailable);
    await updateRunCounts(run.id, counts);

    const status = failures.length > 0 ? "PARTIAL" : "COMPLETED";
    await finishRun(run.id, status);
    const partial: Omit<ScanResult, "urgentFlags"> = {
      runId: run.id,
      runType: input.runType,
      status,
      dryRun,
      fixturesOnly,
      dbAvailable,
      counts,
      sources: summaries,
      changes: memoryChanges.slice(-counts.documentsChanged || undefined),
      conflicts,
      failures
    };
    return { ...partial, urgentFlags: urgentFlags(partial) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(run.id, message);
    const partial: Omit<ScanResult, "urgentFlags"> = {
      runId: run.id,
      runType: input.runType,
      status: "FAILED",
      dryRun,
      fixturesOnly,
      dbAvailable,
      counts,
      sources: summaries,
      changes: memoryChanges,
      conflicts: [],
      failures: [...failures, message]
    };
    return { ...partial, urgentFlags: urgentFlags(partial) };
  } finally {
    await releaseRunLock(lockKey);
  }
}
