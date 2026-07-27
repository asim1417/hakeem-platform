import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { listRasdRuns } from "@/lib/modules/rasd/admin-data";
import { RASD_FULL_RESCAN_ALLOWED, envBool } from "@/lib/modules/rasd/flags";
import { runScan } from "@/lib/modules/rasd/scan/orchestrator";
import type { RasdRunType, RasdSourceCode } from "@/lib/modules/rasd/types";

export const dynamic = "force-dynamic";

const runTypes = new Set(["BASELINE", "WEEKLY", "MANUAL", "RETRY", "FULL_RESCAN"]);
const sourceCodes = new Set(["BOE", "NCAR", "UQN"]);

function asSources(value: unknown): RasdSourceCode[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is RasdSourceCode => typeof item === "string" && sourceCodes.has(item));
}

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  return NextResponse.json({ runs: await listRasdRuns() });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("RASD_ADMIN", request);
  if (gate.response) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const runType = typeof body.runType === "string" && runTypes.has(body.runType) ? (body.runType as RasdRunType) : "MANUAL";
  if (runType === "FULL_RESCAN" && !envBool("RASD_FULL_RESCAN_ALLOWED", RASD_FULL_RESCAN_ALLOWED)) {
    return NextResponse.json({ message: "FULL_RESCAN غير مفعّل. اضبط RASD_FULL_RESCAN_ALLOWED=true." }, { status: 403 });
  }
  const result = await runScan({
    runType,
    dryRun: body.dryRun !== false,
    fixturesOnly: body.fixturesOnly === true,
    sources: asSources(body.sources),
    actorId: gate.user.id
  });
  return NextResponse.json({ result });
}
