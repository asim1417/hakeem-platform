import { createHash } from "node:crypto";

export type DueDiligenceAccessType =
  | "OFFICIAL_API"
  | "OPEN_DATA"
  | "PUBLIC_WEB"
  | "AUTHORIZED"
  | "MANUAL";

export type DueDiligenceSourceStatus = "APPROVED" | "REVIEW_REQUIRED" | "BLOCKED";
export type EvidenceStatus = "VERIFIED" | "MATCHED" | "REJECTED" | "NEEDS_REVIEW";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface EntityQuery {
  name: string;
  unifiedNumber?: string;
  commercialRegistration?: string;
  city?: string;
}

export interface DataSourceDefinition {
  key: string;
  nameAr: string;
  authority: string;
  accessType: DueDiligenceAccessType;
  status: DueDiligenceSourceStatus;
  reliability: number;
  baseUrl?: string;
}

export interface RawObservation {
  sourceKey: string;
  sourceRecordId?: string;
  entityName: string;
  unifiedNumber?: string;
  commercialRegistration?: string;
  city?: string;
  category: string;
  title: string;
  summary?: string;
  sourceUrl: string;
  occurredAt?: string;
  fetchedAt: string;
  raw: unknown;
}

export interface EvidenceRecord extends RawObservation {
  id: string;
  sha256: string;
  confidence: number;
  status: EvidenceStatus;
  matchReasons: string[];
  rejectionReasons: string[];
}

export interface SourceRunResult {
  source: DataSourceDefinition;
  observations: RawObservation[];
  warnings: string[];
  durationMs: number;
}

export interface DueDiligenceConnector {
  source: DataSourceDefinition;
  collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult>;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: Array<{
    key: string;
    labelAr: string;
    points: number;
    evidenceIds: string[];
    explanationAr: string;
  }>;
  caveatAr: string;
}

export interface DueDiligenceReport {
  query: EntityQuery;
  generatedAt: string;
  evidence: EvidenceRecord[];
  rejected: EvidenceRecord[];
  needsReview: EvidenceRecord[];
  sources: Array<{
    key: string;
    nameAr: string;
    authority: string;
    status: "OK" | "WARNING" | "FAILED" | "SKIPPED";
    observations: number;
    warnings: string[];
    durationMs: number;
  }>;
  risk: RiskAssessment;
  coverage: {
    configuredSources: number;
    successfulSources: number;
    verifiedEvidence: number;
  };
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeArabicEntityName(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeIdentifier(value?: string): string | undefined {
  const normalized = value?.replace(/\D/g, "");
  return normalized || undefined;
}

function tokenSimilarity(a: string, b: string): number {
  const left = new Set(normalizeArabicEntityName(a).split(" ").filter(Boolean));
  const right = new Set(normalizeArabicEntityName(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

export function hashObservation(observation: RawObservation): string {
  return createHash("sha256").update(stableJson(observation)).digest("hex");
}

export function resolveObservation(query: EntityQuery, observation: RawObservation): EvidenceRecord {
  const reasons: string[] = [];
  const rejectionReasons: string[] = [];
  const queryUnified = normalizeIdentifier(query.unifiedNumber);
  const obsUnified = normalizeIdentifier(observation.unifiedNumber);
  const queryCr = normalizeIdentifier(query.commercialRegistration);
  const obsCr = normalizeIdentifier(observation.commercialRegistration);
  const nameSimilarity = tokenSimilarity(query.name, observation.entityName);

  let confidence = Math.round(nameSimilarity * 55);
  if (nameSimilarity >= 0.95) reasons.push("تطابق قوي في اسم الكيان");
  else if (nameSimilarity >= 0.65) reasons.push("تشابه معتبر في اسم الكيان");

  if (queryUnified && obsUnified) {
    if (queryUnified === obsUnified) {
      confidence += 40;
      reasons.push("تطابق الرقم الموحد");
    } else {
      rejectionReasons.push("تعارض الرقم الموحد");
    }
  }

  if (queryCr && obsCr) {
    if (queryCr === obsCr) {
      confidence += 35;
      reasons.push("تطابق السجل التجاري");
    } else {
      rejectionReasons.push("تعارض السجل التجاري");
    }
  }

  if (query.city && observation.city) {
    if (normalizeArabicEntityName(query.city) === normalizeArabicEntityName(observation.city)) {
      confidence += 5;
      reasons.push("تطابق المدينة");
    }
  }

  confidence = Math.min(100, confidence);
  const hardConflict = rejectionReasons.length > 0;
  let status: EvidenceStatus;
  if (hardConflict) status = "REJECTED";
  else if (confidence >= 90) status = "VERIFIED";
  else if (confidence >= 70) status = "MATCHED";
  else status = "NEEDS_REVIEW";

  const sha256 = hashObservation(observation);
  return {
    ...observation,
    id: sha256.slice(0, 24),
    sha256,
    confidence,
    status,
    matchReasons: reasons,
    rejectionReasons,
  };
}

const RISK_POINTS: Record<string, { points: number; labelAr: string }> = {
  bankruptcy: { points: 38, labelAr: "واقعة إفلاس منشورة" },
  regulatory_action: { points: 28, labelAr: "إجراء أو جزاء تنظيمي منشور" },
  license_issue: { points: 24, labelAr: "ملاحظة على ترخيص" },
  adverse_judgment: { points: 18, labelAr: "حكم منشور ذو دلالة سلبية" },
  identity_mismatch: { points: 20, labelAr: "تعارض في هوية الكيان" },
  media_adverse: { points: 8, labelAr: "إشارة إعلامية سلبية تحتاج تحققًا" },
};

export function assessRisk(evidence: EvidenceRecord[], rejected: EvidenceRecord[]): RiskAssessment {
  const factors: RiskAssessment["factors"] = [];
  let score = 0;

  for (const [key, config] of Object.entries(RISK_POINTS)) {
    const matches = evidence.filter(
      (item) => item.category === key && (item.status === "VERIFIED" || item.status === "MATCHED")
    );
    if (!matches.length) continue;
    const confidenceMultiplier = Math.max(...matches.map((item) => item.confidence)) / 100;
    const points = Math.round(config.points * confidenceMultiplier);
    score += points;
    factors.push({
      key,
      labelAr: config.labelAr,
      points,
      evidenceIds: matches.map((item) => item.id),
      explanationAr: `احتُسب المؤشر من ${matches.length} دليل/أدلة مع مراعاة درجة تطابق الكيان.`,
    });
  }

  const identityConflicts = rejected.filter((item) =>
    item.rejectionReasons.some((reason) => reason.includes("تعارض"))
  );
  if (identityConflicts.length) {
    factors.push({
      key: "identity_conflict_excluded",
      labelAr: "نتائج مستبعدة بسبب تعارض الهوية",
      points: 0,
      evidenceIds: identityConflicts.map((item) => item.id),
      explanationAr: "لم تُحتسب هذه النتائج ضد الكيان لأنها تعارضت مع معرفاته؛ تُعرض للتدقيق فقط.",
    });
  }

  score = Math.min(100, score);
  const level: RiskLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW";
  return {
    score,
    level,
    factors,
    caveatAr:
      "المؤشر أداة فرز للعناية الواجبة وليس حكمًا قانونيًا أو ائتمانيًا. غياب نتيجة من مصدر لا يعني عدم وجود الواقعة ما لم يؤكد المصدر ذلك صراحة.",
  };
}

export async function runDueDiligence(
  query: EntityQuery,
  connectors: DueDiligenceConnector[],
  options: { timeoutMs?: number } = {}
): Promise<DueDiligenceReport> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12_000, 1_000), 30_000);
  const sourceSummaries: DueDiligenceReport["sources"] = [];
  const accepted: EvidenceRecord[] = [];
  const rejected: EvidenceRecord[] = [];
  const needsReview: EvidenceRecord[] = [];

  const runs = await Promise.all(
    connectors.map(async (connector) => {
      if (connector.source.status !== "APPROVED") {
        sourceSummaries.push({
          key: connector.source.key,
          nameAr: connector.source.nameAr,
          authority: connector.source.authority,
          status: "SKIPPED",
          observations: 0,
          warnings: ["المصدر غير معتمد للجمع الآلي."],
          durationMs: 0,
        });
        return [] as EvidenceRecord[];
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = Date.now();
      try {
        const result = await connector.collect(query, controller.signal);
        const resolved = result.observations.map((observation) => resolveObservation(query, observation));
        sourceSummaries.push({
          key: connector.source.key,
          nameAr: connector.source.nameAr,
          authority: connector.source.authority,
          status: result.warnings.length ? "WARNING" : "OK",
          observations: resolved.length,
          warnings: result.warnings,
          durationMs: result.durationMs || Date.now() - startedAt,
        });
        return resolved;
      } catch (error) {
        sourceSummaries.push({
          key: connector.source.key,
          nameAr: connector.source.nameAr,
          authority: connector.source.authority,
          status: "FAILED",
          observations: 0,
          warnings: [error instanceof Error ? error.message : "فشل غير معروف في المصدر"],
          durationMs: Date.now() - startedAt,
        });
        return [] as EvidenceRecord[];
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const seen = new Set<string>();
  for (const item of runs.flat()) {
    if (seen.has(item.sha256)) continue;
    seen.add(item.sha256);
    if (item.status === "REJECTED") rejected.push(item);
    else if (item.status === "NEEDS_REVIEW") needsReview.push(item);
    else accepted.push(item);
  }

  const successfulSources = sourceSummaries.filter((source) => source.status === "OK" || source.status === "WARNING").length;
  return {
    query,
    generatedAt: new Date().toISOString(),
    evidence: accepted.sort((a, b) => b.confidence - a.confidence),
    rejected,
    needsReview,
    sources: sourceSummaries.sort((a, b) => a.key.localeCompare(b.key)),
    risk: assessRisk(accepted, rejected),
    coverage: {
      configuredSources: connectors.length,
      successfulSources,
      verifiedEvidence: accepted.filter((item) => item.status === "VERIFIED").length,
    },
  };
}
