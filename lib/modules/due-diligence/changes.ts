type SnapshotEvidence = {
  sha256?: string;
  sourceKey?: string;
  category?: string;
  title?: string;
  status?: string;
};

type SnapshotSource = {
  key?: string;
  nameAr?: string;
  status?: string;
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
};

export type DueDiligenceChangeSummary = {
  baseline: boolean;
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
  successfulSourcesDelta: number | null;
  verifiedEvidenceDelta: number | null;
  hasMaterialChange: boolean;
};

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
  return [item.sourceKey ?? "", item.category ?? "", item.title ?? "", item.status ?? ""].join("|");
}

function diffEvidence(current: SnapshotEvidence[] | undefined, previous: SnapshotEvidence[] | undefined) {
  const currentItems = Array.isArray(current) ? current : [];
  const previousItems = Array.isArray(previous) ? previous : [];
  const currentKeys = new Set(currentItems.map(evidenceKey));
  const previousKeys = new Set(previousItems.map(evidenceKey));
  return {
    added: currentItems.filter((item) => !previousKeys.has(evidenceKey(item))),
    removed: previousItems.filter((item) => !currentKeys.has(evidenceKey(item))),
  };
}

function sourceChanges(current: SnapshotSource[] | undefined, previous: SnapshotSource[] | undefined) {
  const currentMap = new Map(
    (Array.isArray(current) ? current : [])
      .filter((source) => source.key)
      .map((source) => [source.key as string, source])
  );
  const previousMap = new Map(
    (Array.isArray(previous) ? previous : [])
      .filter((source) => source.key)
      .map((source) => [source.key as string, source])
  );
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
      riskDelta: null,
      currentRisk,
      previousRisk: null,
      addedEvidence: [],
      noLongerObservedEvidence: [],
      addedNeedsReview: [],
      noLongerObservedNeedsReview: [],
      sourceStatusChanges: [],
      successfulSourcesDelta: null,
      verifiedEvidenceDelta: null,
      hasMaterialChange: false,
    };
  }

  const previousRisk = numberOrNull(previous.risk?.score);
  const accepted = diffEvidence(current.evidence, previous.evidence);
  const review = diffEvidence(current.needsReview, previous.needsReview);
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

  const hasMaterialChange =
    (riskDelta !== null && riskDelta !== 0) ||
    accepted.added.length > 0 ||
    accepted.removed.length > 0 ||
    review.added.length > 0 ||
    review.removed.length > 0 ||
    sourceStatusChanges.length > 0 ||
    (successfulSourcesDelta !== null && successfulSourcesDelta !== 0) ||
    (verifiedEvidenceDelta !== null && verifiedEvidenceDelta !== 0);

  return {
    baseline: false,
    riskDelta,
    currentRisk,
    previousRisk,
    addedEvidence: accepted.added,
    noLongerObservedEvidence: accepted.removed,
    addedNeedsReview: review.added,
    noLongerObservedNeedsReview: review.removed,
    sourceStatusChanges,
    successfulSourcesDelta,
    verifiedEvidenceDelta,
    hasMaterialChange,
  };
}
