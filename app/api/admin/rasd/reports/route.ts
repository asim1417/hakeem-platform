import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  const type = request.nextUrl.searchParams.get("type") ?? "coverage";
  if (type === "conflicts") {
    const { buildConflictReport } = await import("@/lib/modules/rasd/reports/conflicts");
    return NextResponse.json({ report: await buildConflictReport() });
  }
  if (type === "gaps") {
    const { buildGapReport } = await import("@/lib/modules/rasd/reports/gaps");
    return NextResponse.json({ report: await buildGapReport() });
  }
  const { buildCoverageReport } = await import("@/lib/modules/rasd/reports/coverage");
  return NextResponse.json({ report: await buildCoverageReport() });
}
