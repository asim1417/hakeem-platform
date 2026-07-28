/**
 * Hakeem Rasd Local Bridge — protocol types.
 * Jobs are typed only; no free-form remote execution.
 */

import type { RasdSourceCode } from "../types";

export type RasdAgentStatus =
  | "PENDING_PAIRING"
  | "ONLINE"
  | "OFFLINE"
  | "BUSY"
  | "DEGRADED"
  | "PAUSED"
  | "UPDATE_REQUIRED"
  | "REVOKED";

export type RasdAgentJobType =
  | "SOURCE_HEALTH_CHECK"
  | "DISCOVER_DOCUMENTS"
  | "FETCH_DOCUMENT"
  | "BASELINE_DRY_RUN"
  | "WEEKLY_SCAN"
  | "RETRY_FAILED_ITEMS"
  | "REPROCESS_SNAPSHOT"
  | "CANCEL_JOB"
  | "AGENT_SELF_TEST";

export type RasdAgentJobStatus =
  | "QUEUED"
  | "CLAIMED"
  | "RUNNING"
  | "UPLOADING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type RasdSourceExecutionMode = "CLOUD" | "LOCAL" | "LOCAL_REQUIRED" | "DISABLED";

export type RasdAgentUpdateChannel = "stable" | "beta";

export type RasdAgentUpdateState = "CURRENT" | "UPDATE_AVAILABLE" | "UPDATE_REQUIRED" | "UNSUPPORTED";

export const RASD_BRIDGE_JOB_TYPES: readonly RasdAgentJobType[] = [
  "SOURCE_HEALTH_CHECK",
  "DISCOVER_DOCUMENTS",
  "FETCH_DOCUMENT",
  "BASELINE_DRY_RUN",
  "WEEKLY_SCAN",
  "RETRY_FAILED_ITEMS",
  "REPROCESS_SNAPSHOT",
  "CANCEL_JOB",
  "AGENT_SELF_TEST"
] as const;

export const RASD_BRIDGE_MIN_AGENT_VERSION = "0.1.0";
export const RASD_BRIDGE_LATEST_AGENT_VERSION = "0.1.0";
export const RASD_PAIRING_TTL_MS = 10 * 60 * 1000;
export const RASD_JOB_DEFAULT_TTL_MS = 30 * 60 * 1000;
export const RASD_AGENT_OFFLINE_AFTER_MS = 2 * 60 * 1000;
export const RASD_MAX_RESULT_BYTES = 8 * 1024 * 1024;
export const RASD_MAX_CHUNK_BYTES = 512 * 1024;

export interface RasdAgentRecord {
  id: string;
  displayName: string;
  ownerId: string;
  publicKeyPem: string;
  platform: string;
  version: string;
  capabilities: string[];
  status: RasdAgentStatus;
  lastSeenAt: string | null;
  lastEgressCountry: string | null;
  egressVerifiedAt: string | null;
  egressVerificationMethod: string | null;
  approvedSources: RasdSourceCode[];
  boeHealth: string | null;
  ncarHealth: string | null;
  uqnHealth: string | null;
  isDefault: boolean;
  createdAt: string;
  revokedAt: string | null;
  pausedAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface RasdPairingCodeRecord {
  id: string;
  code: string;
  ownerId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  agentId: string | null;
}

export interface RasdAgentJobRecord {
  id: string;
  agentId: string;
  requestedBy: string;
  type: RasdAgentJobType;
  sourceCodes: RasdSourceCode[];
  parameters: Record<string, unknown>;
  dryRun: boolean;
  priority: number;
  status: RasdAgentJobStatus;
  createdAt: string;
  availableAt: string;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  resultSummary: Record<string, unknown> | null;
  errorCode: string | null;
  signature: string;
  nonce: string;
  cancelRequested: boolean;
}

export interface SignedJobEnvelope {
  jobId: string;
  agentId: string;
  issuedAt: string;
  expiresAt: string;
  allowedSource: RasdSourceCode[] | ["*"];
  allowedOperation: RasdAgentJobType;
  limits: {
    maxDocuments: number;
    maxBytes: number;
    timeoutMs: number;
  };
  dryRun: boolean;
  parameters: Record<string, unknown>;
  signature: string;
  nonce: string;
}

export interface AgentAuthHeaders {
  agentId: string;
  timestamp: string;
  nonce: string;
  signature: string;
  accessToken?: string;
}

export interface AgentResultDocument {
  sourceCode: RasdSourceCode;
  sourceUrl: string;
  sourceDocumentId?: string;
  title?: string | null;
  documentType?: string | null;
  instrumentType?: string | null;
  instrumentNumber?: string | null;
  instrumentDate?: string | null;
  publicationDate?: string | null;
  uqnIssue?: string | null;
  rawHash: string;
  normalizedHash: string;
  parserVersion: string;
  parserConfidence?: number;
  warnings?: string[];
  matchStatus?: string;
  rawText?: string;
  contentType?: string;
  httpStatus?: number;
  fetchedAt: string;
}

export interface AgentResultPayload {
  jobId: string;
  agentId: string;
  status: RasdAgentJobStatus;
  sourceSummaries: Array<{
    sourceCode: RasdSourceCode;
    ok: boolean;
    discovered?: number;
    fetched?: number;
    succeeded?: number;
    failed?: number;
    errorCode?: string | null;
    healthClass?: string | null;
  }>;
  documents: AgentResultDocument[];
  selfTest?: Record<string, unknown>;
  agentVersion: string;
  uploadedAt: string;
  checksum: string;
  signature: string;
}

export interface SourceExecutionPolicy {
  sourceCode: RasdSourceCode;
  executionMode: RasdSourceExecutionMode;
  preferredAgentId?: string | null;
  fallbackPolicy: "NONE" | "ALERT_ONLY";
  healthStatus: string;
  lastSuccessfulMode: "CLOUD" | "LOCAL" | null;
}
