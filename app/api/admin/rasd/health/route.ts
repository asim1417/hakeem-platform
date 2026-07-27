import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { healthCheckAllSources } from "@/lib/modules/rasd/health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  return NextResponse.json({ sources: await healthCheckAllSources() });
}
