import type { RasdSourceCode } from "../types";

/** Implementation maturity of a connector in the codebase. */
export type ConnectorImplementationStatus = "IMPLEMENTED" | "STUB" | "MISSING";

/** Whether live network verification succeeded from an authorized environment. */
export type ConnectorLiveStatus = "LIVE_VERIFIED" | "NOT_LIVE_VERIFIED" | "UNTESTED";

/**
 * Operational certification for a source.
 * Never claim CONNECTED / WORKING / LIVE / VERIFIED for BOE or NCAR
 * until a documented live run succeeds from a authorized deploy/runner.
 */
export type ConnectorCertificationStatus =
  | "VERIFIED_WITH_LIMITATIONS"
  | "DEGRADED"
  | "DISABLED"
  | "UNVERIFIED";

export type SourceRunOutcome =
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "DEGRADED"
  | "SKIPPED"
  | "UNREACHABLE";

export interface ConnectorStatusRecord {
  code: RasdSourceCode;
  displayNameAr: string;
  displayNameEn: string;
  implementation: ConnectorImplementationStatus;
  live: ConnectorLiveStatus;
  certification: ConnectorCertificationStatus;
  liveDocumentsVerified: number | null;
  notLiveReason: string | null;
  /** Default feature-flag name controlling this source. */
  flagName: string;
  /** Default enablement for production-like environments. */
  defaultEnabled: boolean;
  notes: string[];
}

/**
 * Canonical connector registry — single source of truth for admin honesty.
 * Fixtures prove parsers; they do NOT prove live connectivity.
 */
export const CONNECTOR_STATUS_REGISTRY: Record<RasdSourceCode, ConnectorStatusRecord> = {
  UQN: {
    code: "UQN",
    displayNameAr: "جريدة أم القرى",
    displayNameEn: "Umm Al-Qura Newspaper",
    implementation: "IMPLEMENTED",
    live: "LIVE_VERIFIED",
    certification: "VERIFIED_WITH_LIMITATIONS",
    liveDocumentsVerified: 10,
    notLiveReason: null,
    flagName: "RASD_SOURCE_UQN_ENABLED",
    defaultEnabled: true,
    notes: [
      "Live sample of 10 documents succeeded from cloud agent environment.",
      "Instrument extraction verified with limitations on edge HTML variants."
    ]
  },
  BOE: {
    code: "BOE",
    displayNameAr: "هيئة الخبراء بمجلس الوزراء",
    displayNameEn: "Bureau of Experts (BOE)",
    implementation: "IMPLEMENTED",
    live: "NOT_LIVE_VERIFIED",
    certification: "DEGRADED",
    liveDocumentsVerified: 0,
    notLiveReason: "TLS ECONNRESET after ClientHello",
    flagName: "RASD_SOURCE_BOE_ENABLED",
    defaultEnabled: false,
    notes: [
      "Connector code and fixtures exist; live TLS handshake fails in current environments.",
      "Must remain disabled in production until live verification PR succeeds.",
      "Do not describe as CONNECTED, WORKING, LIVE, or VERIFIED."
    ]
  },
  NCAR: {
    code: "NCAR",
    displayNameAr: "المركز الوطني للوثائق والمحفوظات",
    displayNameEn: "National Center for Archives & Records",
    implementation: "IMPLEMENTED",
    live: "NOT_LIVE_VERIFIED",
    certification: "DEGRADED",
    liveDocumentsVerified: 0,
    notLiveReason: "TLS ECONNRESET after ClientHello",
    flagName: "RASD_SOURCE_NCAR_ENABLED",
    defaultEnabled: false,
    notes: [
      "Connector code and fixtures exist; live TLS handshake fails in current environments.",
      "Must remain disabled in production until live verification PR succeeds.",
      "Do not describe as CONNECTED, WORKING, LIVE, or VERIFIED."
    ]
  }
};

export function getConnectorStatus(code: RasdSourceCode): ConnectorStatusRecord {
  return CONNECTOR_STATUS_REGISTRY[code];
}

export function listConnectorStatuses(): ConnectorStatusRecord[] {
  return Object.values(CONNECTOR_STATUS_REGISTRY);
}

export function isLiveClaimAllowed(code: RasdSourceCode): boolean {
  const record = CONNECTOR_STATUS_REGISTRY[code];
  return record.live === "LIVE_VERIFIED" && record.certification === "VERIFIED_WITH_LIMITATIONS";
}
