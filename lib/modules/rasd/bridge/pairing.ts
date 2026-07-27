import { createId } from "./ids";
import { generatePairingCode } from "./crypto";
import { RASD_PAIRING_TTL_MS, type RasdAgentRecord, type RasdPairingCodeRecord } from "./types";
import { getPairing, saveAgent, savePairing } from "./store";
import type { RasdSourceCode } from "../types";

export function createPairingCode(ownerId: string, ttlMs = RASD_PAIRING_TTL_MS): RasdPairingCodeRecord {
  const now = Date.now();
  const record: RasdPairingCodeRecord = {
    id: createId("pair"),
    code: generatePairingCode(),
    ownerId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    usedAt: null,
    agentId: null
  };
  return savePairing(record);
}

export interface CompletePairingInput {
  code: string;
  displayName: string;
  publicKeyPem: string;
  platform: string;
  version: string;
  capabilities?: string[];
  approvedSources?: RasdSourceCode[];
}

export type PairingResult =
  | { ok: true; agent: RasdAgentRecord }
  | { ok: false; errorCode: "INVALID_CODE" | "EXPIRED_CODE" | "REUSED_CODE" };

export function completePairing(input: CompletePairingInput): PairingResult {
  const pairing = getPairing(input.code.trim().toUpperCase());
  if (!pairing) return { ok: false, errorCode: "INVALID_CODE" };
  if (pairing.usedAt) return { ok: false, errorCode: "REUSED_CODE" };
  if (Date.parse(pairing.expiresAt) < Date.now()) return { ok: false, errorCode: "EXPIRED_CODE" };

  const agent: RasdAgentRecord = {
    id: createId("agent"),
    displayName: input.displayName.trim() || "جهاز رصد",
    ownerId: pairing.ownerId,
    publicKeyPem: input.publicKeyPem,
    platform: input.platform,
    version: input.version,
    capabilities: input.capabilities ?? ["SOURCE_HEALTH_CHECK", "DISCOVER_DOCUMENTS", "FETCH_DOCUMENT", "WEEKLY_SCAN", "BASELINE_DRY_RUN", "AGENT_SELF_TEST"],
    status: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    lastEgressCountry: null,
    egressVerifiedAt: null,
    egressVerificationMethod: null,
    approvedSources: input.approvedSources ?? ["BOE", "NCAR", "UQN"],
    boeHealth: null,
    ncarHealth: null,
    uqnHealth: null,
    isDefault: false,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    pausedAt: null
  };

  pairing.usedAt = new Date().toISOString();
  pairing.agentId = agent.id;
  savePairing(pairing);
  saveAgent(agent);
  return { ok: true, agent };
}
