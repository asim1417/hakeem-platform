import {
  RASD_AGENT_OFFLINE_AFTER_MS,
  RASD_BRIDGE_LATEST_AGENT_VERSION,
  RASD_BRIDGE_MIN_AGENT_VERSION,
  type RasdAgentRecord,
  type RasdAgentUpdateState,
  type RasdSourceExecutionMode
} from "./types";
import type { RasdSourceCode } from "../types";
import { getSourcePolicy } from "./store";

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function agentUpdateState(version: string): RasdAgentUpdateState {
  if (compareSemver(version, RASD_BRIDGE_MIN_AGENT_VERSION) < 0) return "UNSUPPORTED";
  if (compareSemver(version, RASD_BRIDGE_LATEST_AGENT_VERSION) < 0) {
    return compareSemver(version, RASD_BRIDGE_MIN_AGENT_VERSION) < 0 ? "UPDATE_REQUIRED" : "UPDATE_AVAILABLE";
  }
  if (compareSemver(version, RASD_BRIDGE_MIN_AGENT_VERSION) < 0) return "UPDATE_REQUIRED";
  return "CURRENT";
}

export function deriveAgentPresence(agent: RasdAgentRecord, now = Date.now()): RasdAgentRecord["status"] {
  if (agent.status === "REVOKED" || agent.status === "PAUSED" || agent.status === "UPDATE_REQUIRED") return agent.status;
  if (agentUpdateState(agent.version) === "UNSUPPORTED") return "UPDATE_REQUIRED";
  if (!agent.lastSeenAt) return "OFFLINE";
  if (now - Date.parse(agent.lastSeenAt) > RASD_AGENT_OFFLINE_AFTER_MS) return "OFFLINE";
  return agent.status === "BUSY" ? "BUSY" : "ONLINE";
}

export function canDispatchSourceToCloud(sourceCode: RasdSourceCode): boolean {
  const mode = getSourcePolicy(sourceCode).executionMode;
  return mode === "CLOUD" || mode === "LOCAL";
}

export function requiresLocalAgent(sourceCode: RasdSourceCode): boolean {
  return getSourcePolicy(sourceCode).executionMode === "LOCAL_REQUIRED";
}

export function defaultExecutionMode(sourceCode: RasdSourceCode): RasdSourceExecutionMode {
  if (sourceCode === "BOE" || sourceCode === "NCAR") return "LOCAL_REQUIRED";
  if (sourceCode === "UQN") return "CLOUD";
  return "DISABLED";
}

export function agentEligibleForSaudiSources(agent: RasdAgentRecord): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const presence = deriveAgentPresence(agent);
  if (presence !== "ONLINE" && presence !== "BUSY" && presence !== "DEGRADED") reasons.push(`agent_${presence.toLowerCase()}`);
  if (agent.lastEgressCountry && agent.lastEgressCountry.toUpperCase() !== "SA" && agent.lastEgressCountry.toLowerCase() !== "saudi arabia") {
    reasons.push("egress_not_saudi");
  }
  if (!agent.lastEgressCountry) reasons.push("egress_unverified");
  return { ok: reasons.length === 0, reasons };
}
