import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/lib/modules/rasd/bridge/auth";
import { getAgent, saveAgent } from "@/lib/modules/rasd/bridge/store";
import { deriveAgentPresence, agentUpdateState } from "@/lib/modules/rasd/bridge/policy";

export const dynamic = "force-dynamic";

function headersFrom(request: NextRequest) {
  return {
    agentId: request.headers.get("x-rasd-agent-id"),
    timestamp: request.headers.get("x-rasd-timestamp"),
    nonce: request.headers.get("x-rasd-nonce"),
    signature: request.headers.get("x-rasd-signature")
  };
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const auth = authenticateAgentRequest({
    ...headersFrom(request),
    method: "POST",
    path: "/api/rasd/agent/heartbeat",
    body: raw
  });
  if (!auth.ok) return NextResponse.json({ errorCode: auth.errorCode }, { status: 401 });

  const agent = getAgent(auth.agentId);
  if (!agent) return NextResponse.json({ errorCode: "AGENT_NOT_FOUND" }, { status: 404 });

  const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  agent.lastSeenAt = new Date().toISOString();
  if (typeof body.version === "string") agent.version = body.version;
  if (typeof body.egressCountry === "string") {
    agent.lastEgressCountry = body.egressCountry;
    agent.egressVerifiedAt = new Date().toISOString();
    agent.egressVerificationMethod = String(body.egressMethod ?? "heartbeat");
  }
  if (typeof body.boeHealth === "string") agent.boeHealth = body.boeHealth;
  if (typeof body.ncarHealth === "string") agent.ncarHealth = body.ncarHealth;
  if (typeof body.uqnHealth === "string") agent.uqnHealth = body.uqnHealth;

  const update = agentUpdateState(agent.version);
  if (update === "UNSUPPORTED" || update === "UPDATE_REQUIRED") agent.status = "UPDATE_REQUIRED";
  else if (agent.status !== "PAUSED" && agent.status !== "REVOKED" && agent.status !== "BUSY") agent.status = "ONLINE";

  saveAgent(agent);
  return NextResponse.json({
    status: deriveAgentPresence(agent),
    updateState: update,
    pollAfterMs: Number(process.env.RASD_AGENT_POLL_MS ?? 5000)
  });
}
