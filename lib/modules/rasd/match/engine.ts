import { RASD_MATCH_THRESHOLD } from "../flags";
import { normalizeForCompare } from "../normalize/arabic";
import { normalizeInstrumentNumber } from "../normalize/dates";
import type { HakeemLegalSystemCandidate, MatchCandidate, NormalizedMetadata, ParsedDocument, ParsedProvision } from "../types";

function tokenSet(text: string): Set<string> {
  return new Set(normalizeForCompare(text).split(/\s+/).filter((token) => token.length > 1));
}

function jaccard(a: string, b: string): number {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  return intersection / (aSet.size + bSet.size - intersection);
}

function candidateInstrument(candidate: HakeemLegalSystemCandidate): string | undefined {
  const metadataInstrument = candidate.metadata?.royalDecree ?? candidate.metadata?.instrumentNumber;
  if (typeof metadataInstrument === "string" && metadataInstrument.trim()) return metadataInstrument;
  if (candidate.royalDecree) return candidate.royalDecree;
  return undefined;
}

function scoreInstrument(metadata: NormalizedMetadata, candidate: HakeemLegalSystemCandidate): number {
  const sourceNumber = metadata.normalizedInstrumentNumber ?? (metadata.instrumentNumber ? normalizeInstrumentNumber(metadata.instrumentNumber) : undefined);
  const candidateNumberRaw = candidateInstrument(candidate);
  const candidateNumber = candidateNumberRaw ? normalizeInstrumentNumber(candidateNumberRaw) : undefined;
  if (!sourceNumber || !candidateNumber) return 0;
  if (sourceNumber === candidateNumber) return 1;
  return candidateNumber.includes(sourceNumber) || sourceNumber.includes(candidateNumber) ? 0.75 : 0;
}

function scoreDate(metadata: NormalizedMetadata, candidate: HakeemLegalSystemCandidate): number {
  const candidateDate = candidate.effectiveFrom instanceof Date ? candidate.effectiveFrom.toISOString().slice(0, 10) : String(candidate.effectiveFrom ?? "");
  const sourceDate = metadata.instrumentDateGregorian ?? metadata.publicationDateGregorian ?? metadata.instrumentDateHijri ?? "";
  if (!sourceDate || !candidateDate) return 0;
  return normalizeForCompare(candidateDate).includes(normalizeForCompare(sourceDate)) ||
    normalizeForCompare(sourceDate).includes(normalizeForCompare(candidateDate))
    ? 1
    : 0;
}

function firstArticlesText(provisions: ParsedProvision[], maxArticles: number): string {
  return provisions
    .filter((provision) => provision.provisionType === "ARTICLE" || Boolean(provision.articleNumberNormalized))
    .slice(0, maxArticles)
    .map((provision) => provision.textNormalized || provision.textRaw)
    .join(" ");
}

function candidateArticlesText(candidate: HakeemLegalSystemCandidate, maxArticles: number): string {
  return (candidate.articles ?? [])
    .slice(0, maxArticles)
    .map((article) => `${article.articleNumber} ${article.content}`)
    .join(" ");
}

export function scoreMatch(
  document: ParsedDocument | { title?: string; metadata: NormalizedMetadata; provisions?: ParsedProvision[] },
  candidate: HakeemLegalSystemCandidate,
  options: { threshold?: number; maxArticles?: number } = {}
): MatchCandidate {
  const threshold = options.threshold ?? RASD_MATCH_THRESHOLD;
  const maxArticles = options.maxArticles ?? 5;
  const title = document.title ?? document.metadata.title ?? "";
  const titleScore = jaccard(title, candidate.name);
  const instrumentScore = scoreInstrument(document.metadata, candidate);
  const dateScore = scoreDate(document.metadata, candidate);
  const provisions = document.provisions ?? [];
  const contentScore = provisions.length > 0 ? jaccard(firstArticlesText(provisions, maxArticles), candidateArticlesText(candidate, maxArticles)) : 0;

  const exactInstrumentBoost = instrumentScore === 1 ? 0.18 : 0;
  const score = Math.min(1, titleScore * 0.38 + instrumentScore * 0.32 + dateScore * 0.1 + contentScore * 0.2 + exactInstrumentBoost);
  const reasons: string[] = [];
  if (instrumentScore === 1) reasons.push("exact instrument number");
  if (titleScore >= 0.8) reasons.push("high title overlap");
  if (contentScore >= 0.6) reasons.push("first articles overlap");
  if (dateScore === 1) reasons.push("date match");

  const status =
    instrumentScore === 1 && titleScore >= 0.65
      ? "EXACT_MATCH"
      : score >= threshold
        ? "PROBABLE_MATCH"
        : score >= Math.max(0.4, threshold - 0.4)
          ? "AMBIGUOUS"
          : "NO_MATCH";

  const method =
    instrumentScore === 1
      ? "EXACT_INSTRUMENT"
      : titleScore >= 0.7 && (dateScore > 0 || instrumentScore > 0)
        ? "TITLE_META"
        : contentScore >= 0.5
          ? "CONTENT"
          : titleScore >= 0.85
            ? "SEMANTIC_HINT"
            : "NONE";

  return {
    id: candidate.id,
    name: candidate.name,
    status,
    method,
    score,
    titleScore,
    instrumentScore,
    dateScore,
    contentScore,
    reasons
  };
}

export function rankMatches(
  document: ParsedDocument,
  candidates: HakeemLegalSystemCandidate[],
  options: { threshold?: number; maxArticles?: number } = {}
): MatchCandidate[] {
  return candidates
    .map((candidate) => scoreMatch(document, candidate, options))
    .sort((a, b) => b.score - a.score || b.instrumentScore - a.instrumentScore);
}
