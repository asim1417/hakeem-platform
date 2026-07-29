import type {
  DiffResult,
  FieldDiff,
  NormalizedMetadata,
  ParsedDocument,
  ParsedProvision,
  ProvisionDiff,
  RasdChangeType,
  RasdSeverity
} from "../types";
import { normalizeForCompare } from "../normalize/arabic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function words(text: string): string[] {
  return normalizeForCompare(text).split(/\s+/).filter(Boolean);
}

function jaccard(a: string, b: string): number {
  const aSet = new Set(words(a));
  const bSet = new Set(words(b));
  if (aSet.size === 0 && bSet.size === 0) return 1;
  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) intersection += 1;
  }
  return intersection / (aSet.size + bSet.size - intersection);
}

function asComparable(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function compareMetadata(previous: NormalizedMetadata, next: NormalizedMetadata): FieldDiff[] {
  const fields: Array<keyof NormalizedMetadata> = [
    "title",
    "documentType",
    "status",
    "instrumentType",
    "normalizedInstrumentNumber",
    "instrumentDateHijri",
    "instrumentDateGregorian",
    "issuingAuthority",
    "publicationDateHijri",
    "publicationDateGregorian",
    "uqnIssue"
  ];

  return fields.flatMap((field) => {
    const oldValue = asComparable(previous[field]);
    const newValue = asComparable(next[field]);
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) return [];
    return [{ field, oldValue, newValue, changeType: "METADATA_CHANGED" as const }];
  });
}

export function compareStructure(previous: ParsedDocument | ParsedProvision[], next: ParsedDocument | ParsedProvision[]): FieldDiff[] {
  const previousProvisions = Array.isArray(previous) ? previous : previous.provisions;
  const nextProvisions = Array.isArray(next) ? next : next.provisions;
  const diffs: FieldDiff[] = [];

  const previousShape = previousProvisions.map((provision) => `${provision.provisionType}:${provision.articleNumberNormalized ?? ""}`);
  const nextShape = nextProvisions.map((provision) => `${provision.provisionType}:${provision.articleNumberNormalized ?? ""}`);

  if (previousShape.join("|") !== nextShape.join("|")) {
    diffs.push({
      field: "provisions",
      oldValue: previousShape.join("|"),
      newValue: nextShape.join("|"),
      changeType: "STRUCTURE_CHANGED"
    });
  }

  return diffs;
}

function provisionKey(provision: ParsedProvision): string {
  return provision.articleNumberNormalized
    ? `article:${provision.articleNumberNormalized}`
    : `${provision.provisionType}:${provision.sequence}`;
}

export function compareProvisions(previous: ParsedProvision[], next: ParsedProvision[]): ProvisionDiff[] {
  const previousByKey = new Map(previous.map((provision) => [provisionKey(provision), provision]));
  const nextByKey = new Map(next.map((provision) => [provisionKey(provision), provision]));
  const allKeys = new Set([...previousByKey.keys(), ...nextByKey.keys()]);
  const diffs: ProvisionDiff[] = [];

  for (const key of allKeys) {
    const oldProvision = previousByKey.get(key);
    const newProvision = nextByKey.get(key);
    if (!oldProvision && newProvision) {
      diffs.push({
        articleNumber: newProvision.articleNumberNormalized,
        sequence: newProvision.sequence,
        changeType: "ARTICLE_ADDED",
        newText: newProvision.textRaw,
        similarity: 0
      });
      continue;
    }
    if (oldProvision && !newProvision) {
      diffs.push({
        articleNumber: oldProvision.articleNumberNormalized,
        sequence: oldProvision.sequence,
        changeType: "ARTICLE_REPEALED",
        oldText: oldProvision.textRaw,
        similarity: 0
      });
      continue;
    }
    if (!oldProvision || !newProvision || oldProvision.textHash === newProvision.textHash) continue;

    const similarity = jaccard(oldProvision.textNormalized, newProvision.textNormalized);
    diffs.push({
      articleNumber: newProvision.articleNumberNormalized ?? oldProvision.articleNumberNormalized,
      sequence: newProvision.sequence,
      changeType: similarity > 0.2 ? "TEXT_AMENDED" : "ARTICLE_RENUMBERED",
      oldText: oldProvision.textRaw,
      newText: newProvision.textRaw,
      similarity
    });
  }

  return diffs.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export function buildVisualDiffHtml(oldText: string, newText: string): string {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const oldSet = new Set(oldWords.map(normalizeForCompare));
  const newSet = new Set(newWords.map(normalizeForCompare));

  const deleted = oldWords
    .filter((word) => !newSet.has(normalizeForCompare(word)))
    .map((word) => `<del>${escapeHtml(word)}</del>`)
    .join(" ");
  const inserted = newWords
    .filter((word) => !oldSet.has(normalizeForCompare(word)))
    .map((word) => `<ins>${escapeHtml(word)}</ins>`)
    .join(" ");
  const common = newWords
    .filter((word) => oldSet.has(normalizeForCompare(word)))
    .map(escapeHtml)
    .join(" ");

  return `<div class="rasd-diff"><p>${common}</p>${deleted ? `<p>${deleted}</p>` : ""}${inserted ? `<p>${inserted}</p>` : ""}</div>`;
}

export function classifyChangeType(input: {
  metadataDiffs?: FieldDiff[];
  structureDiffs?: FieldDiff[];
  provisionDiffs?: ProvisionDiff[];
}): RasdChangeType {
  const provisionDiffs = input.provisionDiffs ?? [];
  if (provisionDiffs.some((diff) => diff.changeType === "ARTICLE_REPEALED")) return "ARTICLE_REPEALED";
  if (provisionDiffs.some((diff) => diff.changeType === "ARTICLE_ADDED")) return "ARTICLE_ADDED";
  if (provisionDiffs.some((diff) => diff.changeType === "TEXT_AMENDED")) return "TEXT_AMENDED";
  if ((input.structureDiffs ?? []).length > 0) return "STRUCTURE_CHANGED";
  if ((input.metadataDiffs ?? []).some((diff) => diff.field === "status")) return "STATUS_CHANGED";
  if ((input.metadataDiffs ?? []).length > 0) return "METADATA_CHANGED";
  return "NO_CHANGE";
}

function severityFor(changeType: RasdChangeType, provisionDiffs: ProvisionDiff[]): RasdSeverity {
  if (changeType === "ARTICLE_REPEALED" || provisionDiffs.some((diff) => diff.changeType === "ARTICLE_REPEALED")) return "CRITICAL";
  if (changeType === "TEXT_AMENDED" || changeType === "ARTICLE_ADDED") return "HIGH";
  if (changeType === "STRUCTURE_CHANGED" || changeType === "STATUS_CHANGED") return "MEDIUM";
  return changeType === "NO_CHANGE" ? "LOW" : "MEDIUM";
}

export function buildDiffResult(previous: ParsedDocument, next: ParsedDocument): DiffResult {
  const metadataDiffs = compareMetadata(previous.metadata, next.metadata);
  const structureDiffs = compareStructure(previous, next);
  const provisionDiffs = compareProvisions(previous.provisions, next.provisions);
  const changeType = classifyChangeType({ metadataDiffs, structureDiffs, provisionDiffs });
  const amended = provisionDiffs.find((diff) => diff.oldText && diff.newText);

  return {
    hasChanges: changeType !== "NO_CHANGE",
    changeType,
    severity: severityFor(changeType, provisionDiffs),
    metadataDiffs,
    structureDiffs,
    provisionDiffs,
    visualDiffHtml: amended ? buildVisualDiffHtml(amended.oldText ?? "", amended.newText ?? "") : undefined
  };
}
