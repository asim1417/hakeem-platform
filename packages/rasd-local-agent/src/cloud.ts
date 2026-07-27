import os from "os";
import {
  AGENT_VERSION,
  detectPlatform,
  generateKeyPair,
  loadIdentity,
  nonce,
  saveIdentity,
  sha256Hex,
  signPayload,
  type AgentIdentity
} from "./identity";

export async function pairWithCloud(input: {
  cloudBaseUrl: string;
  code: string;
  displayName?: string;
}): Promise<AgentIdentity> {
  const keys = generateKeyPair();
  const body = {
    code: input.code.trim().toUpperCase(),
    displayName: input.displayName || `${detectPlatform()}-${os.hostname()}`,
    publicKeyPem: keys.publicKeyPem,
    platform: detectPlatform(),
    version: AGENT_VERSION,
    capabilities: [
      "SOURCE_HEALTH_CHECK",
      "DISCOVER_DOCUMENTS",
      "FETCH_DOCUMENT",
      "BASELINE_DRY_RUN",
      "WEEKLY_SCAN",
      "AGENT_SELF_TEST"
    ]
  };
  const res = await fetch(new URL("/api/rasd/agent/pair", input.cloudBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": `HakeemRasdLocalAgent/${AGENT_VERSION}` },
    body: JSON.stringify(body)
  });
  const json = (await res.json()) as { agentId?: string; approvedSources?: string[]; errorCode?: string };
  if (!res.ok || !json.agentId) throw new Error(json.errorCode || `PAIR_FAILED_${res.status}`);

  const identity: AgentIdentity = {
    agentId: json.agentId,
    displayName: body.displayName,
    publicKeyPem: keys.publicKeyPem,
    privateKeyPem: keys.privateKeyPem,
    platform: body.platform,
    version: AGENT_VERSION,
    cloudBaseUrl: input.cloudBaseUrl.replace(/\/$/, ""),
    approvedSources: json.approvedSources ?? ["BOE", "NCAR", "UQN"],
    pairedAt: new Date().toISOString()
  };
  saveIdentity(identity);
  return identity;
}

export async function signedFetch(
  identity: AgentIdentity,
  method: string,
  apiPath: string,
  bodyObj?: unknown
): Promise<Response> {
  const body = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
  const timestamp = new Date().toISOString();
  const n = nonce();
  const bodyHash = sha256Hex(body);
  const signature = signPayload(identity.privateKeyPem, {
    method: method.toUpperCase(),
    path: apiPath,
    timestamp,
    nonce: n,
    bodyHash
  });
  return fetch(new URL(apiPath, identity.cloudBaseUrl), {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": `HakeemRasdLocalAgent/${AGENT_VERSION}`,
      "x-rasd-agent-id": identity.agentId,
      "x-rasd-timestamp": timestamp,
      "x-rasd-nonce": n,
      "x-rasd-signature": signature
    },
    body: method.toUpperCase() === "GET" ? undefined : body
  });
}

export function requireIdentity(): AgentIdentity {
  const identity = loadIdentity();
  if (!identity) throw new Error("NOT_PAIRED");
  return identity;
}
