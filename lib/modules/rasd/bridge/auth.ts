import { isTimestampFresh, sha256Hex, verifyPayload, verifyRequest, getPlatformSigningKeys } from "./crypto";
import { getAgent, rememberNonce } from "./store";
import type { SignedJobEnvelope } from "./types";
import { validateRasdUrlSyntax } from "../connectors/url-guard";

export type AgentAuthFailure =
  | "MISSING_HEADERS"
  | "AGENT_NOT_FOUND"
  | "AGENT_REVOKED"
  | "STALE_TIMESTAMP"
  | "REPLAY_NONCE"
  | "INVALID_SIGNATURE";

export function authenticateAgentRequest(input: {
  agentId?: string | null;
  timestamp?: string | null;
  nonce?: string | null;
  signature?: string | null;
  method: string;
  path: string;
  body?: string;
}): { ok: true; agentId: string } | { ok: false; errorCode: AgentAuthFailure } {
  const agentId = input.agentId?.trim();
  const timestamp = input.timestamp?.trim();
  const nonce = input.nonce?.trim();
  const signature = input.signature?.trim();
  if (!agentId || !timestamp || !nonce || !signature) return { ok: false, errorCode: "MISSING_HEADERS" };

  const agent = getAgent(agentId);
  if (!agent) return { ok: false, errorCode: "AGENT_NOT_FOUND" };
  if (agent.status === "REVOKED") return { ok: false, errorCode: "AGENT_REVOKED" };
  if (!isTimestampFresh(timestamp)) return { ok: false, errorCode: "STALE_TIMESTAMP" };
  if (!rememberNonce(agentId, nonce)) return { ok: false, errorCode: "REPLAY_NONCE" };

  const bodyHash = sha256Hex(input.body ?? "");
  const valid = verifyRequest(
    agent.publicKeyPem,
    { method: input.method.toUpperCase(), path: input.path, timestamp, nonce, bodyHash },
    signature
  );
  if (!valid) return { ok: false, errorCode: "INVALID_SIGNATURE" };
  return { ok: true, agentId };
}

export function verifyJobEnvelope(envelope: SignedJobEnvelope): { ok: true } | { ok: false; errorCode: string } {
  if (Date.parse(envelope.expiresAt) < Date.now()) return { ok: false, errorCode: "JOB_EXPIRED" };
  const { publicKeyPem } = getPlatformSigningKeys();
  const { signature, ...unsigned } = envelope;
  if (!verifyPayload(publicKeyPem, unsigned, signature)) return { ok: false, errorCode: "JOB_SIGNATURE_INVALID" };
  return { ok: true };
}

export function assertAgentMayFetchUrl(url: string): { ok: true } | { ok: false; errorCode: string } {
  const syntax = validateRasdUrlSyntax(url);
  if (!syntax.ok) return { ok: false, errorCode: syntax.code };
  return { ok: true };
}
