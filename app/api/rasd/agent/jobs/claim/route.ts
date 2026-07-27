import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/lib/modules/rasd/bridge/auth";
import { claimNextJob } from "@/lib/modules/rasd/bridge/jobs";

export const dynamic = "force-dynamic";

/** Long-poll claim: agent pulls next signed job (no inbound ports on agent). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const auth = authenticateAgentRequest({
    agentId: request.headers.get("x-rasd-agent-id"),
    timestamp: request.headers.get("x-rasd-timestamp"),
    nonce: request.headers.get("x-rasd-nonce"),
    signature: request.headers.get("x-rasd-signature"),
    method: "POST",
    path: "/api/rasd/agent/jobs/claim",
    body: raw
  });
  if (!auth.ok) return NextResponse.json({ errorCode: auth.errorCode }, { status: 401 });

  const waitMs = Math.min(25_000, Math.max(0, Number(process.env.RASD_AGENT_LONG_POLL_MS ?? 0)));
  const started = Date.now();
  let job = claimNextJob(auth.agentId);
  while (!job && Date.now() - started < waitMs) {
    await new Promise((r) => setTimeout(r, 1000));
    job = claimNextJob(auth.agentId);
  }

  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({ job });
}
