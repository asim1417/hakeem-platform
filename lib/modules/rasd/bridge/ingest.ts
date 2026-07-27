import { sha256Hex, verifyPayload, canonicalJson } from "./crypto";
import { markJobStatus } from "./jobs";
import { getAgent, getJob, markResultChecksum, saveAgent } from "./store";
import type { AgentResultPayload, AgentResultDocument } from "./types";
import { assertAgentMayFetchUrl } from "./auth";
import { RASD_MAX_RESULT_BYTES } from "./types";
import { contentFingerprint } from "../hash";

const stagedResults = new Map<string, unknown>();

export function resetStagedResultsForTests(): void {
  stagedResults.clear();
}

export type IngestFailure =
  | "JOB_NOT_FOUND"
  | "AGENT_MISMATCH"
  | "JOB_NOT_ACTIVE"
  | "INVALID_SIGNATURE"
  | "DUPLICATE_UPLOAD"
  | "OVERSIZED"
  | "URL_FORBIDDEN"
  | "CHECKSUM_MISMATCH"
  | "AUTO_APPLY_FORBIDDEN";

function payloadBytes(payload: AgentResultPayload): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function ingestAgentResults(payload: AgentResultPayload): {
  ok: true;
  storedDocuments: number;
  status: string;
} | { ok: false; errorCode: IngestFailure } {
  const job = getJob(payload.jobId);
  if (!job) return { ok: false, errorCode: "JOB_NOT_FOUND" };
  if (job.agentId !== payload.agentId) return { ok: false, errorCode: "AGENT_MISMATCH" };
  if (!["CLAIMED", "RUNNING", "UPLOADING"].includes(job.status)) return { ok: false, errorCode: "JOB_NOT_ACTIVE" };

  const agent = getAgent(payload.agentId);
  if (!agent) return { ok: false, errorCode: "JOB_NOT_FOUND" };

  const { signature, ...unsigned } = payload;
  if (!verifyPayload(agent.publicKeyPem, unsigned, signature)) return { ok: false, errorCode: "INVALID_SIGNATURE" };

  if (payloadBytes(payload) > RASD_MAX_RESULT_BYTES) return { ok: false, errorCode: "OVERSIZED" };
  if (payload.checksum !== sha256Hex(canonicalJson(unsigned.documents))) {
    return { ok: false, errorCode: "CHECKSUM_MISMATCH" };
  }
  if (!markResultChecksum(`${payload.jobId}:${payload.checksum}`)) {
    return { ok: false, errorCode: "DUPLICATE_UPLOAD" };
  }

  for (const doc of payload.documents) {
    const urlCheck = assertAgentMayFetchUrl(doc.sourceUrl);
    if (!urlCheck.ok) return { ok: false, errorCode: "URL_FORBIDDEN" };
    if (!job.sourceCodes.includes(doc.sourceCode)) return { ok: false, errorCode: "URL_FORBIDDEN" };
  }

  // Staging only — never write legal library from bridge ingest.
  const staged = stageDocuments(payload.documents, payload.jobId, payload.agentId);
  const finalStatus =
    payload.status === "PARTIAL" || payload.sourceSummaries.some((s) => !s.ok)
      ? "PARTIAL"
      : payload.status === "FAILED"
        ? "FAILED"
        : "SUCCEEDED";

  markJobStatus(job.id, finalStatus, {
    resultSummary: {
      documents: staged,
      sourceSummaries: payload.sourceSummaries,
      selfTest: payload.selfTest ?? null,
      agentVersion: payload.agentVersion,
      dryRun: job.dryRun,
      libraryWrite: false,
      autoApply: false
    }
  });

  // Update agent health mirrors when present
  for (const summary of payload.sourceSummaries) {
    if (summary.sourceCode === "BOE") agent.boeHealth = summary.healthClass ?? (summary.ok ? "HEALTHY" : "FAILED");
    if (summary.sourceCode === "NCAR") agent.ncarHealth = summary.healthClass ?? (summary.ok ? "HEALTHY" : "FAILED");
    if (summary.sourceCode === "UQN") agent.uqnHealth = summary.healthClass ?? (summary.ok ? "HEALTHY" : "FAILED");
  }
  if (payload.selfTest?.egressCountry && typeof payload.selfTest.egressCountry === "string") {
    agent.lastEgressCountry = payload.selfTest.egressCountry;
    agent.egressVerifiedAt = new Date().toISOString();
    agent.egressVerificationMethod = String(payload.selfTest.egressMethod ?? "agent-self-test");
  }
  agent.status = "ONLINE";
  agent.lastSeenAt = new Date().toISOString();
  saveAgent(agent);

  return { ok: true, storedDocuments: staged, status: finalStatus };
}

function stageDocuments(documents: AgentResultDocument[], jobId: string, agentId: string): number {
  let count = 0;
  for (const doc of documents) {
    const key = `${jobId}:${doc.rawHash}`;
    stagedResults.set(key, {
      ...doc,
      jobId,
      agentId,
      stagedAt: new Date().toISOString(),
      fingerprint: contentFingerprint(doc.rawText ?? doc.normalizedHash)
    });
    count += 1;
  }
  return count;
}

export function listStagedResults(): unknown[] {
  return [...stagedResults.values()];
}
