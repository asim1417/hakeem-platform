import { createId } from "./ids";
import { generateNonce, getPlatformSigningKeys, signPayload } from "./crypto";
import {
  RASD_BRIDGE_JOB_TYPES,
  RASD_JOB_DEFAULT_TTL_MS,
  RASD_MAX_RESULT_BYTES,
  type RasdAgentJobRecord,
  type RasdAgentJobType,
  type SignedJobEnvelope
} from "./types";
import type { RasdSourceCode } from "../types";
import { getAgent, getJob, listJobsForAgent, saveAgent, saveJob, bridgeStore } from "./store";

export function assertJobType(type: string): asserts type is RasdAgentJobType {
  if (!RASD_BRIDGE_JOB_TYPES.includes(type as RasdAgentJobType)) {
    throw new Error(`UNSUPPORTED_JOB_TYPE:${type}`);
  }
}

export function createAgentJob(input: {
  agentId: string;
  requestedBy: string;
  type: RasdAgentJobType;
  sourceCodes: RasdSourceCode[];
  parameters?: Record<string, unknown>;
  dryRun?: boolean;
  priority?: number;
  maxAttempts?: number;
  ttlMs?: number;
  maxDocuments?: number;
}): RasdAgentJobRecord {
  assertJobType(input.type);
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error("AGENT_NOT_FOUND");
  if (agent.status === "REVOKED") throw new Error("AGENT_REVOKED");
  if (agent.status === "PAUSED") throw new Error("AGENT_PAUSED");
  if (agent.status === "UPDATE_REQUIRED") throw new Error("AGENT_UPDATE_REQUIRED");

  for (const source of input.sourceCodes) {
    if (!agent.approvedSources.includes(source)) throw new Error(`SOURCE_NOT_APPROVED:${source}`);
  }

  const now = Date.now();
  const nonce = generateNonce();
  const expiresAt = new Date(now + (input.ttlMs ?? RASD_JOB_DEFAULT_TTL_MS)).toISOString();
  const jobId = createId("job");
  const limits = {
    maxDocuments: input.maxDocuments ?? Number(input.parameters?.limit ?? 10),
    maxBytes: RASD_MAX_RESULT_BYTES,
    timeoutMs: Number(input.parameters?.timeoutMs ?? 120_000)
  };
  const parameters = {
    ...(input.parameters ?? {}),
    limit: input.maxDocuments ?? Number(input.parameters?.limit ?? 10)
  };
  const unsigned = {
    jobId,
    agentId: input.agentId,
    issuedAt: new Date(now).toISOString(),
    expiresAt,
    allowedSource: input.sourceCodes,
    allowedOperation: input.type,
    limits,
    dryRun: input.dryRun ?? true,
    parameters,
    nonce
  };
  const { privateKeyPem } = getPlatformSigningKeys();
  const signature = signPayload(privateKeyPem, unsigned);

  const job: RasdAgentJobRecord = {
    id: unsigned.jobId,
    agentId: input.agentId,
    requestedBy: input.requestedBy,
    type: input.type,
    sourceCodes: input.sourceCodes,
    parameters,
    dryRun: input.dryRun ?? true,
    priority: input.priority ?? 100,
    status: "QUEUED",
    createdAt: unsigned.issuedAt,
    availableAt: unsigned.issuedAt,
    expiresAt,
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    resultSummary: null,
    errorCode: null,
    signature,
    nonce,
    cancelRequested: false
  };
  return saveJob(job);
}

export function toSignedEnvelope(job: RasdAgentJobRecord): SignedJobEnvelope {
  return {
    jobId: job.id,
    agentId: job.agentId,
    issuedAt: job.createdAt,
    expiresAt: job.expiresAt,
    allowedSource: job.sourceCodes,
    allowedOperation: job.type,
    limits: {
      maxDocuments: Number(job.parameters.limit ?? 10),
      maxBytes: RASD_MAX_RESULT_BYTES,
      timeoutMs: Number(job.parameters.timeoutMs ?? 120_000)
    },
    dryRun: job.dryRun,
    parameters: job.parameters,
    signature: job.signature,
    nonce: job.nonce
  };
}

export function claimNextJob(agentId: string): SignedJobEnvelope | null {
  const agent = getAgent(agentId);
  if (!agent || agent.status === "REVOKED" || agent.status === "PAUSED") return null;

  const now = Date.now();
  const candidates = listJobsForAgent(agentId)
    .filter((job) => job.status === "QUEUED" && !job.cancelRequested && Date.parse(job.expiresAt) >= now && Date.parse(job.availableAt) <= now)
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

  const job = candidates[0];
  if (!job) return null;
  if (job.attemptCount >= job.maxAttempts) {
    job.status = "FAILED";
    job.errorCode = "MAX_ATTEMPTS";
    job.completedAt = new Date().toISOString();
    saveJob(job);
    return null;
  }

  job.status = "CLAIMED";
  job.attemptCount += 1;
  job.startedAt = new Date().toISOString();
  saveJob(job);
  agent.status = "BUSY";
  agent.lastSeenAt = new Date().toISOString();
  saveAgent(agent);
  return toSignedEnvelope(job);
}

export function markJobStatus(jobId: string, status: RasdAgentJobRecord["status"], patch?: Partial<RasdAgentJobRecord>): RasdAgentJobRecord {
  const job = getJob(jobId);
  if (!job) throw new Error("JOB_NOT_FOUND");
  if (Date.parse(job.expiresAt) < Date.now() && !["SUCCEEDED", "PARTIAL", "FAILED", "CANCELLED"].includes(job.status)) {
    job.status = "EXPIRED";
    job.completedAt = new Date().toISOString();
    job.errorCode = "EXPIRED";
    return saveJob(job);
  }
  if (job.cancelRequested && status === "RUNNING") {
    job.status = "CANCELLED";
    job.completedAt = new Date().toISOString();
    job.errorCode = "CANCELLED";
    return saveJob(job);
  }
  Object.assign(job, patch);
  job.status = status;
  if (["SUCCEEDED", "PARTIAL", "FAILED", "CANCELLED", "EXPIRED"].includes(status)) {
    job.completedAt = new Date().toISOString();
  }
  return saveJob(job);
}

export function requestCancelJob(jobId: string, actorId: string): RasdAgentJobRecord {
  const job = getJob(jobId);
  if (!job) throw new Error("JOB_NOT_FOUND");
  job.cancelRequested = true;
  if (job.status === "QUEUED") {
    job.status = "CANCELLED";
    job.completedAt = new Date().toISOString();
    job.errorCode = "CANCELLED";
  }
  job.parameters = { ...job.parameters, cancelledBy: actorId };
  return saveJob(job);
}

export function expireStaleJobs(now = Date.now()): number {
  let count = 0;
  const { jobs } = bridgeStore();
  for (const job of jobs.values()) {
    if (["QUEUED", "CLAIMED", "RUNNING", "UPLOADING"].includes(job.status) && Date.parse(job.expiresAt) < now) {
      job.status = "EXPIRED";
      job.completedAt = new Date(now).toISOString();
      job.errorCode = "EXPIRED";
      saveJob(job);
      count += 1;
    }
  }
  return count;
}
