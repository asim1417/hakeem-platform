import type { DueDiligenceReport } from "./core";

export type SnapshotEvidence = {
  id?: string;
  sha256?: string;
  sourceKey?: string;
  sourceRecordId?: string | null;
  entityName?: string;
  category?: string;
  title?: string;
  summary?: string | null;
  sourceUrl?: string;
  occurredAt?: string | null;
  fetchedAt?: string;
  confidence?: number;
  status?: string;
};

export type SnapshotSource = {
  key?: string;
  nameAr?: string;
  authority?: string;
  status?: "OK" | "WARNING" | "FAILED" | "SKIPPED" | string;
  observations?: number;
  warnings?: string[];
  durationMs?: number;
};

export type DueDiligenceSnapshotMeta = {
  kind?: string;
  version?: number;
  query?: {
    name?: string;
    commercialRegistration?: string | null;
    unifiedNumber?: string | null;
    city?: string | null;
  };
  generatedAt?: string;
  risk?: { score?: number; level?: string };
  coverage?: {
    configuredSources?: number;
    successfulSources?: number;
    verifiedEvidence?: number;
  };
  sources?: SnapshotSource[];
  evidence?: SnapshotEvidence[];
  rejected?: SnapshotEvidence[];
  needsReview?: SnapshotEvidence[];
  changes?: DueDiligenceChangeSummary;
};

export type SourceUnavailableChange = {
  key: string;
  nameAr: string;
  previousStatus: string | null;
  currentStatus: string | null;
  suppressedEvidence: SnapshotEvidence[];
  suppressedNeedsReview: SnapshotEvidence[];
};

export type DueDiligenceChangeSummary = {
  baseline: boolean;
  comparedToGeneratedAt: string | null;
  riskDelta: number | null;
  currentRisk: number | null;
  previousRisk: number | null;
  addedEvidence: SnapshotEvidence[];
  noLongerObservedEvidence: SnapshotEvidence[];
  addedNeedsReview: SnapshotEvidence[];
  noLongerObservedNeedsReview: SnapshotEvidence[];
  sourceStatusChanges: Array<{
    key: string;
    nameAr: string;
    from: string | null;
    to: string | null;
  }>;
  unavailableSources: SourceUnavailableChange[];
  successfulSourcesDelta: number | null;
  verifiedEvidenceDelta: number | null;
  hasEntityChange: boolean;
  hasOperationalChange: boolean;
  hasMaterialChange: boolean;
};

export function buildDueDiligenceSnapshotMeta(report: DueDiligenceReport): DueDiligenceSnapshotMeta {
  const compactEvidence = (item: DueDiligenceReport["evidence"][number]): SnapshotEvidence => ({
    id: item.id,
    sha256: item.sha256,
    sourceKey: item.sourceKey,
    sourceRecordId: item.sourceRecordId ?? null,
    entityName: item.entityName,
    category: item.category,
    title: item.title,
    summary: item.summary?.slice(0, 800) ?? null,
    sourceUrl: item.sourceUrl,
    occurredAt: item.occurredAt ?? null,
    fetchedAt: item.fetchedAt,
    confidence: item.confidence,
    status: item.status,
  });

  return {
    kind: "due_diligence_snapshot",
    version: 2,
    query: {
      name: report.query.name,
      unifiedNumber: report.query.unifiedNumber ?? null,
      commercialRegistration: report.query.commercialRegistration ?? null,
      city: report.query.city ?? null,
    },
    generatedAt: report.generatedAt,
    risk: { score: report.risk.score, level: report.risk.level },
    coverage: { ...report.coverage },
    sources: report.sources.map((source) => ({ ...source })),
    evidence: report.evidence.map(compactEvidence),
    rejected: report.rejected.map(compactEvidence),
    needsReview: report.needsReview.map(compactEvidence),
  };
}

export function parseDueDiligenceSnapshotMeta(value: unknown): DueDiligenceSnapshotMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const meta = value as DueDiligenceSnapshotMeta;
  if (meta.kind !== "due_diligence_snapshot") return null;
  return meta;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function evidenceKey(item: SnapshotEvidence): string {
  if (item.sha256) return `sha:${item.sha256}`;
  return [item.sourceKey ?? "", item.sourceRecordId ?? "", item.category ?? "", item.title ?? "", item.status ?? ""].join("|");
}

function isOperational(status: string | null | undefined): boolean {
  return status === "OK" || status === "WARNING";
}

function sourceMap(sources: SnapshotSource[] | undefined) {
  return new Map(
    (Array.isArray(sources) ? sources : [])
      .filter((source) => source.key)
      .map((source) => [source.key as string, source])
  );
}

function diffEvidence(
  current: SnapshotEvidence[] | undefined,
  previous: SnapshotEvidence[] | undefined,
  currentSources: Map<string, SnapshotSource>
) {
  const currentItems = Array.isArray(current) ? current : [];
  const previousItems = Array.isArray(previous) ? previous : [];
  const currentKeys = new Set(currentItems.map(evidenceKey));
  const previousKeys = new Set(previousItems.map(evidenceKey));
  const added = currentItems.filter((item) => !previousKeys.has(evidenceKey(item)));
  const removed: SnapshotEvidence[] = [];
  const suppressed = new Map<string, SnapshotEvidence[]>();

  for (const item of previousItems) {
    if (currentKeys.has(evidenceKey(item))) continue;
    const sourceKey = item.sourceKey ?? "unknown";
    const source = currentSources.get(sourceKey);
    if (source && isOperational(source.status)) {
      removed.push(item);
      continue;
    }
    const bucket = suppressed.get(sourceKey) ?? [];
    bucket.push(item);
    suppressed.set(sourceKey, bucket);
  }

  return { added, removed, suppressed };
}

function sourceChanges(current: SnapshotSource[] | undefined, previous: SnapshotSource[] | undefined) {
  const currentMap = sourceMap(current);
  const previousMap = sourceMap(previous);
  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);
  return [...keys]
    .map((key) => {
      const currentSource = currentMap.get(key);
      const previousSource = previousMap.get(key);
      const from = previousSource?.status ?? null;
      const to = currentSource?.status ?? null;
      if (from === to) return null;
      return {
        key,
        nameAr: currentSource?.nameAr ?? previousSource?.nameAr ?? key,
        from,
        to,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

export function compareDueDiligenceSnapshots(
  current: DueDiligenceSnapshotMeta,
  previous: DueDiligenceSnapshotMeta | null
): DueDiligenceChangeSummary {
  const currentRisk = numberOrNull(current.risk?.score);
  if (!previous) {
    return {
      baseline: true,
      comparedToGeneratedAt: null,
      riskDelta: null,
      currentRisk,
      previousRisk: null,
      addedEvidence: [],
      noLongerObservedEvidence: [],
      addedNeedsReview: [],
      noLongerObservedNeedsReview: [],
      sourceStatusChanges: [],
      unavailableSources: [],
      successfulSourcesDelta: null,
      verifiedEvidenceDelta: null,
      hasEntityChange: false,
      hasOperationalChange: false,
      hasMaterialChange: false,
    };
  }

  const currentSources = sourceMap(current.sources);
  const previousSources = sourceMap(previous.sources);
  const previousRisk = numberOrNull(previous.risk?.score);
  const accepted = diffEvidence(current.evidence, previous.evidence, currentSources);
  const review = diffEvidence(current.needsReview, previous.needsReview, currentSources);
  const sourceStatusChanges = sourceChanges(current.sources, previous.sources);
  const currentSuccessful = numberOrNull(current.coverage?.successfulSources);
  const previousSuccessful = numberOrNull(previous.coverage?.successfulSources);
  const currentVerified = numberOrNull(current.coverage?.verifiedEvidence);
  const previousVerified = numberOrNull(previous.coverage?.verifiedEvidence);
  const riskDelta = currentRisk !== null && previousRisk !== null ? currentRisk - previousRisk : null;
  const successfulSourcesDelta =
    currentSuccessful !== null && previousSuccessful !== null ? currentSuccessful - previousSuccessful : null;
  const verifiedEvidenceDelta =
    currentVerified !== null && previousVerified !== null ? currentVerified - previousVerified : null;

  const unavailableKeys = new Set<string>([
    ...accepted.suppressed.keys(),
    ...review.suppressed.keys(),
    ...[...previousSources.keys()].filter((key) => !isOperational(currentSources.get(key)?.status)),
  ]);
  const unavailableSources: SourceUnavailableChange[] = [...unavailableKeys].map((key) => ({
    key,
    nameAr: currentSources.get(key)?.nameAr ?? previousSources.get(key)?.nameAr ?? key,
    previousStatus: previousSources.get(key)?.status ?? null,
    currentStatus: currentSources.get(key)?.status ?? null,
    suppressedEvidence: accepted.suppressed.get(key) ?? [],
    suppressedNeedsReview: review.suppressed.get(key) ?? [],
  }));

  const hasEntityChange =
    (riskDelta !== null && riskDelta !== 0) ||
    accepted.added.length > 0 ||
    accepted.removed.length > 0 ||
    review.added.length > 0 ||
    review.removed.length > 0 ||
    (verifiedEvidenceDelta !== null && verifiedEvidenceDelta !== 0);

  const hasOperationalChange =
    sourceStatusChanges.length > 0 ||
    unavailableSources.length > 0 ||
    (successfulSourcesDelta !== null && successfulSourcesDelta !== 0);

  return {
    baseline: false,
    comparedToGeneratedAt: previous.generatedAt ?? null,
    riskDelta,
    currentRisk,
    previousRisk,
    addedEvidence: accepted.added,
    noLongerObservedEvidence: accepted.removed,
    addedNeedsReview: review.added,
    noLongerObservedNeedsReview: review.removed,
    sourceStatusChanges,
    unavailableSources,
    successfulSourcesDelta,
    verifiedEvidenceDelta,
    hasEntityChange,
    hasOperationalChange,
    hasMaterialChange: hasEntityChange || hasOperationalChange,
  };
}
