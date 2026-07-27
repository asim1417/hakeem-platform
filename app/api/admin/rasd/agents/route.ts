import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { listAgents, getAgent, saveAgent } from "@/lib/modules/rasd/bridge/store";
import { deriveAgentPresence } from "@/lib/modules/rasd/bridge/policy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  const agents = listAgents().map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    ownerId: agent.ownerId,
    platform: agent.platform,
    version: agent.version,
    capabilities: agent.capabilities,
    status: agent.status,
    presence: deriveAgentPresence(agent),
    lastSeenAt: agent.lastSeenAt,
    lastEgressCountry: agent.lastEgressCountry,
    egressVerifiedAt: agent.egressVerifiedAt,
    egressVerificationMethod: agent.egressVerificationMethod,
    approvedSources: agent.approvedSources,
    boeHealth: agent.boeHealth,
    ncarHealth: agent.ncarHealth,
    uqnHealth: agent.uqnHealth,
    isDefault: agent.isDefault,
    createdAt: agent.createdAt,
    revokedAt: agent.revokedAt,
    pausedAt: agent.pausedAt
  }));
  return NextResponse.json({ agents });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireApiPermission("RASD_ADMIN", request);
  if (gate.response) return gate.response;
  const body = await request.json();
  const agent = getAgent(String(body.agentId ?? ""));
  if (!agent) return NextResponse.json({ errorCode: "AGENT_NOT_FOUND" }, { status: 404 });

  if (typeof body.displayName === "string") agent.displayName = body.displayName.trim();
  if (body.pause === true) {
    agent.status = "PAUSED";
    agent.pausedAt = new Date().toISOString();
  }
  if (body.resume === true && agent.status === "PAUSED") {
    agent.status = "ONLINE";
    agent.pausedAt = null;
  }
  if (body.revoke === true) {
    agent.status = "REVOKED";
    agent.revokedAt = new Date().toISOString();
  }
  if (body.setDefault === true) {
    for (const other of listAgents()) {
      if (other.id !== agent.id && other.isDefault) {
        other.isDefault = false;
        saveAgent(other);
      }
    }
    agent.isDefault = true;
  }
  saveAgent(agent);
  return NextResponse.json({
    agent: {
      id: agent.id,
      displayName: agent.displayName,
      status: agent.status,
      isDefault: agent.isDefault,
      presence: deriveAgentPresence(agent)
    }
  });
}
