import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/lib/modules/rasd/bridge/auth";
import { ingestAgentResults } from "@/lib/modules/rasd/bridge/ingest";
import { markJobStatus } from "@/lib/modules/rasd/bridge/jobs";
import { getJob } from "@/lib/modules/rasd/bridge/store";
import type { AgentResultPayload } from "@/lib/modules/rasd/bridge/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, context: Ctx) {
  const jobId = context.params.id;
  const raw = await request.text();
  const auth = authenticateAgentRequest({
    agentId: request.headers.get("x-rasd-agent-id"),
    timestamp: request.headers.get("x-rasd-timestamp"),
    nonce: request.headers.get("x-rasd-nonce"),
    signature: request.headers.get("x-rasd-signature"),
    method: "POST",
    path: `/api/rasd/agent/jobs/${jobId}/results`,
    body: raw
  });
  if (!auth.ok) return NextResponse.json({ errorCode: auth.errorCode }, { status: 401 });

  const job = getJob(jobId);
  if (!job || job.agentId !== auth.agentId) {
    return NextResponse.json({ errorCode: "JOB_NOT_FOUND" }, { status: 404 });
  }

  markJobStatus(jobId, "UPLOADING");
  const payload = JSON.parse(raw) as AgentResultPayload;
  const result = ingestAgentResults(payload);
  if (!result.ok) return NextResponse.json({ errorCode: result.errorCode }, { status: 400 });
  return NextResponse.json(result);
}
