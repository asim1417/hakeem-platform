import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { buildCoverageReport } from "@/lib/modules/rasd/reports/coverage";
import { buildConflictReport } from "@/lib/modules/rasd/reports/conflicts";
import { buildGapReport } from "@/lib/modules/rasd/reports/gaps";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("RASD_VIEW", request);
  if (gate.response) return gate.response;
  const type = request.nextUrl.searchParams.get("type") ?? "coverage";
  if (type === "gaps") return NextResponse.json({ report: await buildGapReport({ write: true }) });
  if (type === "conflicts") return NextResponse.json({ report: await buildConflictReport({ write: true }) });
  return NextResponse.json({ report: await buildCoverageReport({ write: true }) });
}
