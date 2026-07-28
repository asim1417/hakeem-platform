import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { createAgentJob, requestCancelJob, assertJobType } from "@/lib/modules/rasd/bridge/jobs";
import { getAgent, listJobsForAgent } from "@/lib/modules/rasd/bridge/store";
import { agentEligibleForSaudiSources, deriveAgentPresence, requiresLocalAgent } from "@/lib/modules/rasd/bridge/policy";
import type { RasdAgentJobType } from "@/lib/modules/rasd/bridge/types";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

export const dynamic = "force-dynamic";

const ALLOWED: RasdAgentJobType[] = [
  "SOURCE_HEALTH_CHECK",
  "DISCOVER_DOCUMENTS",
  "FETCH_DOCUMENT",
  "BASELINE_DRY_RUN",
  "WEEKLY_SCAN",
  "RETRY_FAILED_ITEMS",
  "REPROCESS_SNAPSHOT",
  "CANCEL_JOB",
  "AGENT_SELF_TEST"
];

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("RASD_ADMIN", request);
  if (gate.response) return gate.response;

  const body = await request.json();
  const agentId = String(body.agentId ?? "");
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ errorCode: "AGENT_NOT_FOUND" }, { status: 404 });

  const presence = deriveAgentPresence(agent);
  if (presence === "OFFLINE" || presence === "REVOKED" || presence === "PAUSED") {
    return NextResponse.json({ errorCode: `AGENT_${presence}`, presence }, { status: 409 });
  }

  const type = String(body.type ?? "SOURCE_HEALTH_CHECK") as RasdAgentJobType;
  if (!ALLOWED.includes(type)) return NextResponse.json({ errorCode: "UNSUPPORTED_JOB_TYPE" }, { status: 400 });
  try {
    assertJobType(type);
  } catch {
    return NextResponse.json({ errorCode: "UNSUPPORTED_JOB_TYPE" }, { status: 400 });
  }

  const sourceCodes = (Array.isArray(body.sourceCodes) ? body.sourceCodes : ["BOE", "NCAR", "UQN"]) as RasdSourceCode[];
  for (const code of sourceCodes) {
    if (requiresLocalAgent(code) && type !== "AGENT_SELF_TEST" && type !== "SOURCE_HEALTH_CHECK") {
      const eligibility = agentEligibleForSaudiSources(agent);
      if (!eligibility.ok) {
        return NextResponse.json({ errorCode: "LOCAL_AGENT_NOT_VERIFIED", reasons: eligibility.reasons }, { status: 409 });
      }
    }
  }

  const dryRun = body.dryRun !== false;
  const job = createAgentJob({
    agentId,
    requestedBy: String(gate.user?.id ?? "admin"),
    type,
    sourceCodes,
    dryRun,
    parameters: {
      limit: Number(body.limit ?? 10),
      ...(typeof body.parameters === "object" && body.parameters ? body.parameters : {})
    },
    maxDocuments: Number(body.limit ?? 10)
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    dryRun: job.dryRun,
    autoApply: false,
    agent: {
      id: agent.id,
      displayName: agent.displayName,
      presence,
      egressCountry: agent.lastEgressCountry
    },
    confirmation: {
      ar: "ستُنفَّذ المهمة على الجهاز المحلي المحدد. لن تُعتمد التحديثات تلقائيًا ولن تُكتب في مكتبة حكيم."
    }
  });
}

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  const agentId = request.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ errorCode: "AGENT_REQUIRED" }, { status: 400 });
  return NextResponse.json({ jobs: listJobsForAgent(agentId) });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireApiPermission("RASD_ADMIN", request);
  if (gate.response) return gate.response;
  const body = await request.json();
  const job = requestCancelJob(String(body.jobId ?? ""), String(gate.user?.id ?? "admin"));
  return NextResponse.json({ job });
}
