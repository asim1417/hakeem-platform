/**
 * In-memory + optional Prisma-backed store for the Local Bridge.
 * Keeps unit/E2E tests hermetic when DATABASE_URL models are unavailable.
 */
import type {
  RasdAgentJobRecord,
  RasdAgentRecord,
  RasdPairingCodeRecord,
  SourceExecutionPolicy
} from "./types";
import type { RasdSourceCode } from "../types";

const agents = new Map<string, RasdAgentRecord>();
const pairingCodes = new Map<string, RasdPairingCodeRecord>();
const jobs = new Map<string, RasdAgentJobRecord>();
const usedNonces = new Map<string, number>();
const resultChecksums = new Set<string>();
const chunkStore = new Map<string, { chunks: Map<number, string>; total?: number; checksum?: string }>();

const sourcePolicies: Record<RasdSourceCode, SourceExecutionPolicy> = {
  UQN: {
    sourceCode: "UQN",
    executionMode: "CLOUD",
    preferredAgentId: null,
    fallbackPolicy: "ALERT_ONLY",
    healthStatus: "UNKNOWN",
    lastSuccessfulMode: "CLOUD"
  },
  BOE: {
    sourceCode: "BOE",
    executionMode: "LOCAL_REQUIRED",
    preferredAgentId: null,
    fallbackPolicy: "NONE",
    healthStatus: "UNKNOWN",
    lastSuccessfulMode: null
  },
  NCAR: {
    sourceCode: "NCAR",
    executionMode: "LOCAL_REQUIRED",
    preferredAgentId: null,
    fallbackPolicy: "NONE",
    healthStatus: "UNKNOWN",
    lastSuccessfulMode: null
  }
};

export function resetBridgeStoreForTests(): void {
  agents.clear();
  pairingCodes.clear();
  jobs.clear();
  usedNonces.clear();
  resultChecksums.clear();
  chunkStore.clear();
  sourcePolicies.UQN.lastSuccessfulMode = "CLOUD";
  sourcePolicies.BOE.lastSuccessfulMode = null;
  sourcePolicies.NCAR.lastSuccessfulMode = null;
  try {
    // lazy to avoid circular init issues
    const { resetStagedResultsForTests } = require("./ingest") as { resetStagedResultsForTests: () => void };
    resetStagedResultsForTests();
  } catch {
    // ignore
  }
}

export function bridgeStore() {
  return {
    agents,
    pairingCodes,
    jobs,
    usedNonces,
    resultChecksums,
    chunkStore,
    sourcePolicies
  };
}

export function listAgents(): RasdAgentRecord[] {
  return [...agents.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAgent(id: string): RasdAgentRecord | undefined {
  return agents.get(id);
}

export function saveAgent(agent: RasdAgentRecord): RasdAgentRecord {
  agents.set(agent.id, agent);
  return agent;
}

export function savePairing(code: RasdPairingCodeRecord): RasdPairingCodeRecord {
  pairingCodes.set(code.code, code);
  return code;
}

export function getPairing(code: string): RasdPairingCodeRecord | undefined {
  return pairingCodes.get(code.toUpperCase());
}

export function saveJob(job: RasdAgentJobRecord): RasdAgentJobRecord {
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): RasdAgentJobRecord | undefined {
  return jobs.get(id);
}

export function listJobsForAgent(agentId: string): RasdAgentJobRecord[] {
  return [...jobs.values()].filter((job) => job.agentId === agentId);
}

export function rememberNonce(agentId: string, nonce: string, ttlMs = 10 * 60 * 1000): boolean {
  const key = `${agentId}:${nonce}`;
  const now = Date.now();
  for (const [k, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(k);
  }
  if (usedNonces.has(key)) return false;
  usedNonces.set(key, now + ttlMs);
  return true;
}

export function markResultChecksum(checksum: string): boolean {
  if (resultChecksums.has(checksum)) return false;
  resultChecksums.add(checksum);
  return true;
}

export function getSourcePolicy(code: RasdSourceCode): SourceExecutionPolicy {
  return sourcePolicies[code];
}

export function updateSourcePolicy(code: RasdSourceCode, patch: Partial<SourceExecutionPolicy>): SourceExecutionPolicy {
  sourcePolicies[code] = { ...sourcePolicies[code], ...patch, sourceCode: code };
  return sourcePolicies[code];
}
